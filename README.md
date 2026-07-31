# @dpdpguard/convex

A [Convex Component](https://www.convex.dev/components) for [dpdpbot](https://github.com/dpdp-guard-ai/dpdpbot) (DPDP Guard) — a native Convex integration over dpdpbot's public `/api/v1` contract, as an alternative to wiring [`@dpdpguard/server`](https://github.com/dpdp-guard-ai/dpdpguard-server-node-sdk) into a Convex action by hand.

## Status

Early scaffold, now wired to dpdpbot's real `/api/v1` contract (paths, auth model, and generated types come from the installed `@dpdpguard/contract` package — see "Building" below). The public API mirrors `@dpdpguard/server`'s method names 1:1 so migrating from the Node SDK is close to a search-and-replace.

## Why this exists instead of just using the Node SDK

Convex mutations/queries can't make outbound HTTP calls — only actions can — so *any* integration with dpdpbot from a Convex app needs an action layer somewhere. What a Convex Component adds over a hand-rolled action wrapper:

- **Reactive local cache.** Notices, DSR requests, grievances, and nominations are mirrored into this component's own isolated tables. `useQuery(api.dpdp.listDsrRequests, ...)` in the host app's frontend is a live subscription, not a manual refetch loop.
- **Webhook mounting.** `registerRoutes()` wires an `httpAction` the host app mounts in its own `convex/http.ts`, verified against dpdpbot's real `X-DPDP-Signature` header. As of writing dpdpbot only dispatches `consent.given`/`consent.withdrawn` webhooks (org-scoped, no per-principal id in the payload) — DSR/grievance state is kept in sync by polling (`dsr.refresh`/`grievances.refresh`, run on a cron), not by webhook, until dpdpbot ships principal-scoped lifecycle webhooks. See `webhooks.ts` and `crons.ts`.
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
    config.ts            # setup() mutation to store baseUrl/apiKey/orgId
    notices.ts            # cached read + refresh action
    consent.ts             # brokerToken, linkAnonymousConsent, token cache
    dsr.ts                  # createDsrRequest, listDsrRequests, refresh
    grievances.ts            # createGrievance, listGrievances, refresh
    nominations.ts            # upsert/get/revoke
    reconcile.ts               # cron-driven per-principal DSR/grievance poll
    webhooks.ts                 # httpAction handler + signature verification
    http.ts                      # registerRoutes() the host mounts
    crons.ts                      # reconciliation fallback for missed webhooks
    generated/api-types.ts         # openapi-typescript output, gitignored
    _lib/dpdpClient.ts               # typed fetch wrapper + Web Crypto HMAC verify
    _lib/errorCatalog.ts              # ERROR_CATALOG + DpdpGuardApiError
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
// one-time setup, e.g. from an admin mutation or a setup script.
// baseUrl is your dpdpbot deployment's HTTP Actions URL
// (https://{deployment}.convex.site), apiKey is a service API key
// (convex/apiKeys.ts on the dpdpbot side), orgId is your organization's id.
await dpdp.configure(ctx, { baseUrl: "https://your-deployment.convex.site", apiKey: "...", orgId: "..." });
```

```ts
// per principal, before any DSR/grievance/nomination call for them - mints
// and caches a brokered bearer token (ADR-004). Re-call after it expires.
await dpdp.brokerToken(ctx, user.tokenIdentifier);
```

```ts
// in an action
const dsr = await dpdp.createDsrRequest(ctx, { externalId: user.tokenIdentifier, type: "erasure" });

// in a React component
const myDsrRequests = useQuery(api.dpdp.listDsrRequests, { externalId });
```

## Building

`src/component/generated/api-types.ts` is generated by `scripts/codegen.mjs` (via `openapi-typescript`, run against the `openapi/v1.yaml` shipped inside the installed `@dpdpguard/contract` package — the same mechanism `dpdpguard-server-node-sdk/scripts/codegen.mjs` uses) and is gitignored. `src/component/_generated` and `example/convex/_generated` are Convex-CLI generated and also gitignored. To build:

```bash
npm install        # runs codegen via postinstall
cd example
npm install
npx convex dev --once   # generates _generated/ for both the example app and the component
cd ..
npm run build       # re-runs codegen, then tsc
```

## Known gaps

- Only `notices` and (via the `reconcile.principals` cron) linked principals' DSR/grievance state are polled for reconciliation. Nomination changes made directly on dpdpbot's dashboard aren't reflected locally until the next time the host app calls `getNomination`/re-fetches — there's no nomination polling cron, since `GET /api/v1/nomination` only returns the caller's own single record and dpdpbot doesn't page/filter that endpoint the way DSR/grievance listing do.
- Webhook signature verification expects `DPDPGUARD_WEBHOOK_SECRET` as a host app environment variable; there's no `config.setup()` field for it yet. The header name (`X-DPDP-Signature`) and HMAC-SHA256/hex algorithm are confirmed against dpdpbot's actual `convex/webhooks.ts`, but as noted above, the events it currently dispatches (`consent.given`/`consent.withdrawn`) don't carry enough information to update this component's per-principal cache tables — `webhooks.ts` currently just records that an event arrived, and does nothing with the payload yet.
- No tests yet. `convex-test` is listed as a devDependency; component behavior (especially token expiry handling in `consent._requireAccessToken` and the webhook idempotency path) should be covered before this is used for anything beyond a proof of concept.
- The `reconcile.principals` cron loops over every linked principal every 30 minutes with no batching/pagination — fine at small scale, but should be revisited (e.g. only reconcile principals with an open DSR/grievance) before use with a large user base.

## License

Apache-2.0, matching `@dpdpguard/contract`.
