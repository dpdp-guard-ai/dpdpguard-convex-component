import { v } from 'convex/values';
import { internalAction, internalQuery } from './_generated/server';
import { api, internal } from './_generated/api';

/** Upper bound on principals reconciled in one cron run. */
const RECONCILE_BATCH_MAX = 500;

/**
 * Every principal who has ever linked accumulates a `consentLinks` row, and
 * rows are never deleted - only flipped to `revoked` or left to expire. A
 * `.collect()` here would therefore read the whole history every 30 minutes
 * to act on the live subset, and JS `.filter()` does not push the predicate
 * down: the read is already paid for by the time it runs.
 *
 * The compound index does the selection in storage instead. Only the
 * `status` prefix is constrained - this component's `_generated/server` is
 * an untyped stub, so the range builder has no field types to offer a
 * `.gt("expiresAt", now)` bound against - but descending order on
 * `expiresAt` puts every unexpired row ahead of every expired one. So the
 * read stops after `take()` without touching the expired tail, and the
 * remaining JS filter can only trim the end of that batch, never drop a
 * live row.
 *
 * `now` comes from the caller (an action) rather than `Date.now()` here, so
 * this stays a deterministic read.
 */
export const _listLinked = internalQuery({
  args: { now: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { now, limit }) => {
    const links = await ctx.db
      .query('consentLinks')
      .withIndex('by_status_and_expiresAt', (q) => q.eq('status', 'linked'))
      .order('desc')
      .take(Math.min(limit ?? RECONCILE_BATCH_MAX, RECONCILE_BATCH_MAX));
    return links.filter((l) => l.expiresAt > now).map((l) => l.externalId);
  },
});

// Best-effort fallback for principals whose DSR/grievance state might have
// drifted from dpdpbot since dpdpbot doesn't (yet) push per-principal
// lifecycle webhooks for those - see webhooks.ts. Skips anyone whose
// brokered token has already expired rather than re-brokering on their
// behalf; re-brokering happens the next time they use the app.
export const principals = internalAction({
  args: {},
  handler: async (ctx) => {
    const externalIds = await ctx.runQuery(internal.reconcile._listLinked, {
      now: Date.now(),
    });
    for (const externalId of externalIds) {
      await ctx.runAction(api.dsr.refresh, { externalId });
      await ctx.runAction(api.grievances.refresh, { externalId });
    }
  },
});
