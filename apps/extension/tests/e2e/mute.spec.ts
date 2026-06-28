import { test, expect, html, serve } from './fixtures';

test('mutes a comment thread mentioning vibecoding and restores it on click', async ({
  context,
}) => {
  const page = await context.newPage();
  await serve(page, html('comments.html'));
  await page.goto('https://lobste.rs/s/story1/a_story');

  const placeholders = page.locator('.vibeste-muted');
  await expect(placeholders.first()).toBeVisible();

  // The matching comment (and its reply) are removed behind the placeholder.
  await expect(page.locator('#c_aaa')).toHaveCount(0);
  await expect(page.locator('#c_bbb')).toHaveCount(0);

  // Clicking the placeholder restores the thread.
  await placeholders.first().click();
  await expect(page.locator('#c_aaa')).toHaveCount(1);
  await expect(page.locator('#c_bbb')).toHaveCount(1);
});

test('mutes a real lobste.rs thread (/c/jm2ivd) with the default settings', async ({
  context,
}) => {
  const page = await context.newPage();
  await serve(page, html('oxide-rack-thread.html'));
  await page.goto('https://lobste.rs/s/y0sy74/oxide_rack_3d_explorer');

  // The defaults include the "videcoding" misspelling, so jm2ivd itself matches —
  // and because it's the top of the sub-thread, its entire subtree (10 comments)
  // collapses into a single placeholder.
  const muted = page.locator('.vibeste-muted');
  await expect(muted).toHaveCount(1);
  await expect(muted).toHaveText('muted conversation thread (10 comments)');
  await expect(page.locator('#c_jm2ivd')).toHaveCount(0);
  await expect(page.locator('#c_xswghd')).toHaveCount(0);
  // Unrelated top-level comments are untouched.
  await expect(page.locator('#c_bpkgjb')).toHaveCount(1);

  // Clicking restores the whole thread.
  await muted.click();
  for (const id of ['#c_jm2ivd', '#c_z9b9ca', '#c_xswghd', '#c_twp4bl', '#c_flsolf']) {
    await expect(page.locator(id)).toHaveCount(1);
  }
});
