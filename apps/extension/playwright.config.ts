import { defineConfig } from '@playwright/test';

// E2E loads the built Chromium MV3 extension into a persistent context (see
// e2e/fixtures.ts). Firefox is validated separately via `web-ext lint`; Safari
// is build-only. Run `pnpm build` before `pnpm e2e`.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // Extensions require a persistent context, which can't be shared across
  // parallel workers cleanly — keep it serial.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'https://lobste.rs',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium' }],
});
