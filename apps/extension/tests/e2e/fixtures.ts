import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The built, unpacked Chromium MV3 extension. Run `pnpm build` first.
const EXTENSION_PATH = fileURLToPath(
  new URL("../../.output/chrome-mv3", import.meta.url),
);

/**
 * Chromium derives an unpacked extension's ID deterministically from its
 * absolute load path: sha256(path), take the first 16 bytes (32 hex nibbles),
 * and map each nibble 0–f to a–p. This extension has no background worker, so
 * there is no service worker to read the runtime ID from — deriving it lets us
 * address internal pages like `optionsUrl` without one.
 */
export const EXTENSION_ID = ((): string => {
  const hex = createHash("sha256")
    .update(EXTENSION_PATH)
    .digest("hex")
    .slice(0, 32);
  return [...hex]
    .map((c) => String.fromCharCode(parseInt(c, 16) + "a".charCodeAt(0)))
    .join("");
})();

/** Full URL of the extension's options page (entrypoints/options/index.html). */
export const optionsUrl = `chrome-extension://${EXTENSION_ID}/options.html`;

/** Read a captured HTML fixture from tests/fixtures/html/. */
export const html = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/html/${name}`, import.meta.url)),
    "utf8",
  );

/**
 * Serve `body` for the page's top-level navigation and block every sub-resource,
 * so tests run offline and deterministically. Because the URL is still
 * `lobste.rs`, the extension's content script matches and runs against it.
 */
export async function serve(page: Page, body: string): Promise<void> {
  await page.route("**/*", (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({ contentType: "text/html", body })
      : route.abort(),
  );
}

// Extensions must be loaded into a persistent context. This extension has no
// background worker (storage + content script only), so tests assert on page
// DOM rather than waiting for a service worker.
export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium", // new headless Chromium supports loading extensions
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },
});

export const expect = test.expect;
