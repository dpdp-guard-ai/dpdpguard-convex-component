import { v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { dpdpClient } from './_lib/dpdpClient.js';

/**
 * `POST /api/v1/consent/verify` - the Consent Gate (contract 1.4.0). A host
 * app calls this immediately before acting on a principal's data and gets
 * back an allow/deny decision derived from the consent record's own
 * withdrawal state.
 *
 * Nothing here is cached, and there is deliberately no component table
 * behind it. The gate exists precisely because a locally cached "this user
 * consented" is the thing that keeps processing running after a withdrawal;
 * caching its answer inside this component would reintroduce the staleness
 * it removes. That makes this an action, never a query - a host app cannot
 * subscribe to a gate decision, it has to ask.
 *
 * Read-only: withdrawal itself stays `DELETE /cm/v1/consent/{consentId}`'s
 * job, which this component does not wrap.
 *
 * Gated on the dpdpbot side by `dpdp_consent_gate_api_enabled`; while that
 * is off the route 404s, surfacing here as a DpdpGuardApiError with code
 * `NOT_FOUND`. Fail closed on that error rather than treating it as an
 * allow - an unreachable gate is not consent.
 */
export const verify = action({
  args: { consentId: v.string() },
  handler: async (ctx, { consentId }) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.verifyConsent(config, consentId);
  },
});
