import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Isolated to this component's own tables - invisible to the host app's schema.
export default defineSchema({
  config: defineTable({
    baseUrl: v.string(),
    apiKey: v.string(),
    // dpdpbot's org id - required, since notice/banner reads and DSR/
    // grievance creation are all org-scoped (getNoticesForOrg,
    // getBannerConfig, createDsrRequest's organizationId body field).
    orgId: v.string(),
  }),

  notices: defineTable({
    kind: v.union(v.literal('notices'), v.literal('bannerConfig')),
    payload: v.any(),
    fetchedAt: v.number(),
  }).index('by_kind', ['kind']),

  // Caches the brokered principal access token per externalId (ADR-004).
  // Every DSR/grievance/nomination call needs this bearer token, not the
  // service apiKey - see _lib/dpdpClient.ts's auth modes.
  consentLinks: defineTable({
    externalId: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal('linked'), v.literal('revoked')),
    linkedAt: v.number(),
  }).index('by_externalId', ['externalId']),

  dsrRequests: defineTable({
    externalId: v.string(),
    dpdpbotId: v.string(),
    type: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_externalId', ['externalId'])
    .index('by_dpdpbotId', ['dpdpbotId']),

  grievances: defineTable({
    externalId: v.string(),
    dpdpbotId: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_externalId', ['externalId'])
    .index('by_dpdpbotId', ['dpdpbotId']),

  nominations: defineTable({
    externalId: v.string(),
    status: v.union(v.literal('active'), v.literal('revoked')),
    payload: v.any(),
    updatedAt: v.number(),
  }).index('by_externalId', ['externalId']),

  // Idempotency guard for inbound dpdpbot webhooks. dpdpbot's webhook
  // envelope ({eventType, organizationId, payload, timestamp} - see
  // convex/webhooks.ts's postSignedWebhookPayload) has no event id, so
  // `eventId` here is a SHA-256 digest of the raw request body.
  webhookEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    receivedAt: v.number(),
  }).index('by_eventId', ['eventId']),
});
