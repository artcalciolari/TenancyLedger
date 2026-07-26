import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/api/problem.ts',
        'src/api/openapi-client.ts',
        'src/lib/**/*.ts',
        'src/app/theme/theme.ts',
        'src/components/feedback/AppErrorBoundary.tsx',
        'src/modules/auth/AuthProvider.tsx',
        'src/modules/contracts/filters.ts',
        'src/modules/invoices/filters.ts',
        'src/modules/invoices/SubmitPaymentDialog.tsx',
      ],
      exclude: ['src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
