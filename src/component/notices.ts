import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { dpdpClient } from "./_lib/dpdpClient";

// Reads are served from the local cache - reactive, no network round trip.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("notices")
      .withIndex("by_kind", (q) => q.eq("kind", "notices"))
      .first();
    return row?.payload ?? null;
  },
});

export const getBanner = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("notices")
      .withIndex("by_kind", (q) => q.eq("kind", "bannerConfig"))
      .first();
    return row?.payload ?? null;
  },
});

export const _upsert = internalMutation({
  args: {
    kind: v.union(v.literal("notices"), v.literal("bannerConfig")),
    payload: v.any(),
  },
  handler: async (ctx, { kind, payload }) => {
    const existing = await ctx.db
      .query("notices")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .first();
    const row = { kind, payload, fetchedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("notices", row);
    }
  },
});

// Pulls fresh notice + banner config from dpdpbot and writes through to
// the cache. Called by the reconciliation cron and can be invoked ad hoc
// (e.g. after an admin edits notice copy on the dpdpbot dashboard).
export const refresh = action({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.config.get);
    const [notices, bannerConfig] = await Promise.all([
      dpdpClient.getNotices(config),
      dpdpClient.getBannerConfig(config),
    ]);
    await ctx.runMutation(internal.notices._upsert, {
      kind: "notices",
      payload: notices,
    });
    await ctx.runMutation(internal.notices._upsert, {
      kind: "bannerConfig",
      payload: bannerConfig,
    });
  },
});
