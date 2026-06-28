import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { muteThreads } from './mute';
import commentsHtml from '../e2e/html/comments.html?raw';

const doc = (): Document => new JSDOM(commentsHtml).window.document;
const labels = (d: Document): string[] =>
  [...d.querySelectorAll('.vibeste-muted')].map((el) => el.textContent ?? '');

describe('muteThreads — whole thread (default)', () => {
  it('replaces a matching comment and all its replies with one placeholder', () => {
    const d = doc();
    const muted = muteThreads(d, { muteWords: ['vibecoding'], muteWholeThread: true });

    // A matches (subtree A+B); D matches (subtree D). C and E untouched.
    expect(muted).toBe(2);
    expect(d.querySelectorAll('.vibeste-muted').length).toBe(2);

    expect(d.querySelector('#c_aaa')).toBeNull(); // matched comment gone
    expect(d.querySelector('#c_bbb')).toBeNull(); // its reply gone too
    expect(d.querySelector('#c_ddd')).toBeNull(); // nested match gone
    expect(d.querySelector('#c_ccc')).not.toBeNull(); // its clean parent stays
    expect(d.querySelector('#c_eee')).not.toBeNull(); // non-match stays

    expect(labels(d)).toEqual(
      expect.arrayContaining([
        'muted conversation thread (2 comments)',
        'muted conversation thread (1 comment)',
      ]),
    );
  });

  it('restores the thread when the placeholder is clicked', () => {
    const d = doc();
    muteThreads(d, { muteWords: ['vibecoding'], muteWholeThread: true });

    d.querySelector<HTMLElement>('.vibeste-muted')!.click();

    expect(d.querySelector('#c_aaa')).not.toBeNull();
    expect(d.querySelector('#c_bbb')).not.toBeNull();
    expect(d.querySelectorAll('.vibeste-muted').length).toBe(1); // D's still muted
  });

  it('does not re-mute a thread the user explicitly revealed', () => {
    const d = doc();
    const opts = { muteWords: ['vibecoding'], muteWholeThread: true };
    muteThreads(d, opts);
    d.querySelector<HTMLElement>('.vibeste-muted')!.click();

    muteThreads(d, opts); // e.g. settings changed → re-applied

    expect(d.querySelector('#c_aaa')).not.toBeNull();
  });
});

describe('muteThreads — comment only', () => {
  it('mutes just the matching comment, leaving its replies visible', () => {
    const d = doc();
    const muted = muteThreads(d, { muteWords: ['vibecoding'], muteWholeThread: false });

    expect(muted).toBe(2); // A and D
    expect(d.querySelector('#c_aaa')).toBeNull(); // comment muted
    expect(d.querySelector('#c_bbb')).not.toBeNull(); // reply stays visible
    expect(new Set(labels(d))).toEqual(new Set(['muted comment']));
  });
});

describe('muteThreads — matching rules', () => {
  it('is whole-word and case-insensitive ("ai" must not match "email")', () => {
    expect(muteThreads(doc(), { muteWords: ['ai'], muteWholeThread: true })).toBe(0);
  });

  it('does nothing when there are no mute words', () => {
    expect(muteThreads(doc(), { muteWords: [], muteWholeThread: true })).toBe(0);
    expect(muteThreads(doc(), { muteWords: ['  '], muteWholeThread: true })).toBe(0);
  });

  it('is idempotent across repeated runs', () => {
    const d = doc();
    const opts = { muteWords: ['vibecoding'], muteWholeThread: true };
    expect(muteThreads(d, opts)).toBe(2);
    expect(muteThreads(d, opts)).toBe(0); // nothing left to mute
    expect(d.querySelectorAll('.vibeste-muted').length).toBe(2);
  });
});
