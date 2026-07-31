import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { dpdpClient } from "./_lib/dpdpClient";

export const getLink = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("consentLinks")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
  },
});

export const _upsertLink = internalMutation({
  args: {
    externalId: v.string(),
    brokeredToken: v.string(),
    status: v.union(v.literal("linked"), v.literal("revoked")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("consentLinks")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();
    const row = { ...args, linkedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("consentLinks", row);
    }
  },
});

export const broker = action({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const config = await ctx.runQuery(internal.config.get);
    const result = await dpdpClient.brokerToken(config, externalId);
    await ctx.runMutation(internal.consent._upsertLink, {
      externalId,
      brokeredToken: result.token,
      status: "linked",
    });
    return result;
  },
});

export const linkAnonymous = action({
  args: { anonymousId: v.string(), externalId: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    return await dpdpClient.linkAnonymousConsent(config, args);
  },
});
