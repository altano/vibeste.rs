import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settings, DEFAULT_SETTINGS, parseList, formatList } from '../../lib/settings';

describe('parseList / formatList', () => {
  it('parses lines, trims, drops blanks and de-duplicates', () => {
    expect(parseList('a\n b \n\na\n')).toEqual(['a', 'b']);
  });

  it('round-trips a list', () => {
    expect(parseList(formatList(['x', 'y']))).toEqual(['x', 'y']);
  });
});

describe('settings storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('falls back to working defaults (vibecoding, whole-thread)', async () => {
    expect(await settings.getValue()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists changes', async () => {
    const next = { hiddenTags: ['ai'], muteWords: ['slop'], muteWholeThread: false };
    await settings.setValue(next);
    expect(await settings.getValue()).toEqual(next);
  });
});
