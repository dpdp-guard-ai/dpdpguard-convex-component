# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
