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
