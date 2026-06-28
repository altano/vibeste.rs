import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up WXT's aliases (`@/*`, `#imports`) and replaces the
// `browser` global with an in-memory fake (`wxt/testing/fake-browser`) so
// storage-backed code can be unit-tested without a real browser.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.ts'],
    globals: true,
  },
});
