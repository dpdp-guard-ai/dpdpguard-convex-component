import { v } from 'convex/values';
import { action, query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { dpdpClient } from './_lib/dpdpClient';

export const list = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query('grievances')
      .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
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
      .query('grievances')
      .withIndex('by_dpdpbotId', (q) => q.eq('dpdpbotId', args.dpdpbotId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert('grievances', {
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
    const accessToken = await ctx.runQuery(internal.consent._requireAccessToken, {
      externalId: args.externalId,
    });
    const result = await dpdpClient.createGrievance(config, accessToken, {
      subject: args.subject,
      description: args.description,
    });
    await ctx.runMutation(internal.grievances._upsert, {
      externalId: args.externalId,
      dpdpbotId: result.grievanceId,
      status: result.status,
    });
    return result;
  },
});

// Refreshes the caller's own grievances from dpdpbot - the reconciliation
// fallback for missed webhook deliveries (see crons.ts).
export const refresh = action({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const config = await ctx.runQuery(internal.config.get);
    const accessToken = await ctx.runQuery(internal.consent._requireAccessToken, { externalId });
    const { grievances } = await dpdpClient.listGrievancesForCurrentUser(config, accessToken);
    for (const g of grievances) {
      await ctx.runMutation(internal.grievances._upsert, {
        externalId,
        dpdpbotId: g.grievanceId,
        status: g.status,
      });
    }
  },
});
