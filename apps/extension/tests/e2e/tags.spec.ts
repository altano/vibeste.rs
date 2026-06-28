import { test, expect, html, serve } from "./fixtures";

test("hides the vibecoding tag where it annotates a story", async ({
  context,
}) => {
  const page = await context.newPage();
  await serve(page, html("home.html"));
  await page.goto("https://lobste.rs/");

  // The tag is present in the DOM but hidden by our injected stylesheet.
  await expect(
    page.locator("span.tags > a.tag_vibecoding").first(),
  ).toHaveCount(1);
  await expect(
    page.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeHidden();
  // Other tags are unaffected.
  await expect(
    page.locator("span.tags > a.tag_security").first(),
  ).toBeVisible();
});

test("leaves the vibecoding tag visible on its own tag page", async ({
  context,
}) => {
  const page = await context.newPage();
  // Same story markup as the home page; only the URL differs. The tag is hidden
  // on `/` but should stay visible when browsing `/t/vibecoding` directly.
  await serve(page, html("home.html"));
  await page.goto("https://lobste.rs/t/vibecoding");

  await expect(
    page.locator("span.tags > a.tag_vibecoding").first(),
  ).toBeVisible();
});

test("does not touch the vibecoding tag in the Filtered Tags UI", async ({
  context,
}) => {
  const page = await context.newPage();
  await serve(page, html("filters.html"));
  await page.goto("https://lobste.rs/filters");

  await expect(page.locator("a.tag_vibecoding").first()).toBeVisible();
});
