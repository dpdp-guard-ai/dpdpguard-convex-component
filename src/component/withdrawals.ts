import { v } from 'convex/values';
import { action } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { dpdpClient } from './_lib/dpdpClient.js';

/**
 * Withdrawal propagation reads (added to the contract between 1.5.0 and 1.9.0), service-key authed:
 *
 * - `GET /api/v1/suppression-list` - identifiers this org must stop
 *   marketing to, populated on consent withdrawal or DSR erasure. The poll
 *   half of webhook + poll: a host app's fallback sweep for a
 *   `consent.withdrawn` delivery that never arrived.
 * - `GET /api/v1/withdrawals/{suppressionId}/propagations` - how many
 *   downstream destinations have confirmed a withdrawal took effect.
 *
 * Pass-through, not cached, for the same reason as partner.ts: a stale
 * local suppression list is exactly what keeps a withdrawn principal on a
 * marketing send. The host app owns its own cursor (`nextCursor` -> next
 * call's `since`) and whatever it does with the entries.
 */

export const suppressionList = action({
  args: { since: v.number().optional() },
  handler: async (ctx, { since }) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.listSuppressionList(config, since);
  },
});

export const propagationStatus = action({
  args: { suppressionId: v.string() },
  handler: async (ctx, { suppressionId }) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.getWithdrawalPropagationStatus(config, suppressionId);
  },
});
