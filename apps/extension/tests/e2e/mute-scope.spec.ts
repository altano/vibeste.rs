import { test, expect, html, serve, optionsUrl } from "./fixtures";
import type { Page } from "@playwright/test";

// Drives the Mute scope toggle against a single open comment thread, asserting
// the rendered DOM after the initial load, after switching to comment-only, and
// after switching back to whole-thread. The fixture tree (★ = matches the
// default mute words):
//
//   root  ★
//   ├─ ch1  ★
//   │  ├─ gc1
//   │  └─ gc2  ★
//   └─ ch2
//      ├─ gc3  ★
//      └─ gc4
//
// The matching comments are scattered across depths and branches so the two
// scopes produce clearly different DOM: whole-thread collapses everything under
// the topmost match (root) into one placeholder, whereas comment-only mutes
// each matching comment on its own and leaves the non-matching ones in place.

// The extension API global, available inside page.evaluate on extension pages.
declare const chrome: {
  storage: { sync: { get(key: string): Promise<Record<string, unknown>> } };
};

/** Open the options page and wait for its async load() to hydrate the form. */
async function openOptions(page: Page): Promise<void> {
  await page.goto(optionsUrl);
  await expect(page.locator("html[data-vibesters-ready]")).toHaveCount(1);
}

/** Wait until the options page's auto-save has committed `expected` to storage. */
async function expectStored(
  page: Page,
  expected: Record<string, unknown>,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        chrome.storage.sync.get("settings").then((r) => r.settings),
      ),
    )
    .toMatchObject(expected);
}

const ALL = ["root", "ch1", "gc1", "gc2", "ch2", "gc3", "gc4"];
const MATCHING = ["root", "ch1", "gc2", "gc3"];
const NON_MATCHING = ["gc1", "ch2", "gc4"];

const present = (page: Page, ids: string[]) =>
  Promise.all(
    ids.map((id) => expect(page.locator(`#c_${id}`)).toHaveCount(1)),
  );
const absent = (page: Page, ids: string[]) =>
  Promise.all(
    ids.map((id) => expect(page.locator(`#c_${id}`)).toHaveCount(0)),
  );

test("switching Mute scope re-renders an open thread between whole-thread and comment-only", async ({
  context,
}) => {
  const story = await context.newPage();
  await serve(story, html("nested-thread.html"));
  await story.goto("https://lobste.rs/s/story1/a_nested_thread");

  const muted = story.locator(".vibesters-muted");

  // (1) Default options (whole-thread): root is the topmost match, so its entire
  // subtree — all seven comments — collapses behind a single placeholder.
  await expect(muted).toHaveCount(1);
  await expect(muted).toHaveText("muted conversation thread (7 comments)");
  await absent(story, ALL);

  // (2) Switch to comment-only: each matching comment is muted on its own, and
  // the non-matching comments around them stay visible.
  const options = await context.newPage();
  await openOptions(options);
  await options.locator("#muteWholeThread").uncheck();
  await expectStored(options, { muteWholeThread: false });

  await expect(muted).toHaveCount(4);
  await expect(muted).toHaveText([
    "muted comment",
    "muted comment",
    "muted comment",
    "muted comment",
  ]);
  await absent(story, MATCHING);
  await present(story, NON_MATCHING);

  // (3) Switch back to whole-thread: the open thread collapses again to the
  // single seven-comment placeholder.
  await options.locator("#muteWholeThread").check();
  await expectStored(options, { muteWholeThread: true });

  await expect(muted).toHaveCount(1);
  await expect(muted).toHaveText("muted conversation thread (7 comments)");
  await absent(story, ALL);
});
