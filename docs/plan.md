# vibeste.rs — design & architecture

> Internal project documentation. The user-facing site lives in
> [`apps/website`](../apps/website); the motivation is collected in
> [`frustrated-comments.md`](./frustrated-comments.md).

## Context

`vibeste.rs` is a play on `lobste.rs`. It is a small, open-source, cross-browser
WebExtension that customizes the lobste.rs UI for people who want less
AI/"vibecoding" content (see [`frustrated-comments.md`](./frustrated-comments.md)
for the community frustration that prompted it):

1. **Hide the `vibecoding` tag** where it annotates a story (home, story, and tag
   pages) — but **not** in the Filtered Tags management UI at `/filters`.
2. **Mute comment threads** whose text contains configured words (default
   `vibecoding`): replace the comment (and, by default, its whole reply subtree)
   with a "muted conversation thread" link that restores on click.

It runs only on `lobste.rs` / `lobsters.dev`, requests the fewest permissions
possible (just `storage`, no host permissions, no telemetry), is user
configurable, and lives in a monorepo with the extension, a one-page website, a
Nix dev shell, and cross-browser CI.

Locked decisions: **WXT** framework (one codebase → Chrome/Firefox/Safari/Edge,
Vite-based, vanilla TS), **MIT** license, name **vibeste.rs**, **Safari = build
support + documented manual steps** (no macOS CI job; Chrome + Firefox are the
CI-tested targets).

## Verified DOM facts (captured as test fixtures)

- **Story tag (annotates an article):** `<span class="tags"><a class="tag
tag_vibecoding" href="/t/vibecoding">`, inside `.story_liner`.
- **Filters page tag:** wrapped in a table cell — `<td><a class="tag tag_ai">`.
  → `span.tags > a.tag_<slug>` matches article annotations but never `/filters`.
  A pure-CSS discriminator; no URL sniffing.
- **Comment thread:** `<li class="comments_subtree">` containing an
  `<input class="comment_folder_button">`, a `<div class="comment"
data-shortid>` (body in `.comment_text`), then a sibling `<ol class="comments">`
  of nested `li.comments_subtree`. Replies are siblings of the comment's
  `div.comment`, never descendants — so "mute subtree" vs "mute just this
  comment" is a clean structural split.

Fixtures (`apps/extension/tests/fixtures/html/`): `home.html`, `filters.html` are
real captured pages; `comments.html` mirrors the live comment markup.

## Repo layout

```
vibeste.rs/
├─ flake.nix                 # devShell: nodejs_22, corepack(pnpm), web-ext, (Linux) playwright browsers
├─ pnpm-workspace.yaml       # packages: apps/*
├─ package.json              # root scripts (private)
├─ .npmrc                    # node-linker=hoisted (WXT + pnpm)
├─ tsconfig.base.json        # shared strictness
├─ .github/workflows/ci.yml  # chrome+firefox+safari build, test, e2e, Pages deploy
├─ apps/
│  ├─ extension/             # the WebExtension (WXT)
│  │  ├─ wxt.config.ts        manifest, targetBrowsers, firefox gecko id
│  │  ├─ entrypoints/
│  │  │  ├─ lobsters.content.ts   thin wiring (matches lobste.rs/lobsters.dev)
│  │  │  └─ options/index.html + main.ts
│  │  ├─ lib/                 pure logic
│  │  │  ├─ settings.ts        storage.defineItem('sync:settings') + defaults + list helpers
│  │  │  ├─ hide-tags.ts       buildHideTagsCss / hideTagSelectors
│  │  │  └─ mute.ts            muteThreads(document, opts) + restore handlers
│  │  ├─ tests/
│  │  │  ├─ unit/              Vitest specs (de-colocated from lib/)
│  │  │  ├─ e2e/               Playwright specs + fixtures.ts
│  │  │  └─ fixtures/html/     captured lobste.rs HTML (shared by unit + e2e)
│  │  ├─ public/icon/         16/32/48/128 png (rendered from assets/icon.svg)
│  │  ├─ vitest.config.ts · playwright.config.ts · tsconfig.json
│  └─ website/               # self-contained public site → GitHub Pages
│     └─ index.html · style.css · icon-*.png · package.json
└─ docs/                     # project docs (this file, frustrated-comments.md)
```

## Key design points

- **Pure logic, thin entrypoint.** All page logic is in `lib/` pure functions
  (`Document`/strings in, mutations out). WXT imports entrypoints in Node at
  build time, so the content script must have no top-level runtime code — it just
  wires `lib/` to the page and to `settings.watch`.
- **Tags hidden via injected CSS** built from settings
  (`span.tags > a.tag_<slug>{display:none !important}`), injected at
  `document_start` to avoid a flash. Declarative, so dynamically-added tags are
  covered without re-running JS. Re-rendered on settings change.
- **Muting** collects all matching `div.comment`s, then filters only the
  _topmost_ match in each ancestor chain: if a word appears in a comment **and**
  one of its descendants, only the ancestor is filtered (no nested placeholders).
  Whole-thread mode detaches the enclosing `li.comments_subtree`'s contents into a
  closure and inserts a placeholder; comment-only mode replaces just the
  `div.comment`, leaving the sibling `ol.comments` (replies) visible. The tops are
  computed before mutating, since muting detaches comments. Click restores; a
  `data-vibeste-revealed` marker stops re-runs from re-hiding a thread the user
  opened. Idempotent.
- **Settings:** one `storage.sync` item `{ hiddenTags, muteWords, muteWholeThread }`,
  defaulting to the `vibecoding` tag, a list of `vibecoding` inflections / alternate
  spellings / common misspellings for muting (whole-word matching needs each listed
  explicitly), and whole-thread, so it works on install. Firefox needs `gecko.id`
  for `storage.sync` to persist — handled in config.
- **Permissions:** `storage` only. No `host_permissions` (content-script
  `matches` suffice), no tabs, no background worker, no network.

## Testing

- **Unit (Vitest + WxtVitest + jsdom):** `tests/unit/*` against captured fixtures
  (imported as `*.html?raw`). Covers tag-CSS generation, the home-vs-filters
  discriminator, whole-thread/comment-only muting, restore, word-boundary
  matching, idempotency, and the settings round-trip via `fakeBrowser`.
- **E2E (Playwright, Chromium):** loads the built MV3 extension into a persistent
  context and serves the captured fixtures for `lobste.rs` URLs (offline,
  deterministic). Asserts the tag is hidden on home, visible on `/filters`, and a
  vibecoding thread becomes a placeholder that restores on click.
- **Firefox:** `web-ext lint` on the built add-on (CI). **Safari:** `build:safari`
  compiles the payload in CI; Xcode conversion/signing is manual.

## CI

`build-test` (ubuntu): install → typecheck → unit tests → build chrome/firefox/safari
→ `web-ext lint` → zip → Playwright e2e under `xvfb` → upload zips.
`deploy-website` (main only): publish `apps/website` to GitHub Pages via the
Actions deployment (which can publish any subfolder).

## Manual Safari packaging (not in CI)

```sh
pnpm -C apps/extension build:safari
xcrun safari-web-extension-converter apps/extension/.output/safari-mv2 \
  --app-name "vibeste.rs" --bundle-identifier rs.vibeste.extension --no-prompt
# then build/sign the generated Xcode project (needs Xcode + Apple Developer acct)
```

## Notes / risks

- Selectors track current lobste.rs markup; the captured fixtures localize any
  fix if the site changes.
- Matching is whole-word, case-insensitive, configurable.
- WXT defaults Firefox/Safari to MV2 (fine — no background worker); switching
  Firefox to MV3 later is a one-flag change.

```

```
