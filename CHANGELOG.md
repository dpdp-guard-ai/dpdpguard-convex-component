# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-11-08

### Added

Five service-key read routes from `@dpdpguard/contract` 1.9.0, bound as
pass-through actions (nothing cached in component tables) on the existing
`apiKey` credential — no new configuration needed:

- **`dpdp.listConsentGateDecisions(ctx, { limit? })`** →
  `consentGate.decisions` → `GET /api/v1/consent/gate/decisions`. The gate's
  append-only decision log, newest first; dpdpbot defaults `limit` to 50 and
  clamps it to 200.
- **`dpdp.listConsentGateAlerts(ctx)`** → `consentGate.alerts` →
  `GET /api/v1/consent/gate/alerts`. Bypass-attempt candidates, with the
  `windowMs`/`denyThreshold` they were measured against.
- **`dpdp.getConsentStatus(ctx, email)`** → `partner.consentStatus` →
  `GET /api/v1/consent-status`. Per-purpose consent for an email address;
  `found: false` means "not a customer of record".
- **`dpdp.listSuppressionList(ctx, { since? })`** →
  `withdrawals.suppressionList` → `GET /api/v1/suppression-list`.
  Cursor-paged by `suppressedAt`; pass `nextCursor` back as `since`.
- **`dpdp.getWithdrawalPropagationStatus(ctx, suppressionId)`** →
  `withdrawals.propagationStatus` →
  `GET /api/v1/withdrawals/{suppressionId}/propagations`.
- Exported response types: `ConsentGateDecisionList`,
  `ConsentGateBypassAlertList`, `ConsentStatus`, `SuppressionList`,
  `WithdrawalPropagationStatus` — all derived from the contract's
  `operations`, so a reshaping contract bump is a compile error.
- New module `src/component/withdrawals.ts`, plus wire-level tests
  (`_lib/dpdpClient.test.ts`) for URL building, query/path encoding and
  service-key auth on the new routes.

### Notes

- **Why minor.** New public API, purely additive: no schema, argument or
  return-shape changes to anything that already existed.
- Still unwrapped (see README "Known gaps"): processor-side write-backs,
  SMS withdraw, consent-portability manifest, discovery manifest, and the
  Consent Observatory routes. `/api/v1/staff/*` remains out of scope (staff
  session auth).

## [0.5.0] - 2026-11-05

### Changed

- **`@dpdpguard/contract` ^1.5.0 → ^1.9.0** (OpenAPI `2.8.0` → `2.23.1`);
  generated `apiTypes.ts` re-derived. All intervening contract releases are
  additive, with no error-catalog or audit-hash changes. New endpoints
  (withdrawal propagation, suppression list, consent-portability manifest,
  observatory, offline SMS withdraw) are not yet bound to the component
  client.
- **`convex` ^1.43.0 → ^1.49.0** (peer and dev dependency) and
  **`convex-test` ^0.0.54 → ^0.0.67**. Host apps must be on `convex`
  1.49.0 or newer — the component now uses validator APIs that only exist
  from 1.44/1.46 on (below), and 1.46 changed TypeScript compatibility
  between validators from different `convex` versions, so the host app and
  the component should resolve the same `convex`.
- **Node.js 22+ required** (`engines.node: ">=22"`). Convex 1.49 dropped
  Node 20; the `Verify` CI matrix now runs Node 22 and 24 only.
- Validators use the chained `.optional()` form added in convex 1.46
  (`v.string().optional()` instead of `v.optional(v.string())`). No change
  to the stored schema or accepted arguments.
- Refreshed `package-lock.json` so the `Quality` workflow's
  `npm audit --audit-level=high` passes again (dev-only transitive
  advisories in `brace-expansion`, `source-map-js`, `vite` and
  `@vitest/mocker`; nothing in the published `dist`).

### Added

- **`returns` validators on the DB-backed queries**, built with
  `schema.doc(tableName)` (convex 1.44) so they include `_id` and
  `_creationTime` without re-declaring the table's fields: `dsr.list`,
  `grievances.list`, `nominations.get`, `offline.getCapture`,
  `offline.listConsentLinks`, `config.isConfigured` (`v.boolean()`) and
  the internal `config.get`. Return shapes are unchanged; a query that
  ever returns something other than its table's documents now fails
  loudly instead of handing the host app an unexpected shape.

## [0.4.3] - 2026-08-28

### Fixed

- **`npx convex deploy`/`convex dev` push failures for every host app with
  `@dpdpguard/convex` installed.** Two packaging bugs, both present since
  at least 0.4.1:
  1. The openapi-typescript codegen output was named
     `generated/api-types.ts` (compiling to `api-types.js`), and a hyphen
     is not a legal Convex module path character. Any push that bundled
     `dist/component/generated/api-types.js` failed at
     `evaluate_push` with `InvalidConfig`. Renamed the generated file (and
     `scripts/codegen.mjs`'s output path) to `generated/apiTypes.ts`.
  2. `src/component/http.ts` — a `registerRoutes()` factory meant to be
     imported by the *host app's own* `convex/http.ts`, not the
     component's router — collided with Convex's special-cased `http.js`
     convention at the root of the component's own function directory,
     which requires a default-exported `Router`. Pushes failed with
     `` `convex/http.js` must have a default export of a Router ``.
     Renamed to `src/component/registerDpdpRoutes.ts` (dist:
     `registerDpdpRoutes.js`). The public `@dpdpguard/convex/http` import
     subpath is unchanged — only the underlying `dist/component/` filename
     moved, updated in the package `exports` map.

## [0.4.0] - 2026-08-12

### Changed

- **`@dpdpguard/contract` ^1.4.0 → ^1.5.0** (OpenAPI 2.7.0 → 2.8.0).
  `scripts/codegen.mjs` regenerated `src/component/generated/api-types.ts`
  against the newer spec on install; `npm run typecheck`, `npm run build`,
  and the full test suite (13 files / 76 tests) all pass unchanged against
  it.

### Notes

- **Why minor, not patch.** The 1.4.0 → 1.5.0 contract diff is two things,
  not one:
  1. Two new read-only Consent Gate observability routes (`GET
     /api/v1/consent/gate/decisions`, `GET /api/v1/consent/gate/alerts`)
     and their two new schemas (`ConsentGateDecision`,
     `ConsentGateBypassAlert`) — an actual, if additive, shape change to the
     OpenAPI spec (classed `minor` under ADR-002 D4: "New endpoint |
     minor | additive").
  2. A documentation-only addition to `conformance/audit-hash-spec.md`
     (commit `f5f941c`, "record the audit-hash-spec key-versions section"),
     which adds prose about the existing key registry with no change to
     `conformance/audit-hash-vectors.json`, `capture-artifact-vectors.json`,
     or the `v1` canonicalization/algorithm — classed `patch` under D4 on
     its own, and confirmed not to trip ADR-002 D5's DPO-sign-off gate
     (D5 fires on a change to canonicalization or hash algorithm; neither
     changed).
  Because the release as a whole carries an actual (additive) shape change —
  not *only* documentation — this repo bumps **minor** (0.3.1 → 0.4.0) to
  match, per the guidance that a docs-only contract change stays patch and
  any real shape change goes minor.
- The two new observability routes are **not** bound to this component's
  client surface yet — this sync only updates the contract dependency and
  regenerates types. Wiring `dpdp.listConsentGateDecisions()` /
  `dpdp.listConsentGateAlerts()` is left for a follow-up change; see "Known
  gaps" in README.md.
- No audit-hash canonicalization or `ConsentRecord` shape changes; no DPO
  sign-off applies to this sync (ADR-002 D5).

## [0.3.1] - 2026-08-11

### Fixed

- **The published ESM was unimportable from Node.** `tsc` copies relative
  import specifiers through verbatim, so `import { receive } from './webhooks'`
  in `src/` shipped unchanged into `dist/`. Convex's own bundler resolves an
  extensionless specifier, but Node's ESM loader does not — and the package
  declares `"type": "module"`. Any host app that imported
  `@dpdpguard/convex/http` outside the Convex bundler (a Vitest suite, an SSR
  build, a codemod) died with `ERR_MODULE_NOT_FOUND` on
  `dist/component/webhooks` before reaching a line of component code.

  Every relative import and export in `src/` now carries an explicit `.js`
  extension. No runtime behaviour changes; the emitted module graph is the
  same one, addressed the way the loader requires.

  The repo's own tests never caught this because Vitest resolves the
  TypeScript sources, not `dist/` — so `src/packaging.test.ts` now asserts the
  invariant at the source level, where the mistake is actually made.

- **The contract's error catalog was imported without an import attribute.**
  `_lib/errorCatalog.ts` did `import catalog from
  '@dpdpguard/contract/conformance/error-catalog.json'`, which Node's ESM
  loader rejects with "needs an import attribute of type: json". Same root
  cause as the above and the same blast radius — the module is on the import
  path of every API call, so the whole component was unloadable outside the
  Convex bundler. Now carries `with { type: 'json' }`, which esbuild, tsc and
  Node all accept, and `packaging.test.ts` asserts that too.

## [0.3.0] - 2026-08-11

Brings the component up to the current published contract. It was pinned to
`@dpdpguard/contract` 1.2.0 (OpenAPI 2.4.1) and implemented only the
brokered-principal surface, so four contract releases' worth of
service-key routes — including every route added since 1.1.0 — had no
binding here at all.

### Changed

- **`@dpdpguard/contract` ^1.2.0 → ^1.4.0** (OpenAPI 2.4.1 → 2.7.0).
  Purely additive on the contract side, so nothing existing changed shape;
  `scripts/codegen.mjs` regenerates `src/component/generated/api-types.ts`
  against the newer spec on install.

### Added

- **Consent Gate** (`consentGate.ts`, `dpdp.verifyConsent()`) — wraps
  `POST /api/v1/consent/verify`. Ask immediately before acting on a
  principal's data and get back `allow`/`deny` derived from the consent
  record's own withdrawal state. Deliberately an action with no cache and no
  component table behind it: a locally remembered "they consented" is the
  exact failure the gate exists to remove, so a decision is never stored or
  subscribed to. A thrown `DpdpGuardApiError` should be treated as "do not
  process" — an unreachable gate is not consent.
- **Partner registers** (`partner.ts`) — `dpdp.listDueRetentions()`,
  `dpdp.listBreaches()`, `dpdp.listCrossBorderTransfers()`, over the three
  read-only B1 routes (`GET /api/v1/retention/due`, `/api/v1/breaches`,
  `/api/v1/cross-border/transfers`) that have been in the contract since
  1.1.0. Pass-through rather than cached: these are compliance registers a
  host app acts on now, and a stale local copy of "who is past their
  retention window" is worse than no copy. While a route's dpdpbot-side flag
  is off it 404s, which surfaces as a `DpdpGuardApiError` with code
  `NOT_FOUND` — distinct from an enabled route that legitimately has nothing
  to report.
- **Offline / physical capture** (`offline.ts`):
  - `dpdp.createOfflineConsentLink()` / `dpdp.listOfflineConsentLinks()` —
    mint an offline/QR consent link from a host system (HIS, POS, CBS) and
    find it again without re-minting.
  - `dpdp.syncOfflineCaptures()` / `dpdp.getOfflineCapture()` — push queued
    device-signed capture sessions and keep each session's outcome locally.
    Partial success is the normal case: a batch that resolves without
    throwing may still contain quarantined or rejected sessions, so callers
    must read each result's `status`. Results are stored keyed by
    `clientSessionId` — the contract's own idempotency key — so a device
    that loses connectivity mid-sync can ask what already committed instead
    of replaying blind.
  - `dpdp.createPosConsentRequest()` — a till raises an asynchronous request
    against a keyed-in phone number. The result is **not** a consent and
    nothing is recorded until the principal confirms on their own device.
  - `dpdp.recordIvrConsentArtifact()` — a telephony partner submits a
    completed call's artefact. `partnerCallId` is the idempotency key, so
    resubmitting one call returns the original artefact rather than
    materialising a second consent.
- **New isolated tables**: `offlineCaptures` (by `clientSessionId`) and
  `offlineConsentLinks` (by `linkId`). Additive — no existing table changed.
- Contract-derived response types re-exported from the package root
  (`ConsentGateDecision`, `OfflineCaptureSession`, `OfflineCaptureResult`,
  `IvrConsentArtifact`, …), inferred from the generated `operations` map
  rather than hand-written, so a future contract bump that reshapes one of
  them is a compile error here instead of a runtime surprise.
- 26 new tests across `consentGate.test.ts`, `partner.test.ts`,
  `offline.test.ts`, and the client-class suite.

### Fixed

- **`listOfflineConsentLinks` no longer reads the whole table.** It was an
  unbounded `.collect()` on a table that only grows (a branch mints a link
  per counter, per campaign, and nothing prunes them) behind a query the
  host app subscribes to — so every mint re-read and re-pushed the entire
  history to every subscriber. Now newest-first and bounded (100 default,
  500 max) over a new `by_createdAt` index.
- **The reconciliation cron no longer scans every link ever created.**
  `reconcile._listLinked` did `.collect()` on `consentLinks` and then
  filtered in JS, which reads revoked and long-expired rows in full every 30
  minutes to act on the live subset. It now selects through a new
  `by_status_and_expiresAt` index, descending, capped at 500 principals per
  run. Both fields are required on every row, so there is no
  undefined-vs-value hazard for an existing 0.2.x install.
- **Webhook idempotency is now actually atomic.** `webhooks.receive` read
  `_seen` in one transaction and inserted in another — a check-then-act
  window where two deliveries of the same event (dpdpbot retries anything it
  doesn't get a 200 for) could both observe "not seen" and both insert.
  Replaced with a single transactional `_claim` mutation that returns
  whether the caller won. `_markSeen` is gone; `_seen` remains for
  inspection.

- **The published tarball no longer ships the test suite.** `tsc -p .`
  compiled `*.test.ts` and `test-utils.ts` into `dist/`, so every release
  since 0.2.1 shipped 26 test artefacts to consumers — including
  `dist/test-utils.js`, which imports `convex-test`, a devDependency that is
  not installed in a consuming app. Builds now run against a new
  `tsconfig.build.json` that excludes them; `npm run typecheck` still covers
  the tests via the unchanged root `tsconfig.json`. 71 files / 48.3 kB → 45
  files / 40.0 kB.

### Notes

- `@dpdpguard/contract` 1.5.0 adds two further Consent Gate observability
  routes (`GET /api/v1/consent/gate/decisions` and `.../alerts`). They are
  not bound here yet — 1.4.0 is the newest version published to npm, and
  `scripts/codegen.mjs` reads the spec out of the installed package.

## [0.2.2] - 2026-08-01

### Fixed

- **NPM Provenance & Trusted Publishing**: Added `repository` metadata field to `package.json` to satisfy Sigstore provenance verification requirements in GitHub Actions NPM OIDC publishing workflow.

## [0.2.1] - 2026-08-01

### Added

- **Component Integration Tests**: Added full test suites for Convex component modules (`config`, `consent`, `dsr`, `grievances`, `nominations`, `notices`, `webhooks`) using `convex-test`.
- **CI Test Reliability**: Enhanced `scripts/codegen.mjs` to auto-generate `_generated` module stubs, enabling tests to pass cleanly in headless CI environments without requiring prior `npx convex dev`.
- **Coverage Thresholds**: Set non-zero test coverage thresholds in `vitest.config.ts` (Lines: 55%, Functions: 60%, Statements: 55%, Branches: 25%).

### Fixed

- Fixed ESLint parsing errors for root configuration files and added `src/component/_generated/**` to ESLint ignore patterns.
- Resolved `@typescript-eslint/unbound-method` false positives in test mock references.

## [0.2.0] - 2026-08-01

### Added

- **CI/CD Workflows**: Added GitHub Actions workflows for automated verification, quality checks, and npm publishing
  - `verify.yml`: Build, typecheck, lint, and test on push/PR across Node.js 20/22/24
  - `quality.yml`: Dependency audit and package hygiene checks
  - `publish.yml`: Trusted npm publishing via OIDC (no NPM_TOKEN required)
- **ESLint**: Configured ESLint 10 with TypeScript support and Prettier integration
  - Flat config format (`eslint.config.js`)
  - TypeScript-ESLint v8.65.0 with recommended and type-checked rules
  - Prettier for consistent code formatting
- **Linting Scripts**: Added `npm run lint` and `npm run lint:fix` commands
- **Dependency Updates**: Updated to latest stable versions
  - convex: ^1.43.0 (from ^1.16.0)
  - convex-test: ^0.0.54 (from ^0.0.32)
  - typescript: ^6.0.3 (from ^5.5.0)
  - vitest: ^4.1.10 (from ^2.0.0)
  - @dpdpguard/contract: ^1.2.0 (from ^1.0.1)
  - Added @types/node: ^20.11.0 for Node.js globals
  - Added prettier: ^3.4.2 for code formatting

### Fixed

- Removed unused import (`v` from 'convex/values') in `src/component/reconcile.ts`
- Auto-formatted code for consistency (quotes, trailing commas, line endings)

### Changed

- Updated peerDependencies: convex ^1.43.0 (from ^1.16.0)

## [0.1.0] - 2026-08-01

### Added

- Initial release of Convex Component for dpdpbot (DPDP Guard)
- Native Convex integration over the dpdpbot /api/v1 contract
- Client SDK with `DpdpGuard` class for dpdpClient initialization
- Cache-backed notice management (create, list, get, query)
- Webhook management (register, list, validate requests, dispatch events)
- Data Subject Request (DSR) support (delete subjects, query status)
- Nomination workflow (nominate, list, claim, fulfill)
- Grievance workflow (file, list, query, view history)
- Config management (get, create, query by company ID)
- Consent tracking (record consent, query consent status, retrieve consent receipts)
- Cron job support for periodic reconciliation
- Type-safe OpenAPI-generated API types from @dpdpguard/contract
- TypeScript support with strict mode enabled
- Vitest for unit testing
