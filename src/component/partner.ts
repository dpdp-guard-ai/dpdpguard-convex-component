import { action } from './_generated/server';
import { internal } from './_generated/api';
import { dpdpClient } from './_lib/dpdpClient';

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
