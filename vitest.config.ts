import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mock*',
        '**/test*',
        'src/@types/**',
        'src/component/_generated/**',
        'src/component/generated/**',
      ],
      thresholds: {
        lines: 55,
        functions: 60,
        branches: 25,
        statements: 55,
      },
    },
  },
});
