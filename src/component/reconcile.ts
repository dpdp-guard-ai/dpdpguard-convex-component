import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const _listLinked = internalQuery({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("consentLinks").collect();
    return links
      .filter((l) => l.status === "linked" && l.expiresAt > Date.now())
      .map((l) => l.externalId);
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
    const externalIds = await ctx.runQuery(internal.reconcile._listLinked);
    for (const externalId of externalIds) {
      await ctx.runAction(api.dsr.refresh, { externalId });
      await ctx.runAction(api.grievances.refresh, { externalId });
    }
  },
});
