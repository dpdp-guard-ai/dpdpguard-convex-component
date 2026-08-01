# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
