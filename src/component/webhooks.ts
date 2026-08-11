import { v } from 'convex/values';
import { httpAction, internalMutation, internalQuery } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { verifyWebhookSignature } from './_lib/dpdpClient.js';

export const _seen = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const row = await ctx.db
      .query('webhookEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', eventId))
      .first();
    return row !== null;
  },
});

/**
 * Claims an event id, returning whether this call is the one that got it.
 *
 * The check and the insert have to happen in the same transaction. Reading
 * `_seen` from the action and then inserting is a check-then-act across two
 * transactions: dpdpbot retries a delivery it did not get a 200 for, so two
 * deliveries of one event can both observe "not seen" and both insert, and
 * the idempotency guard silently stops guarding. Convex mutations are
 * transactional, so doing both here closes that window - one caller gets
 * `true`, the other `false`.
 */
export const _claim = internalMutation({
  args: { eventId: v.string(), type: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
      .first();
    if (existing) return false;
    await ctx.db.insert('webhookEvents', { ...args, receivedAt: Date.now() });
    return true;
  },
});

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// dpdpbot's webhook secret is per-endpoint (convex/webhooks.ts's
// `webhookEndpoints.secret`), configured separately from the service API
// key - signing secrets and bearer credentials should not be the same
// value. Expects the host app to pass it through an environment variable
// until config.setup() grows a dedicated field for it.
//
// dpdpbot's actual webhook envelope (convex/webhooks.ts's
// postSignedWebhookPayload) is `{ eventType, organizationId, payload,
// timestamp }` - there is no event id, and as of writing the only events
// it actually dispatches are "consent.given" and "consent.withdrawn"
// (convex/consentApi.ts, convex/consents.ts), org-scoped with no
// per-principal externalId in the payload. DSR/grievance/nomination
// updates are NOT delivered via webhook today - dsr.refresh() and
// grievances.refresh() (polled by crons.ts) are the only sync path for
// those until dpdpbot ships principal-scoped lifecycle webhooks.
export const receive = httpAction(async (ctx, request) => {
  const signature = request.headers.get('X-DPDP-Signature');
  const rawBody = await request.text();
  const secret = process.env.DPDPGUARD_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return new Response('missing signature', { status: 401 });
  }

  const valid = await verifyWebhookSignature(secret, rawBody, signature);
  if (!valid) {
    return new Response('invalid signature', { status: 401 });
  }

  const eventId = await sha256Hex(rawBody);

  const event = JSON.parse(rawBody) as {
    eventType: string;
    organizationId: string;
    payload: unknown;
    timestamp: number;
  };

  // One transaction decides whether this delivery is the first. Nothing to
  // cache yet - see the comment above - but recording that the event
  // arrived is what lets a host app add handling here later without
  // re-plumbing idempotency, and a duplicate delivery must not re-run it.
  const claimed = await ctx.runMutation(internal.webhooks._claim, {
    eventId,
    type: event.eventType,
  });
  if (!claimed) {
    return new Response('ok', { status: 200 });
  }

  return new Response('ok', { status: 200 });
});
