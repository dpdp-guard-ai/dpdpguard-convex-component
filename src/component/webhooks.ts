import { v } from "convex/values";
import {
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyWebhookSignature } from "./_lib/dpdpClient";

export const _seen = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const row = await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .first();
    return row !== null;
  },
});

export const _markSeen = internalMutation({
  args: { eventId: v.string(), type: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookEvents", { ...args, receivedAt: Date.now() });
  },
});

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// dpdpbot's webhook secret is per-endpoint (convex/webhooks.ts's
// `webhookEndpoints.secret`), configured separately from the service API
// key - signing secrets and bearer credentials should not be the same
// value. Expects the host app to pass it through an environment variable
// until config.setup() grows a dedicated field for it.
//
// dpdpbot's actual webhook envelope (convex/webhooks.ts's
// postSignedWebhookPayload) is `{ eventType, organizationId, payload,
// timestamp }` - there is no event id, and as of writing the only events
// it actually dispatches are "consent.given" and "consent.withdrawn"
// (convex/consentApi.ts, convex/consents.ts), org-scoped with no
// per-principal externalId in the payload. DSR/grievance/nomination
// updates are NOT delivered via webhook today - dsr.refresh() and
// grievances.refresh() (polled by crons.ts) are the only sync path for
// those until dpdpbot ships principal-scoped lifecycle webhooks.
export const receive = httpAction(async (ctx, request) => {
  const signature = request.headers.get("X-DPDP-Signature");
  const rawBody = await request.text();
  const secret = process.env.DPDPGUARD_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return new Response("missing signature", { status: 401 });
  }

  const valid = await verifyWebhookSignature(secret, rawBody, signature);
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  const eventId = await sha256Hex(rawBody);
  const alreadySeen = await ctx.runQuery(internal.webhooks._seen, {
    eventId,
  });
  if (alreadySeen) {
    return new Response("ok", { status: 200 });
  }

  const event = JSON.parse(rawBody) as {
    eventType: string;
    organizationId: string;
    payload: unknown;
    timestamp: number;
  };

  // Nothing to cache yet - see the comment above. Recording that the event
  // arrived (webhookEvents) is what lets a host app add handling here
  // later without re-plumbing idempotency.
  await ctx.runMutation(internal.webhooks._markSeen, {
    eventId,
    type: event.eventType,
  });

  return new Response("ok", { status: 200 });
});
