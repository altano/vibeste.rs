# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands & setup

A cross-browser WebExtension (Chrome/Firefox/Safari/Edge from one WXT codebase) that hides the `vibecoding` tag and mutes vibecoding comment threads on lobste.rs.

See @README.md for the full task list (dev / build / test / zip), browser-loading steps, and Safari packaging — it is the source of truth; don't duplicate those commands here.

pnpm workspace: run scripts from the repo root (they fan out via `pnpm -r`). `apps/extension` is the only npm package; `apps/website` and `docs/` are static. Single tests:

- Unit: `pnpm -C apps/extension exec vitest run <pattern>`
- E2E: `pnpm -C apps/extension exec playwright test <file>`

## Architecture

The extension is deliberately split into **pure logic** and **thin glue**:

- `apps/extension/lib/` — framework-free modules, unit-tested against captured lobste.rs HTML (`tests/fixtures/html/`) under jsdom:
  - `hide-tags.ts` — builds the tag-hiding CSS; pure string/selector logic.
  - `mute.ts` — comment muting as `Document` in → DOM mutations out.
  - `settings.ts` — the `Settings` shape, `DEFAULT_SETTINGS`, and the single `storage.sync` item.
- `entrypoints/lobsters.content.ts` — the only code that touches the live page. Reads settings, injects the stylesheet, runs muting, and re-applies both on `settings.watch`. Placeholder presentation CSS lives here so `mute.ts` stays DOM-only.
- `entrypoints/options/` — options page (plain TS + HTML) that edits the settings item.

Invariants to preserve when editing:

- **Tag hiding is declarative CSS** injected at `document_start` (avoids a flash of the tag) and is _not_ re-run per DOM change. The only URL-sniffing is keeping a tag visible on its own `/t/<slug>` page; everything else is selector-based.
- **Muting is idempotent.** `muteThreads` first `restoreAll`s its own prior auto-mutes, then re-mutes from the original tree, so toggling settings on an already-rendered page stays correct. Targets the user explicitly revealed are marked (`data-vibesters-revealed`) and left shown. Whole-thread vs. comment-only is a structural distinction — replies live in a sibling `<ol>`, not inside `div.comment`.
- **Mute matching is whole-word, case-insensitive,** with no stemming: every inflection / spacing / misspelling must be listed explicitly in `DEFAULT_SETTINGS.muteWords`.
- **Minimal permissions:** `storage` only — no host_permissions, background worker, tabs, or network. The content-script `matches` grant page access. Don't add permissions casually.
- **Firefox needs the explicit gecko id** in `wxt.config.ts` — it's functional (required for `storage.sync` to persist), not just a signing detail.

When changing `lib/` logic, prefer adding a fixture-backed unit test; reserve e2e (built Chromium extension, fixtures served offline as `lobste.rs`) for content-script/options wiring. Safari is build-only — not exercised in CI.
