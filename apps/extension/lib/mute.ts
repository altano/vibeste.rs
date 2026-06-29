/**
 * Mute lobste.rs comment threads whose text contains configured words.
 *
 * lobste.rs comment markup (verified against live HTML):
 *
 *   <li class="comments_subtree">
 *     <input class="comment_folder_button" type="checkbox">
 *     <div class="comment" data-shortid="…">
 *       …<div class="comment_text"> the body </div>…
 *     </div>
 *     <ol class="comments">        <!-- replies, optional -->
 *       <li class="comments_subtree">…</li>
 *     </ol>
 *   </li>
 *
 * A comment's *own* text is `.comment_text` inside its `div.comment`; replies
 * live in a sibling `<ol class="comments">`, so they are never descendants of
 * the comment's own `div.comment`. This makes "mute whole subtree" vs "mute
 * only this comment" a clean structural distinction.
 *
 * Pure DOM in / DOM mutations out (operates on a `Document`), so it is unit
 * tested against captured fixtures with no browser involved.
 */

export interface MuteOptions {
  muteWords: string[];
  /** Whole reply subtree (true) vs. only the matching comment (false). */
  muteWholeThread: boolean;
}

const PLACEHOLDER_CLASS = "vibesters-muted";
/** Set on a target the user explicitly revealed, so re-runs leave it shown. */
const REVEALED_ATTR = "data-vibesters-revealed";

/**
 * Each placeholder we insert maps to a function that re-inserts the content it
 * hides (without marking it revealed). This lets a later run undo its own prior
 * auto-mutes and re-render from the original tree — needed because muting
 * detaches the hidden content, so a re-run can't otherwise see it. Keyed by the
 * placeholder element, so entries are collected once a placeholder is gone.
 */
const restorers = new WeakMap<HTMLElement, () => void>();

/**
 * Replace matching comments with a clickable "muted" placeholder that restores
 * the original content on click. Returns the number of placeholders inserted.
 *
 * Safe to call repeatedly: each run first undoes its own prior auto-mutes, then
 * re-mutes from the original tree, so toggling settings (e.g. the mute scope) on
 * an already-rendered page produces the correct result rather than freezing the
 * first run's output. Threads the user explicitly revealed keep a marker and are
 * left shown.
 */
export function muteThreads(doc: Document, opts: MuteOptions): number {
  // Undo previous auto-mutes so matching runs against the original tree. A
  // user-revealed target has no placeholder (its content already replaced it)
  // and keeps its REVEALED marker, so the skip below leaves it shown.
  restoreAll(doc);

  const regex = buildWordRegex(opts.muteWords);
  if (!regex) return 0;

  // Find every comment whose own text matches, up front and without mutating.
  const matching = new Set<HTMLElement>();
  for (const comment of doc.querySelectorAll<HTMLElement>("div.comment")) {
    if (regex.test(ownText(comment))) matching.add(comment);
  }

  // Whole-thread collapses a match together with its whole reply subtree, so a
  // nested match is absorbed by its ancestor — keep only the topmost match in
  // each chain. Comment-only hides just the matching comment and leaves its
  // replies in place, so every match (nested ones included) is muted on its own.
  const targets = opts.muteWholeThread
    ? [...matching].filter((c) => !hasMatchingAncestor(c, matching))
    : [...matching];

  let muted = 0;
  for (const comment of targets) {
    if (!comment.isConnected) continue;

    const subtree = comment.closest<HTMLElement>("li.comments_subtree");
    if (!subtree) continue;

    const target = opts.muteWholeThread ? subtree : comment;
    if (target.hasAttribute(REVEALED_ATTR)) continue;

    if (opts.muteWholeThread) muteSubtree(doc, subtree);
    else muteComment(doc, comment);
    muted++;
  }
  return muted;
}

/** A comment's own text. Replies live outside its `div.comment`, so are excluded. */
function ownText(comment: HTMLElement): string {
  return comment.querySelector(".comment_text")?.textContent ?? "";
}

/** True if a comment higher up the tree is also in `matching`. */
function hasMatchingAncestor(
  comment: HTMLElement,
  matching: Set<HTMLElement>,
): boolean {
  let li =
    comment
      .closest<HTMLElement>("li.comments_subtree")
      ?.parentElement?.closest<HTMLElement>("li.comments_subtree") ?? null;
  while (li) {
    const ancestor = li.querySelector<HTMLElement>(":scope > div.comment");
    if (ancestor && matching.has(ancestor)) return true;
    li = li.parentElement?.closest<HTMLElement>("li.comments_subtree") ?? null;
  }
  return false;
}

/** Re-insert the content behind every placeholder we previously inserted. */
function restoreAll(doc: Document): void {
  for (const placeholder of doc.querySelectorAll<HTMLElement>(
    `.${PLACEHOLDER_CLASS}`,
  )) {
    restorers.get(placeholder)?.();
  }
}

/** Hide a comment and its whole reply subtree behind one placeholder. */
function muteSubtree(doc: Document, subtree: HTMLElement): void {
  const count = subtree.querySelectorAll("div.comment").length;

  const saved = doc.createDocumentFragment();
  while (subtree.firstChild) saved.append(subtree.firstChild);

  const placeholder = makePlaceholder(
    doc,
    `muted conversation thread (${count} ${count === 1 ? "comment" : "comments"})`,
  );
  subtree.append(placeholder);

  wirePlaceholder(
    placeholder,
    () => placeholder.replaceWith(saved), // re-inserts the saved children in place
    () => subtree.setAttribute(REVEALED_ATTR, ""),
  );
}

/** Hide only the matching comment, leaving its replies visible. */
function muteComment(doc: Document, comment: HTMLElement): void {
  const placeholder = makePlaceholder(doc, "muted comment");
  comment.replaceWith(placeholder); // detach comment; placeholder takes its slot

  wirePlaceholder(
    placeholder,
    () => placeholder.replaceWith(comment),
    () => comment.setAttribute(REVEALED_ATTR, ""),
  );
}

function makePlaceholder(doc: Document, label: string): HTMLAnchorElement {
  const link = doc.createElement("a");
  link.className = PLACEHOLDER_CLASS;
  link.href = "#";
  link.setAttribute("role", "button");
  link.title = "Click to show";
  link.textContent = label;
  link.dataset.vibesters = "placeholder";
  return link;
}

/**
 * Wire a placeholder's two restore paths. `restore` re-inserts the hidden
 * content in the placeholder's slot and is reused by {@link restoreAll}. A user
 * click runs it too, but first marks the target revealed so a later run won't
 * mute it again.
 */
function wirePlaceholder(
  placeholder: HTMLAnchorElement,
  restore: () => void,
  markRevealed: () => void,
): void {
  restorers.set(placeholder, restore);
  placeholder.addEventListener("click", (event) => {
    event.preventDefault();
    markRevealed();
    restore();
  });
}

function buildWordRegex(words: string[]): RegExp | null {
  const cleaned = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  const alternation = cleaned.map(escapeRegExp).join("|");
  // Whole-word, case-insensitive (e.g. "ai" won't match inside "email").
  return new RegExp(`\\b(?:${alternation})\\b`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
