# @dpdpguard/convex

A [Convex Component](https://www.convex.dev/components) for [dpdpbot](https://github.com/dpdp-guard-ai/dpdpbot) (DPDP Guard) — a native Convex integration over dpdpbot's public `/api/v1` contract, as an alternative to wiring [`@dpdpguard/server`](https://github.com/dpdp-guard-ai/dpdpguard-server-node-sdk) into a Convex action by hand.

## Status

Wired to dpdpbot's real `/api/v1` contract (paths, auth model, and generated types come from the installed `@dpdpguard/contract` package — see "Building" below), currently tracking contract `1.9.0` / OpenAPI `2.23.1`. The brokered-principal methods mirror `@dpdpguard/server`'s method names 1:1 so migrating from the Node SDK is close to a search-and-replace; the service-key surface (Consent Gate, compliance registers, withdrawal propagation, offline capture) is described under "Two credentials, two surfaces" below.

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
                         # dsrRequests, grievances, nominations, webhookEvents,
                         # offlineCaptures, offlineConsentLinks
    config.ts            # setup() mutation to store baseUrl/apiKey/orgId
    notices.ts            # cached read + refresh action
    consent.ts             # brokerToken, linkAnonymousConsent, token cache
    dsr.ts                  # createDsrRequest, listDsrRequests, refresh
    grievances.ts            # createGrievance, listGrievances, refresh
    nominations.ts            # upsert/get/revoke
    consentGate.ts             # verify() — stop-processing check, never cached;
                                # decision log + bypass alert reads
    partner.ts                  # retention/breach/cross-border register reads,
                                # consent status by email
    withdrawals.ts               # suppression list + withdrawal propagation status
    offline.ts                   # QR links, capture batch sync, POS + IVR
    reconcile.ts                  # cron-driven per-principal DSR/grievance poll
    webhooks.ts                    # httpAction handler + signature verification
    registerDpdpRoutes.ts            # registerRoutes() the host mounts
    crons.ts                         # reconciliation fallback for missed webhooks
    generated/apiTypes.ts             # openapi-typescript output, gitignored
    _lib/dpdpClient.ts                 # typed fetch wrapper + Web Crypto HMAC verify
    _lib/errorCatalog.ts                # ERROR_CATALOG + DpdpGuardApiError
  client/
    index.ts                      # DpdpGuard class — the app-facing API
example/                           # minimal host app used to run `npx convex dev`
                                    # and generate src/component/_generated
```

## Using it in a host app

Requires `convex` **1.49.0 or newer** (peer dependency) and Node.js **22 or newer** — Convex 1.49 dropped Node 20.

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

## Two credentials, two surfaces

Everything above is the **brokered-principal** surface: a data principal
acting on their own records, so each call carries the short-lived bearer
token `brokerToken()` mints.

The rest of the component is the **service-key** surface — the host app's own
backend acting as the fiduciary, authenticated with the `apiKey` passed to
`configure()`. No `brokerToken()` call is needed for any of it.

### Consent Gate

```ts
// in an action, immediately before acting on a principal's data
const { decision } = await dpdp.verifyConsent(ctx, consentId);
if (decision !== "allow") return; // withdrawn — stop processing
```

This is an action, not a query, and nothing about the answer is cached or
stored. The gate's whole value is that the decision comes from the consent
record's current withdrawal state rather than from anything the caller
remembers, so subscribing to it would defeat it. Treat a thrown
`DpdpGuardApiError` as "do not process" — an unreachable gate is not consent.

The gate's own audit trail is readable with the same key — e.g. to feed a
SIEM or page on-call:

```ts
const { decisions } = await dpdp.listConsentGateDecisions(ctx, { limit: 100 }); // newest first; dpdpbot defaults 50, clamps 200
const { alerts, windowMs, denyThreshold } = await dpdp.listConsentGateAlerts(ctx);
// alerts: consents denied >= denyThreshold times within windowMs — an
// integration that keeps asking (or keeps processing) after being told to stop
```

### Consent status by email

```ts
const status = await dpdp.getConsentStatus(ctx, "a@example.com"); // GET /api/v1/consent-status
if (!status.found) { /* not a customer of record for this org */ }
const marketing = status.purposes.find((p) => p.standardPurpose === "dpdp_reserved.marketing");
const mayMarket = marketing?.status === "opt_in";
```

For a host app that knows only an email address — no dpdpbot consent id, no
brokered principal. `found: false` is "not a customer of record", distinct
from `found: true` with every purpose opted out. Read live, never cached. The
email travels in the query string because that is where the contract puts it.

### Withdrawal propagation

```ts
// fallback sweep for a missed consent.withdrawn webhook — keep your own cursor
let since = lastCursor ?? 0;
for (;;) {
  const { entries, nextCursor } = await dpdp.listSuppressionList(ctx, { since });
  for (const e of entries) { /* stop marketing to e.identifier (unless e.liftedAt) */ }
  if (nextCursor === null) break;
  since = nextCursor;
}

// "N of M destinations confirmed" for one withdrawal
const { total, acknowledged, failed, entries } =
  await dpdp.getWithdrawalPropagationStatus(ctx, suppressionId);
```

Both are pass-through: a stale local suppression list is exactly what keeps
a withdrawn principal on a marketing send, so the component stores nothing
and the host app owns the cursor. `getWithdrawalPropagationStatus` throws
`NOT_FOUND` for a suppression that belongs to another organization.

### Compliance registers

```ts
const { due } = await dpdp.listDueRetentions(ctx);        // GET /api/v1/retention/due
const { breaches } = await dpdp.listBreaches(ctx);        // GET /api/v1/breaches
await dpdp.listCrossBorderTransfers(ctx);                 // GET /api/v1/cross-border/transfers
```

Read live rather than mirrored into component tables: these are registers a
host app acts on now, and a stale copy of "who is past their retention
window" is worse than no copy. Each route is flag-gated on the dpdpbot side —
while its flag is off it 404s, arriving here as a `DpdpGuardApiError` with
code `NOT_FOUND`, which stays distinguishable from an enabled route that
simply has nothing to report.

### Offline / physical capture

```ts
// mint a QR/offline consent link from a POS terminal or hospital system
const link = await dpdp.createOfflineConsentLink(ctx, {
  noticeId, purpose: "Account opening", dataTypes: ["email"], label: "Counter 3",
});

// push queued device-signed sessions when connectivity returns
const results = await dpdp.syncOfflineCaptures(ctx, sessions);
// a batch that resolves without throwing may still contain rejected sessions
const failed = results.filter((r) => r.status !== "verified");

// what this component recorded for one session (idempotency bookkeeping)
const outcome = useQuery(api.dpdp.getOfflineCapture, { clientSessionId });

// a till raises an async request — NOT a consent until the principal confirms
await dpdp.createPosConsentRequest(ctx, { noticeId, purpose, dataTypes, phone });

// a telephony partner submits a completed call's artefact
await dpdp.recordIvrConsentArtifact(ctx, artifact);
```

Capture results are stored keyed by `clientSessionId` — the contract's own
idempotency key — so a device that loses connectivity mid-sync can ask what
already committed instead of replaying blind. Replaying a committed batch
writes nothing on either side.

## Building

`src/component/generated/apiTypes.ts` is generated by `scripts/codegen.mjs` (via `openapi-typescript`, run against the `openapi/v1.yaml` shipped inside the installed `@dpdpguard/contract` package — the same mechanism `dpdpguard-server-node-sdk/scripts/codegen.mjs` uses) and is gitignored. `src/component/_generated` and `example/convex/_generated` are Convex-CLI generated and also gitignored. To build:

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
- Every call is tested against a mocked `dpdpClient`, never against a live dpdpbot deployment — the shapes those mocks return are typed from `@dpdpguard/contract`, so they can't drift from the wire contract, but nothing here exercises a real HTTP round trip.
- Some service-key routes in contract 1.9.0 are still not wrapped: the processor-side write-backs (`POST /api/v1/withdrawals/{propagationId}/ack`, `POST /api/v1/consents/{consentId}/withdrawal-acknowledgement`, `POST /api/v1/dsr/{requestId}/processor-confirmation`), `POST /api/v1/offline/sms-withdraw`, `GET /api/v1/consent-portability/exports/{exportId}/manifest`, `POST /api/v1/discovery/manifest`, and the Consent Observatory routes. They need no new credential; they just haven't been needed by a host app yet.
- The `/api/v1/staff/*` fiduciary/DPO surface is not wrapped at all. It authenticates with a staff login session rather than either credential this component holds, so it has no natural home here.
- The `reconcile.principals` cron loops over every linked principal every 30 minutes with no batching/pagination — fine at small scale, but should be revisited (e.g. only reconcile principals with an open DSR/grievance) before use with a large user base.

## License

Apache-2.0, matching `@dpdpguard/contract`.
