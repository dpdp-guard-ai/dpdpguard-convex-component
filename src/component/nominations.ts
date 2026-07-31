import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { dpdpClient } from "./_lib/dpdpClient";

export const get = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("nominations")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
  },
});

export const _upsert = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("nominations")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();
    const row = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("nominations", row);
    }
  },
});

export const upsert = action({
  args: { externalId: v.string(), nominee: v.any() },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    const result = await dpdpClient.upsertNomination(config, args);
    await ctx.runMutation(internal.nominations._upsert, {
      externalId: args.externalId,
      status: "active",
      payload: result,
    });
    return result;
  },
});

export const revoke = action({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const config = await ctx.runQuery(internal.config.get);
    const result = await dpdpClient.revokeNomination(config, externalId);
    await ctx.runMutation(internal.nominations._upsert, {
      externalId,
      status: "revoked",
      payload: result,
    });
    return result;
  },
});
