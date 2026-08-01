import { v } from 'convex/values';
import { action, query, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { dpdpClient } from './_lib/dpdpClient';

export const getLink = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query('consentLinks')
      .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
      .first();
  },
});

export const _upsertLink = internalMutation({
  args: {
    externalId: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal('linked'), v.literal('revoked')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('consentLinks')
      .withIndex('by_externalId', (q) => q.eq('externalId', args.externalId))
      .first();
    const row = { ...args, linkedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert('consentLinks', row);
    }
  },
});

// Used by dsr.ts/grievances.ts/nominations.ts to get the bearer token their
// calls need. Does not auto re-broker on expiry (that requires the service
// apiKey call, which those actions can do themselves via broker() below) -
// it just fails clearly so the caller knows to re-broker.
export const _requireAccessToken = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const link = await ctx.db
      .query('consentLinks')
      .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
      .first();
    if (!link || link.status !== 'linked') {
      throw new Error(
        `dpdpguard: no brokered access token for externalId "${externalId}" - call dpdp.brokerToken() first.`
      );
    }
    if (link.expiresAt <= Date.now()) {
      throw new Error(
        `dpdpguard: the brokered access token for externalId "${externalId}" has expired - call dpdp.brokerToken() again to re-broker.`
      );
    }
    return link.accessToken;
  },
});

export const broker = action({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const config = await ctx.runQuery(internal.config.get);
    const result = await dpdpClient.brokerToken(config, externalId);
    await ctx.runMutation(internal.consent._upsertLink, {
      externalId,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      status: 'linked',
    });
    return result;
  },
});

export const linkAnonymous = action({
  args: { anonymousId: v.string(), externalId: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.config.get);
    const accessToken = await ctx.runQuery(internal.consent._requireAccessToken, {
      externalId: args.externalId,
    });
    return await dpdpClient.linkAnonymousConsent(config, accessToken, args.anonymousId);
  },
});
