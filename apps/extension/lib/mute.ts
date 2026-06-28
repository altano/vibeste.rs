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

const PLACEHOLDER_CLASS = 'vibeste-muted';
/** Set on a target the user explicitly revealed, so re-runs leave it shown. */
const REVEALED_ATTR = 'data-vibeste-revealed';

/**
 * Replace matching comments with a clickable "muted" placeholder that restores
 * the original content on click. Idempotent and safe to call repeatedly (e.g.
 * when settings change). Returns the number of placeholders inserted.
 */
export function muteThreads(doc: Document, opts: MuteOptions): number {
  const regex = buildWordRegex(opts.muteWords);
  if (!regex) return 0;

  let muted = 0;
  // Document order ⇒ ancestors before descendants. Once a subtree is muted in
  // whole-thread mode its descendant comments are detached (isConnected=false)
  // and skipped below, so each region is muted exactly once.
  for (const comment of doc.querySelectorAll<HTMLElement>('div.comment')) {
    if (!comment.isConnected) continue;

    const subtree = comment.closest<HTMLElement>('li.comments_subtree');
    if (!subtree) continue;

    const target = opts.muteWholeThread ? subtree : comment;
    if (target.hasAttribute(REVEALED_ATTR)) continue;

    const ownText = comment.querySelector('.comment_text')?.textContent ?? '';
    if (!regex.test(ownText)) continue;

    if (opts.muteWholeThread) muteSubtree(doc, subtree);
    else muteComment(doc, comment);
    muted++;
  }
  return muted;
}

/** Hide a comment and its whole reply subtree behind one placeholder. */
function muteSubtree(doc: Document, subtree: HTMLElement): void {
  const count = subtree.querySelectorAll('div.comment').length;

  const saved = doc.createDocumentFragment();
  while (subtree.firstChild) saved.append(subtree.firstChild);

  const placeholder = makePlaceholder(
    doc,
    `muted conversation thread (${count} ${count === 1 ? 'comment' : 'comments'})`,
  );
  subtree.append(placeholder);

  onReveal(placeholder, () => {
    subtree.setAttribute(REVEALED_ATTR, '');
    placeholder.replaceWith(saved); // re-inserts the saved children in place
  });
}

/** Hide only the matching comment, leaving its replies visible. */
function muteComment(doc: Document, comment: HTMLElement): void {
  const placeholder = makePlaceholder(doc, 'muted comment');
  comment.replaceWith(placeholder); // detach comment; placeholder takes its slot

  onReveal(placeholder, () => {
    comment.setAttribute(REVEALED_ATTR, '');
    placeholder.replaceWith(comment);
  });
}

function makePlaceholder(doc: Document, label: string): HTMLAnchorElement {
  const link = doc.createElement('a');
  link.className = PLACEHOLDER_CLASS;
  link.href = '#';
  link.setAttribute('role', 'button');
  link.title = 'Click to show';
  link.textContent = label;
  link.dataset.vibeste = 'placeholder';
  return link;
}

function onReveal(link: HTMLAnchorElement, reveal: () => void): void {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    reveal();
  });
}

function buildWordRegex(words: string[]): RegExp | null {
  const cleaned = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  const alternation = cleaned.map(escapeRegExp).join('|');
  // Whole-word, case-insensitive (e.g. "ai" won't match inside "email").
  return new RegExp(`\\b(?:${alternation})\\b`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
