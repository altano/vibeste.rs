import { test, expect, html, serve, optionsUrl } from "./fixtures";
import type { Page } from "@playwright/test";

// End-to-end coverage for every change the options page lets a user make —
// editing Hidden tags, editing Muted words, toggling Mute scope, and Reset to
// defaults — asserting both that the value persists and that an actual
// lobste.rs page reflects it. The content script reads the same `storage.sync`
// item, so options ↔ content share state within the persistent context.

// The extension API global, available inside page.evaluate on extension pages.
declare const chrome: {
  storage: { sync: { get(key: string): Promise<Record<string, unknown>> } };
};

/** Open the options page and wait for its async load() to hydrate the form. */
async function openOptions(page: Page): Promise<void> {
  await page.goto(optionsUrl);
  // Editing before hydration races load() and can corrupt fields; the page
  // sets this marker once the form reflects stored settings.
  await expect(page.locator("html[data-vibesters-ready]")).toHaveCount(1);
}

/**
 * Wait until the options page's auto-save has committed the expected fields to
 * `storage.sync`. Polling the stored value (rather than the brief "Saved"
 * flash) is the deterministic signal that a freshly navigated lobste.rs page
 * will read the new settings.
 */
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

test("loads the current (default) settings into the form", async ({
  context,
}) => {
  const options = await context.newPage();
  await openOptions(options);

  // Defaults: hide `vibecoding`, mute its variants, whole-thread on.
  await expect(options.locator("#hiddenTags")).toHaveValue("vibecoding");
  await expect(options.locator("#muteWords")).toHaveValue(/^vibecoding$/m);
  await expect(options.locator("#muteWords")).toHaveValue(/^vibe coding$/m);
  await expect(options.locator("#muteWholeThread")).toBeChecked();
});

test("editing Hidden tags changes which tags hide on lobste.rs", async ({
  context,
}) => {
  const options = await context.newPage();
  await openOptions(options);

  // Replace the hidden-tag list: hide `ai`, stop hiding `vibecoding`.
  await options.locator("#hiddenTags").fill("ai");
  await expectStored(options, { hiddenTags: ["ai"] });

  const home = await context.newPage();
  await serve(home, html("home.html"));
  await home.goto("https://lobste.rs/");

  // `ai` is now hidden; `vibecoding` (dropped from the list) is shown again.
  await expect(home.locator("span.tags > a.tag_ai").first()).toBeHidden();
  await expect(
    home.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeVisible();
  await expect(
    home.locator("span.tags > a.tag_security").first(),
  ).toBeVisible();
});

test("editing Muted words changes which comments are muted", async ({
  context,
}) => {
  const options = await context.newPage();
  await openOptions(options);

  // Replace the mute list with a word only the "distributed systems" comment has.
  await options.locator("#muteWords").fill("systems");
  await expectStored(options, { muteWords: ["systems"] });

  const story = await context.newPage();
  await serve(story, html("comments.html"));
  await story.goto("https://lobste.rs/s/story1/a_story");

  // carol's "distributed systems" thread is muted; the vibecoding comment is
  // not (its words are no longer in the list).
  const muted = story.locator(".vibesters-muted");
  await expect(muted).toHaveCount(1);
  await expect(story.locator("#c_ccc")).toHaveCount(0);
  await expect(story.locator("#c_ddd")).toHaveCount(0);
  await expect(story.locator("#c_aaa")).toHaveCount(1);
});

test("turning off Mute scope mutes only the matching comment, not replies", async ({
  context,
}) => {
  const options = await context.newPage();
  await openOptions(options);

  // Keep the default mute words but switch from whole-thread to comment-only.
  await options.locator("#muteWholeThread").uncheck();
  await expectStored(options, { muteWholeThread: false });
  await expect(options.locator("#muteWholeThread")).not.toBeChecked();

  const story = await context.newPage();
  await serve(story, html("comments.html"));
  await story.goto("https://lobste.rs/s/story1/a_story");

  // Each matching comment is muted on its own; replies/parents stay visible —
  // contrast the whole-thread default, which collapses the subtree (mute.spec).
  await expect(story.locator(".vibesters-muted")).toHaveCount(2);
  await expect(story.locator("#c_aaa")).toHaveCount(0); // matches → muted
  await expect(story.locator("#c_bbb")).toHaveCount(1); // its reply stays
  await expect(story.locator("#c_ddd")).toHaveCount(0); // matches → muted
  await expect(story.locator("#c_ccc")).toHaveCount(1); // its parent stays
});

test("Reset to defaults restores the shipped settings", async ({ context }) => {
  const options = await context.newPage();
  await openOptions(options);

  // Drift every field away from the defaults.
  await options.locator("#hiddenTags").fill("ai");
  await options.locator("#muteWords").fill("systems");
  await options.locator("#muteWholeThread").uncheck();
  await expectStored(options, {
    hiddenTags: ["ai"],
    muteWords: ["systems"],
    muteWholeThread: false,
  });
  await expect(options.locator("#hiddenTags")).toHaveValue("ai");

  await options.locator("#reset").click();

  // The form is repopulated from DEFAULT_SETTINGS...
  await expect(options.locator("#hiddenTags")).toHaveValue("vibecoding");
  await expect(options.locator("#muteWords")).toHaveValue(/^vibecoding$/m);
  await expect(options.locator("#muteWholeThread")).toBeChecked();

  // ...and the reset is persisted: a fresh page hides the vibecoding tag again.
  const home = await context.newPage();
  await serve(home, html("home.html"));
  await home.goto("https://lobste.rs/");
  await expect(
    home.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeHidden();
});

test("settings persist across reopening the options page", async ({
  context,
}) => {
  const first = await context.newPage();
  await openOptions(first);
  await first.locator("#hiddenTags").fill("ai\nrust");
  await expectStored(first, { hiddenTags: ["ai", "rust"] });
  await first.close();

  // A new options tab reads the saved value back via load().
  const second = await context.newPage();
  await openOptions(second);
  await expect(second.locator("#hiddenTags")).toHaveValue("ai\nrust");
});

test("changes apply immediately to an already-open lobste.rs tab", async ({
  context,
}) => {
  // Open the home page first; the vibecoding tag starts hidden by default.
  const home = await context.newPage();
  await serve(home, html("home.html"));
  await home.goto("https://lobste.rs/");
  await expect(
    home.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeHidden();

  // Clear Hidden tags in a separate options tab — no reload of the home tab.
  const options = await context.newPage();
  await openOptions(options);
  await options.locator("#hiddenTags").fill("");
  await expectStored(options, { hiddenTags: [] });

  // The content script's storage watcher re-renders the stylesheet live.
  await expect(
    home.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeVisible();
});
