# @dpdpguard/convex

A [Convex Component](https://www.convex.dev/components) for [dpdpbot](https://github.com/dpdp-guard-ai/dpdpbot) (DPDP Guard) — a native Convex integration over dpdpbot's public `/api/v1` contract, as an alternative to wiring [`@dpdpguard/server`](https://github.com/dpdp-guard-ai/dpdpguard-server-node-sdk) into a Convex action by hand.

## Status

Early scaffold. The public API mirrors `@dpdpguard/server`'s method names 1:1 so migrating from the Node SDK is close to a search-and-replace, but request/response shapes are currently hand-typed rather than generated from `@dpdpguard/contract` — see "Known gaps" below.

## Why this exists instead of just using the Node SDK

Convex mutations/queries can't make outbound HTTP calls — only actions can — so *any* integration with dpdpbot from a Convex app needs an action layer somewhere. What a Convex Component adds over a hand-rolled action wrapper:

- **Reactive local cache.** Notices, DSR requests, grievances, and nominations are mirrored into this component's own isolated tables. `useQuery(api.dpdp.listDsrRequests, ...)` in the host app's frontend is a live subscription, not a manual refetch loop.
- **Webhook mounting.** `registerRoutes()` wires an `httpAction` the host app mounts in its own `convex/http.ts`; dpdpbot's webhooks (DSR status change, grievance update, nomination revoked) land directly in the cache tables.
- **Isolated schema.** The component's tables live in `src/component/schema.ts`, invisible to the host app's own `convex/schema.ts` — no naming collisions, no migrations to coordinate.
- **No node runtime.** Webhook signature verification is ported to Web Crypto (`src/component/_lib/dpdpClient.ts`) instead of node's `crypto` module, so the whole component runs in Convex's default V8 action runtime — faster cold starts, no `"use node"` bundling weight.

This is *not* a special backend-to-backend channel into dpdpbot's own Convex deployment — dpdpbot is a separate deployment, so this component still just does `fetch()` against its public API, same as the Node SDK. The value-add is entirely in Convex-native packaging.

## Layout

```
src/
  component/           # runs inside the host app's Convex deployment
    convex.config.ts   # defineComponent("dpdpguard")
    schema.ts           # isolated tables: config, notices, consentLinks,
                         # dsrRequests, grievances, nominations, webhookEvents
    config.ts            # setup() mutation to store apiKey/baseUrl
    notices.ts            # cached read + refresh action
    consent.ts             # brokerToken, linkAnonymousConsent
    dsr.ts                  # createDsrRequest, listDsrRequests
    grievances.ts            # createGrievance, listGrievances
    nominations.ts            # upsert/get/revoke
    webhooks.ts                # httpAction handler + signature verification
    http.ts                     # registerRoutes() the host mounts
    crons.ts                     # reconciliation fallback for missed webhooks
    _lib/dpdpClient.ts            # fetch wrapper + Web Crypto HMAC verify
  client/
    index.ts                      # DpdpGuard class — the app-facing API
example/                           # minimal host app used to run `npx convex dev`
                                    # and generate src/component/_generated
```

## Using it in a host app

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import dpdpguard from "@dpdpguard/convex/convex.config";

const app = defineApp();
app.use(dpdpguard);
export default app;
```

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { registerRoutes } from "@dpdpguard/convex/http";

const http = httpRouter();
registerRoutes(http);
export default http;
```

```ts
// convex/dpdp.ts
import { DpdpGuard } from "@dpdpguard/convex";
import { components } from "./_generated/api";

export const dpdp = new DpdpGuard(components.dpdpguard);
```

```ts
// one-time setup, e.g. from an admin mutation or a setup script
await dpdp.configure(ctx, { baseUrl: "https://api.dpdpbot.com/v1", apiKey: "..." });
```

```ts
// in an action
const dsr = await dpdp.createDsrRequest(ctx, { externalId: user.tokenIdentifier, type: "erasure" });

// in a React component
const myDsrRequests = useQuery(api.dpdp.listDsrRequests, { externalId });
```

## Building

The `src/component/_generated` and `example/convex/_generated` directories are Convex-CLI generated and gitignored. To build:

```bash
cd example
npm install
npx convex dev --once   # generates _generated/ for both the example app and the component
cd ..
npm install
npm run build
```

## Known gaps

- Request/response types in `_lib/dpdpClient.ts` are hand-typed (`any`-heavy). Once `@dpdpguard/contract` publishes generated types, those should replace the hand-typed shapes here — do not let this drift into a second hand-maintained copy of the contract.
- Only `notices.refresh` has a reconciliation cron wired up. DSR/grievance/nomination reconciliation (for missed webhook deliveries) is not yet implemented — webhook delivery is currently the only sync path for those tables.
- Webhook signature verification expects `DPDPGUARD_WEBHOOK_SECRET` as a host app environment variable; there's no `config.setup()` field for it yet, and dpdpbot's webhook signing contract (header name, algorithm) should be confirmed against the real implementation before relying on this in production.
- No tests yet. `convex-test` is listed as a devDependency; component behavior (especially the webhook idempotency path) should be covered before this is used for anything beyond a proof of concept.

## License

Apache-2.0, matching `@dpdpguard/contract`.
