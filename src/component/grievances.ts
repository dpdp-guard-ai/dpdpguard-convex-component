import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { dpdpClient } from "./_lib/dpdpClient";

export const list = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("grievances")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .collect();
  },
});

export const _upsert = internalMutation({
  args: {
    externalId: v.string(),
    dpdpbotId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("grievances")
      .withIndex("by_dpdpbotId", (q) => q.eq("dpdpbotId", args.dpdpbotId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("grievances", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const create = action({
  args: {
    externalId: v.string(),
    subject: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    const result = await dpdpClient.createGrievance(config, args);
    await ctx.runMutation(internal.grievances._upsert, {
      externalId: args.externalId,
      dpdpbotId: result.id,
      status: result.status,
    });
    return result;
  },
});
