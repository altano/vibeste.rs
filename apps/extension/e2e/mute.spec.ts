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

test('mutes a real lobste.rs thread (/c/jm2ivd) and restores a collapsed subtree', async ({
  context,
}) => {
  const page = await context.newPage();
  await serve(page, html('oxide-rack-thread.html'));
  await page.goto('https://lobste.rs/s/y0sy74/oxide_rack_3d_explorer');

  // Default whole-thread mode: 3 matching subtrees collapse; the "videcoding"
  // typo comment (jm2ivd) is left alone.
  await expect(page.locator('.vibeste-muted')).toHaveCount(3);
  await expect(page.locator('#c_jm2ivd')).toHaveCount(1);
  await expect(page.locator('#c_xswghd')).toHaveCount(0);

  // The xswghd subtree (xswghd + twp4bl + v5cgxa + flsolf) is one placeholder.
  const subtree = page.getByText('muted conversation thread (4 comments)');
  await expect(subtree).toBeVisible();
  await subtree.click();
  for (const id of ['#c_xswghd', '#c_twp4bl', '#c_v5cgxa', '#c_flsolf']) {
    await expect(page.locator(id)).toHaveCount(1);
  }
});
