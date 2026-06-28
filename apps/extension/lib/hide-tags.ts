/**
 * Build a stylesheet that hides the given tags *only where they annotate a
 * story*.
 *
 * On lobste.rs a story's tags live in `<span class="tags"><a class="tag
 * tag_<slug>">`, while the Filtered Tags management UI at `/filters` wraps each
 * tag in a `<td>`. Selecting `span.tags > a.tag_<slug>` therefore hides article
 * annotations everywhere they appear (home, story, tag pages) and never touches
 * the filters UI — no URL sniffing or JavaScript required.
 *
 * Returns an empty string when there is nothing to hide.
 */
export function buildHideTagsCss(tags: string[]): string {
  const selectors = hideTagSelectors(tags);
  if (selectors.length === 0) return "";
  return `${selectors.join(",\n")} {\n  display: none !important;\n}\n`;
}

/**
 * The CSS selectors used to hide each tag. Exposed so behaviour can be asserted
 * directly (`querySelectorAll`) against captured HTML.
 */
export function hideTagSelectors(tags: string[]): string[] {
  return normalizeTags(tags).map(
    (slug) => `span.tags > a.${cssEscapeClass(`tag_${slug}`)}`,
  );
}

/**
 * The configured tags to hide on the page at `pathname` — every hidden tag,
 * minus any the current tag page is scoped to.
 *
 * Opening `/t/vibecoding` is an explicit request to browse that tag, so leaving
 * its annotation visible *there* is more useful than hiding it. It stays hidden
 * everywhere else (home, story pages, and other tag pages). This is the one
 * place the feature needs to know the URL — the hiding itself is still pure CSS.
 */
export function tagsToHideOn(pathname: string, hiddenTags: string[]): string[] {
  const shown = new Set(tagPageSlugs(pathname));
  return normalizeTags(hiddenTags).filter((slug) => !shown.has(slug));
}

/**
 * The tag slugs a lobste.rs tag page is scoped to, parsed from its path.
 *
 * Tag pages live at `/t/<slug>`, with multi-tag views at `/t/<slug>,<slug>` and
 * pagination at `/t/<slug>/page/2`. Returns the lower-cased slugs for any such
 * path, or an empty array for every other page.
 */
export function tagPageSlugs(pathname: string): string[] {
  const segment = /^\/t\/([^/]+)/.exec(pathname)?.[1];
  if (!segment) return [];
  return normalizeTags(segment.split(","));
}

/** Lower-case, trim, and de-duplicate tag slugs (lobsters slugs are lowercase). */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const slug = tag.trim().toLowerCase();
    if (slug) seen.add(slug);
  }
  return [...seen];
}

/** Escape a string for use in a CSS class selector (e.g. `tag_c++`). */
function cssEscapeClass(name: string): string {
  // Prefer the platform implementation (present in browsers and jsdom).
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  if (css && typeof css.escape === "function") return css.escape(name);
  // Minimal fallback: backslash-escape anything outside a CSS identifier.
  return name.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}
