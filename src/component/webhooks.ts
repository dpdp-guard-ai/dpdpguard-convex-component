import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
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

// dpdpbot's webhook secret is configured separately from the API key -
// signing secrets and bearer credentials should not be the same value.
// Stored via config.setup's `webhookSecret` field is left as a TODO until
// dpdpbot's webhook contract is finalized; for now this expects the host
// app to pass it through an environment variable.
export const receive = httpAction(async (ctx, request) => {
  const signature = request.headers.get("dpdpbot-signature");
  const rawBody = await request.text();
  const secret = process.env.DPDPGUARD_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return new Response("missing signature", { status: 401 });
  }

  const valid = await verifyWebhookSignature(secret, rawBody, signature);
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  const alreadySeen = await ctx.runQuery(internal.webhooks._seen, {
    eventId: event.id,
  });
  if (alreadySeen) {
    return new Response("ok", { status: 200 });
  }

  switch (event.type) {
    case "dsr.updated":
      await ctx.runMutation(internal.dsr._upsert, {
        externalId: event.data.externalId,
        dpdpbotId: event.data.id,
        type: event.data.type,
        status: event.data.status,
      });
      break;
    case "grievance.updated":
      await ctx.runMutation(internal.grievances._upsert, {
        externalId: event.data.externalId,
        dpdpbotId: event.data.id,
        status: event.data.status,
      });
      break;
    case "nomination.revoked":
      await ctx.runMutation(internal.nominations._upsert, {
        externalId: event.data.externalId,
        status: "revoked",
        payload: event.data,
      });
      break;
    default:
      // Unrecognized event types are acknowledged, not rejected, so
      // dpdpbot doesn't retry-storm on a webhook contract addition this
      // component hasn't been updated for yet.
      break;
  }

  await ctx.runMutation(internal.webhooks._markSeen, {
    eventId: event.id,
    type: event.type,
  });

  return new Response("ok", { status: 200 });
});
