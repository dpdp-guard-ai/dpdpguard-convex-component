import { v } from 'convex/values';
import schema from './schema.js';
import { action, query, internalMutation } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { dpdpClient } from './_lib/dpdpClient.js';
import type { IvrConsentArtifact, OfflineCaptureSession } from './_lib/dpdpClient.js';

/**
 * The offline / physical capture surface (contract 1.3.0 and 1.4.0):
 * minting an offline consent link, syncing device-signed capture sessions,
 * and the two asynchronous channel adapters (POS till, IVR partner).
 *
 * Everything here authenticates with the org-scoped service `apiKey` - these
 * are a fiduciary's own systems (HIS, CBS, POS, telephony partner) talking
 * to dpdpbot, not a data principal acting on their own records.
 *
 * The session and artefact payloads are passed through as `v.any()`. They
 * are large, deeply nested, contract-owned shapes - including a device
 * signature computed over an exact canonicalisation - and re-declaring them
 * as Convex validators here would create a second source of truth that
 * silently rejects a valid payload the moment the contract adds a field.
 * TypeScript still checks them at the call site: the client class in
 * src/client/index.ts types these arguments from the generated contract
 * types, and dpdpClient's own signatures are derived from them.
 */

export const _recordCaptureResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        clientSessionId: v.string(),
        status: v.string(),
        consentId: v.string().optional(),
        reason: v.string().optional(),
        withdrawalToken: v.string().optional(),
      })
    ),
  },
  handler: async (ctx, { results }) => {
    const syncedAt = Date.now();
    for (const result of results) {
      const existing = await ctx.db
        .query('offlineCaptures')
        .withIndex('by_clientSessionId', (q) => q.eq('clientSessionId', result.clientSessionId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...result, syncedAt });
      } else {
        await ctx.db.insert('offlineCaptures', { ...result, syncedAt });
      }
    }
  },
});

/**
 * Pushes queued capture sessions and records what dpdpbot did with each.
 *
 * Partial success is the normal case, not an error path: a 200 means the
 * batch was processed, not that every session was accepted. Each session is
 * verified independently against its own device signature, so the returned
 * array is the real result - callers must read each `status`
 * (`verified` / `quarantined` / `rejected`) rather than the HTTP status.
 */
export const syncCaptures = action({
  args: { sessions: v.array(v.any()) },
  handler: async (ctx, { sessions }) => {
    const config = await ctx.runQuery(internal.config.get);
    const { results } = await dpdpClient.syncOfflineCaptures(
      config,
      sessions as OfflineCaptureSession[]
    );
    await ctx.runMutation(internal.offline._recordCaptureResults, {
      results: results.map((result) => ({
        clientSessionId: result.clientSessionId,
        status: result.status,
        consentId: result.consentId,
        reason: result.reason,
        withdrawalToken: result.withdrawalToken,
      })),
    });
    return results;
  },
});

/** The recorded outcome of one previously synced session, or null if this component never synced it. */
export const getCapture = query({
  args: { clientSessionId: v.string() },
  returns: v.union(schema.doc('offlineCaptures'), v.null()),
  handler: async (ctx, { clientSessionId }) => {
    return await ctx.db
      .query('offlineCaptures')
      .withIndex('by_clientSessionId', (q) => q.eq('clientSessionId', clientSessionId))
      .first();
  },
});

export const _recordLink = internalMutation({
  args: {
    linkId: v.string(),
    token: v.string(),
    noticeId: v.string(),
    purpose: v.string(),
    label: v.string().optional(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('offlineConsentLinks', { ...args, createdAt: Date.now() });
  },
});

export const createConsentLink = action({
  args: {
    noticeId: v.string(),
    purpose: v.string(),
    dataTypes: v.array(v.string()),
    label: v.string().optional(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    const link = await dpdpClient.createOfflineConsentLink(config, args);
    await ctx.runMutation(internal.offline._recordLink, {
      linkId: link.linkId,
      token: link.token,
      noticeId: args.noticeId,
      purpose: args.purpose,
      label: args.label,
    });
    return link;
  },
});

/** How many links a bare `listConsentLinks()` returns, newest first. */
const CONSENT_LINK_PAGE_DEFAULT = 100;
const CONSENT_LINK_PAGE_MAX = 500;

/**
 * Bounded on purpose. This table only grows — a branch mints a link per
 * counter, per campaign, and nothing prunes them — and the host app
 * subscribes to this with `useQuery`, so an unbounded `.collect()` would
 * mean every mint re-reads and re-pushes the entire history to every
 * subscriber. Newest-first is also the useful order: the link somebody is
 * looking for is almost always one they just minted.
 */
export const listConsentLinks = query({
  args: { limit: v.number().optional() },
  returns: v.array(schema.doc('offlineConsentLinks')),
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? CONSENT_LINK_PAGE_DEFAULT, 1), CONSENT_LINK_PAGE_MAX);
    return await ctx.db
      .query('offlineConsentLinks')
      .withIndex('by_createdAt')
      .order('desc')
      .take(take);
  },
});

/**
 * A till raises an asynchronous consent request against a keyed-in phone
 * number. The response is **not** a consent - nothing is recorded until the
 * principal confirms on their own device, so nothing is cached here either.
 * The returned `token` is what the receipt carries; `expiresAt` is when an
 * unanswered request lapses.
 */
export const posRequest = action({
  args: {
    noticeId: v.string(),
    purpose: v.string(),
    dataTypes: v.array(v.string()),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.createPosConsentRequest(config, args);
  },
});

/**
 * A telephony partner submits the artefact of a completed IVR call. The
 * audio recording is the affirmative-action evidence and is required, as is
 * `partnerCallId` - the idempotency key. Gateways retry on timeout, so a
 * resubmission of one completed call returns the original artefact rather
 * than materialising a second consent; passing the same `partnerCallId`
 * again is safe by design.
 */
export const ivrArtifact = action({
  args: { artifact: v.any() },
  handler: async (ctx, { artifact }) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.recordIvrConsentArtifact(config, artifact as IvrConsentArtifact);
  },
});
