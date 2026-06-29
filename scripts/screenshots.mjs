// Regenerate the marketing screenshots on apps/website.
//
// Loads the built Chromium MV3 extension against the captured lobste.rs HTML
// fixtures (apps/extension/tests/fixtures/html). Unlike the e2e tests — which
// block every sub-resource for determinism — this lets stylesheet / font / image
// requests reach the live site, so the pages render with real lobste.rs styling.
//
// Prereqs: `pnpm -C apps/extension build` (for .output/chrome-mv3) and network
// access to lobste.rs. Run from the repo root:  node scripts/screenshots.mjs
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSION_PATH = fileURLToPath(
  new URL("../apps/extension/.output/chrome-mv3", import.meta.url),
);
const FIXTURES = new URL(
  "../apps/extension/tests/fixtures/html/",
  import.meta.url,
);
const OUT =
  process.env.SHOTS_OUT ??
  fileURLToPath(new URL("../apps/website/screenshots", import.meta.url));
mkdirSync(OUT, { recursive: true });

// Chromium derives an unpacked extension's ID deterministically from its load
// path: sha256(path), first 16 bytes, each nibble 0–f mapped to a–p. We need it
// to address the extension's own options.html (there is no background worker to
// read a runtime ID from). Mirrors tests/e2e/fixtures.ts.
const EXTENSION_ID = (() => {
  const hex = createHash("sha256")
    .update(EXTENSION_PATH)
    .digest("hex")
    .slice(0, 32);
  return [...hex]
    .map((c) => String.fromCharCode(parseInt(c, 16) + "a".charCodeAt(0)))
    .join("");
})();
const optionsUrl = `chrome-extension://${EXTENSION_ID}/options.html`;

const html = (name) => readFileSync(new URL(name, FIXTURES), "utf8");

// Serve the fixture for the top-level document; let styling sub-resources load
// live from lobste.rs; block scripts/xhr so the page stays static.
async function serveStyled(page, body) {
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "document")
      return route.fulfill({ contentType: "text/html", body });
    if (t === "stylesheet" || t === "font" || t === "image")
      return route.continue();
    return route.abort();
  });
}

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
  ],
  viewport: { width: 1000, height: 1400 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});

const settle = async (page) => {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle").catch(() => {});
};

// 1) Muting a comment thread — before (the full conversation) and after (it
//    collapsed to a single link), framed identically so they read as a pair.
{
  const page = await context.newPage();
  await serveStyled(page, html("oxide-rack-thread.html"));
  await page.goto("https://lobste.rs/s/y0sy74/oxide_rack_3d_explorer");
  await settle(page);
  const muted = page.locator(".vibesters-muted").first();
  await muted.waitFor();

  const list = await page.locator("#story_comments").boundingBox();
  // Shared horizontal framing: the full comment column (+ a small margin) so the
  // expanded "before" text never clips, and both shots line up as a pair.
  const clipX = Math.floor(list.x - 8);
  const clipW = Math.ceil(list.width + 16);
  // How much of the preceding comment to show above the muted thread, for context.
  const CONTEXT = 250;

  // After: the muted placeholder, with a real comment above it. Captured first,
  // before we reveal the thread for the "before" shot below.
  const box = await muted.boundingBox();
  const afterTop = Math.max(list.y, box.y - CONTEXT);
  await page.screenshot({
    path: `${OUT}/muted-after.png`,
    clip: {
      x: clipX,
      y: Math.floor(afterTop),
      width: clipW,
      // Stop just below the muted link so the next comment doesn't bleed in.
      height: Math.ceil(box.y + box.height + 10 - afterTop),
    },
  });

  // Before: click the placeholder to restore the original thread (the extension's
  // own reveal restores the exact saved DOM), then capture the same column with
  // the full conversation expanded.
  const subtree = await (
    await muted.elementHandle()
  ).evaluateHandle((el) => el.closest("li.comments_subtree"));
  await muted.click();
  await page.waitForFunction(
    (el) => !!el.querySelector("div.comment"),
    subtree,
  );
  // Revealed comments pull in avatars etc.; let them load so the box is final.
  await settle(page);
  let sbox = await subtree.asElement().boundingBox();
  // The expanded thread runs past the 1400px viewport, and page.screenshot clamps
  // a clip to the viewport — so grow the viewport to fit before capturing. Width
  // is unchanged, so comment wrapping (and every y position) stays put.
  await page.setViewportSize({
    width: 1000,
    height: Math.ceil(sbox.y + sbox.height + 40),
  });
  await settle(page);
  sbox = await subtree.asElement().boundingBox();
  const beforeTop = Math.max(list.y, sbox.y - CONTEXT);
  await page.screenshot({
    path: `${OUT}/muted-before.png`,
    clip: {
      x: clipX,
      y: Math.floor(beforeTop),
      width: clipW,
      height: Math.ceil(sbox.y + sbox.height + 10 - beforeTop),
    },
  });
  await page.close();
}

// 2) Tag hiding — before (tag visible on /t/vibecoding) and after (hidden on /).
async function tagShot(name, url) {
  const page = await context.newPage();
  await serveStyled(page, html("home.html"));
  await page.goto(url);
  await settle(page);
  const story = page
    .locator(".story_liner:has(a.tag_security):has(a.tag_vibecoding)")
    .first();
  await story.scrollIntoViewIfNeeded();
  await story.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
}
await tagShot("tag-before", "https://lobste.rs/t/vibecoding");
await tagShot("tag-after", "https://lobste.rs/");

// 3) Settings / options page.
{
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.locator("html[data-vibesters-ready]").waitFor();
  await page.locator("body").screenshot({ path: `${OUT}/settings.png` });
  await page.close();
}

await context.close();
console.log(`Wrote screenshots to ${OUT}`);
