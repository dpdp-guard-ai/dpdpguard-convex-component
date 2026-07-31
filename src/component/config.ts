import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

// Called once by the host app to configure how this component reaches
// dpdpbot. Kept as an explicit call (rather than reading host env vars)
// so the API key isn't riding on ambient process.env shared with other
// components the host app may install.
export const setup = mutation({
  args: {
    baseUrl: v.string(),
    apiKey: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("config").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("config", args);
    }
  },
});

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("config").first();
    if (!config) {
      throw new Error(
        "dpdpguard component is not configured - call dpdp.configure() once from the host app before using it.",
      );
    }
    return config;
  },
});

export const isConfigured = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("config").first();
    return config !== null;
  },
});
