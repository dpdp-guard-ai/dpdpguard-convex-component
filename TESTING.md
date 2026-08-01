# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit testing with full TypeScript support.

## Quick Start

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests with UI dashboard
npm run test:ui
```

## Test Structure

Tests are colocated with source files using the `.test.ts` pattern:

```
src/
  client/
    index.ts           # Source code
    index.test.ts      # Tests
  test-utils.ts        # Shared test utilities
```

## Writing Tests

### Basic Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { DpdpGuard } from './index';

describe('DpdpGuard', () => {
  it('should create an instance', () => {
    const component = { /* mock */ };
    const dpdp = new DpdpGuard(component);
    expect(dpdp).toBeInstanceOf(DpdpGuard);
  });
});
```

### Using Test Utilities

The project provides helper functions for common test scenarios:

```typescript
import { createMockConvexClient, createMockQuery } from '../test-utils';

const mockClient = createMockConvexClient();
const mockQuery = createMockQuery({ data: 'test' });
```

### Mocking Convex Context

When testing code that uses Convex contexts:

```typescript
import type { GenericMutationCtx } from 'convex/server';

const mockCtx: GenericMutationCtx<any> = {
  runMutation: vi.fn().mockResolvedValue({ success: true }),
  // ... other context methods
} as any;
```

## Configuration

Vitest is configured in [`vitest.config.ts`](./vitest.config.ts):

- **Environment**: Node.js
- **Globals**: Enabled (no need to import `describe`, `it`, `expect`)
- **Coverage Provider**: V8 (industry-standard, fast)
- **Reporter**: Text, JSON, HTML, LCOV

### Coverage Goals

Currently, thresholds are set to 0% to allow gradual improvement. To increase thresholds:

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,      // Require 80% line coverage
    functions: 80,
    branches: 75,
    statements: 80,
  }
}
```

## Best Practices

### 1. **Test Behavior, Not Implementation**

❌ Bad:
```typescript
it('should call runMutation', () => {
  dpdp.configure(ctx, args);
  expect(ctx.runMutation).toHaveBeenCalled();
});
```

✅ Good:
```typescript
it('should configure the DpdpGuard with provided settings', async () => {
  const result = await dpdp.configure(ctx, args);
  expect(result).toEqual({ success: true });
});
```

### 2. **Use Descriptive Names**

❌ Bad: `test1`, `should work`, `edge case`

✅ Good: `should create a grievance with valid args`, `should reject invalid DSR type`

### 3. **Keep Tests Focused**

Each test should verify a single behavior. Use multiple focused tests instead of one broad test.

### 4. **Mock External Dependencies**

Mock Convex contexts, the component API, and external services. Only test the code you control.

### 5. **Use `beforeEach` for Setup**

```typescript
describe('DpdpGuard', () => {
  let mockCtx: GenericMutationCtx<any>;

  beforeEach(() => {
    mockCtx = {
      runMutation: vi.fn().mockResolvedValue({ success: true }),
    } as any;
  });

  it('should work with prepared context', async () => {
    // mockCtx is fresh for each test
  });
});
```

## Debugging Tests

### Run a Single Test File

```bash
npx vitest src/client/index.test.ts
```

### Run Tests Matching a Pattern

```bash
npx vitest --grep "should create"
```

### Run with Debug Output

```bash
npx vitest --reporter=verbose
```

### Use `it.only` and `it.skip`

```typescript
it.only('focus on this test', () => {
  // Only this test runs
});

it.skip('skip this for now', () => {
  // This test is skipped
});
```

## Coverage Reports

Coverage reports are generated in `coverage/` directory:

- **`coverage/index.html`** — Interactive HTML report
- **`coverage/coverage-final.json`** — Machine-readable format
- **`coverage/lcov.info`** — LCOV format for CI integration

Open the HTML report in a browser:

```bash
open coverage/index.html
```

## CI Integration

Tests run automatically in CI:

- **On Push/PR**: Full test suite runs (`npm run test`)
- **With Coverage**: `npm run test:coverage` (coverage threshold checks)

See [`.github/workflows/verify.yml`](.github/workflows/verify.yml) for details.

## Troubleshooting

### TypeScript Errors in Tests

Ensure `vitest.config.ts` is in the project root and includes proper TypeScript configuration.

### Module Resolution Issues

Check that `tsconfig.json` includes the test files:

```json
{
  "include": ["src/**/*.ts", "src/**/*.test.ts"]
}
```

### Coverage Not Generating

- Ensure `@vitest/coverage-v8` is installed: `npm install --save-dev @vitest/coverage-v8@^4.1.10`
- Run with `npm run test:coverage` (not just `npm run test`)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Library Patterns](https://testing-library.com/docs/)
- [Convex Testing Guide](https://docs.convex.dev/testing)
