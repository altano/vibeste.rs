# vibeste.rs

A small, open-source browser extension that makes [lobste.rs](https://lobste.rs)
quieter:

- **Hides the `vibecoding` tag** where it annotates a story — but leaves it alone
  in your Filtered Tags settings at `/filters`.
- **Mutes comment threads** that mention `vibecoding`, collapsing them into a
  _"muted conversation thread"_ link you can click to expand.

Everything is configurable, it runs only on `lobste.rs` / `lobsters.dev`, and it
requests a single permission (`storage`) with no telemetry of any kind.

Cross-browser (Chrome, Firefox, Safari, Edge) from one code base via
[WXT](https://wxt.dev). See the [website](apps/website/index.html) for the
user-facing overview and [`docs/`](docs/) for design notes.

## Repo layout

| Path | What |
| --- | --- |
| `apps/extension` | The WebExtension (WXT, TypeScript) |
| `apps/website` | Self-contained one-page site, deployed to GitHub Pages |
| `docs` | Project docs — [design](docs/plan.md), [motivation](docs/frustrated-comments.md) |
| `flake.nix` | Nix dev shell (Node, pnpm, web-ext, Playwright browsers) |

## Develop

Requires Node ≥ 20 and pnpm. The Nix flake provides both:

```sh
nix develop          # or bring your own Node + `corepack enable pnpm`
pnpm install
```

Common tasks (run from the repo root):

```sh
pnpm dev             # Chrome, with hot reload
pnpm dev:firefox     # Firefox, with hot reload
pnpm compile         # typecheck (wxt prepare && tsc --noEmit)
pnpm test            # unit tests (Vitest)
pnpm e2e             # Playwright e2e (build first)
pnpm build           # build Chrome + Firefox
pnpm build:safari    # build the Safari payload
pnpm zip             # package store-ready zips
```

Builds land in `apps/extension/.output/<target>/`.

## Load it in a browser

After `pnpm build`:

- **Chrome / Edge** — `chrome://extensions` → enable Developer mode → **Load
  unpacked** → select `apps/extension/.output/chrome-mv3`.
- **Firefox** — `about:debugging` → This Firefox → **Load Temporary Add-on** →
  pick any file in `apps/extension/.output/firefox-mv2`. (Or just `pnpm dev:firefox`.)
- **Safari** — see below.

### Safari

WXT builds the Safari payload; macOS/Xcode wraps it into an app:

```sh
pnpm build:safari
xcrun safari-web-extension-converter apps/extension/.output/safari-mv2 \
  --app-name "vibeste.rs" --bundle-identifier rs.vibeste.extension --no-prompt
```

Then open and run the generated Xcode project. Distribution needs an Apple
Developer account for signing/notarization. Safari is build-supported but not
exercised in CI (headless Safari extension automation isn't possible).

## Settings

Open the extension's options page to configure:

- **Hidden tags** — tag slugs to hide (one per line; default `vibecoding`).
- **Muted words** — words/phrases that mute a comment (whole-word, case-insensitive).
- **Mute scope** — the whole reply thread (default) or only the matching comment.

Settings use `storage.sync`, so they follow you across browsers and apply live.

## Tests

- **Unit** (`pnpm test`) — pure logic and DOM transforms run against real
  captured lobste.rs HTML (`apps/extension/e2e/html/`).
- **E2E** (`pnpm e2e`) — loads the built Chromium extension and drives it against
  those fixtures served as `lobste.rs`, offline and deterministically.
- **Firefox** is validated in CI with `web-ext lint`.

## Privacy

The only permission is `storage` (for your settings). The code runs solely on
`lobste.rs` and `lobsters.dev`. No host permissions, no network requests, no
analytics — nothing leaves your browser.

## License

[MIT](LICENSE).
