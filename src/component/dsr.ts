import { v } from 'convex/values';
import { action, query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { dpdpClient } from './_lib/dpdpClient';

export const list = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query('dsrRequests')
      .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
      .collect();
  },
});

export const _upsert = internalMutation({
  args: {
    externalId: v.string(),
    dpdpbotId: v.string(),
    type: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('dsrRequests')
      .withIndex('by_dpdpbotId', (q) => q.eq('dpdpbotId', args.dpdpbotId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert('dsrRequests', {
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
    type: v.union(
      v.literal('summary'),
      v.literal('processors'),
      v.literal('correction'),
      v.literal('erasure')
    ),
    details: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    const accessToken = await ctx.runQuery(internal.consent._requireAccessToken, {
      externalId: args.externalId,
    });
    const result = await dpdpClient.createDsrRequest(
      config,
      accessToken,
      { type: args.type, details: args.details },
      args.idempotencyKey
    );
    await ctx.runMutation(internal.dsr._upsert, {
      externalId: args.externalId,
      dpdpbotId: result.requestId,
      type: result.type,
      status: result.status,
    });
    return result;
  },
});

// Refreshes the caller's own DSR requests from dpdpbot - the reconciliation
// fallback for missed webhook deliveries (see crons.ts).
export const refresh = action({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const config = await ctx.runQuery(internal.config.get);
    const accessToken = await ctx.runQuery(internal.consent._requireAccessToken, { externalId });
    const { requests } = await dpdpClient.listDsrRequestsForCurrentUser(config, accessToken);
    for (const r of requests) {
      await ctx.runMutation(internal.dsr._upsert, {
        externalId,
        dpdpbotId: r.requestId,
        type: r.type,
        status: r.status,
      });
    }
  },
});
