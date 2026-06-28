import { storage } from '#imports';

export interface Settings {
  /** Tag slugs to hide where they annotate a story, e.g. `"vibecoding"`. */
  hiddenTags: string[];
  /** Words/phrases that cause a comment (sub)thread to be muted. */
  muteWords: string[];
  /**
   * `true`  → mute the matching comment *and its whole reply subtree* (default).
   * `false` → mute only the matching comment, leaving its replies visible.
   */
  muteWholeThread: boolean;
}

/** Ships working out of the box: hides + mutes `vibecoding`, whole-thread. */
export const DEFAULT_SETTINGS: Settings = {
  hiddenTags: ['vibecoding'],
  muteWords: ['vibecoding'],
  muteWholeThread: true,
};

/**
 * A single `storage.sync` item keeps the three fields atomic and well within
 * the per-item sync quota. Settings never leave the browser's own sync.
 */
export const settings = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

/** Parse a textarea (one entry per line) into a trimmed, de-duplicated list. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const value = line.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

/** Render a list back into textarea text (one entry per line). */
export function formatList(list: string[]): string {
  return list.join('\n');
}
