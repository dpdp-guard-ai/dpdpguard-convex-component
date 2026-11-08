import { v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { dpdpClient } from './_lib/dpdpClient.js';

/**
 * The partner/server-integration read family from the contract's B1 set
 * (`GET /api/v1/retention/due`, `/api/v1/breaches`,
 * `/api/v1/cross-border/transfers`) - the routes a fiduciary's own backend
 * calls with its org-scoped service key, as opposed to the brokered-principal
 * surface in dsr.ts/grievances.ts/nominations.ts.
 *
 * Deliberately pass-through rather than cached into component tables. All
 * three are compliance registers a host app acts on *now* - trigger an
 * erasure job off a due retention, open an incident off a breach - and a
 * stale local copy of "who is past their retention window" is worse than no
 * copy. The cached tables in this component exist for records the host app
 * owns a workflow around (a DSR it filed, a capture batch it pushed); these
 * are somebody else's register, read live.
 *
 * Each route is flag-gated on the dpdpbot side. While its flag is off the
 * route 404s, which arrives here as a DpdpGuardApiError with code
 * `NOT_FOUND` - distinguishable from an enabled route that legitimately has
 * nothing to report, which returns an empty array.
 */

export const retentionDue = action({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.listDueRetentions(config);
  },
});

export const breaches = action({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.listBreaches(config);
  },
});

export const crossBorderTransfers = action({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.listCrossBorderTransfers(config);
  },
});

/**
 * `GET /api/v1/consent-status?email=` (added to the contract between 1.5.0 and 1.9.0) - this org's current
 * per-purpose consent grants for an email address, for gating a send in real
 * time when the host app knows only the email (not a dpdpbot consent id or a
 * brokered principal). `found: false` means "not a customer of record", which
 * is different from `found: true` with every purpose opted out.
 *
 * Not cached: like the Consent Gate, the answer is only worth anything if it
 * reflects a withdrawal made a moment ago.
 */
export const consentStatus = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.getConsentStatus(config, email);
  },
});
