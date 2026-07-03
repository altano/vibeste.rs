# vibeste.rs

A small, open-source browser extension that makes [lobste.rs](https://lobste.rs)
quieter by hiding the `vibecoding` tag and muting comment threads that mention it.

For the user-facing overview, screenshots, settings, and privacy details, see
**[the website](https://altano.github.io/vibeste.rs/)**.

Cross-browser (Chrome, Firefox, Safari, Edge) from one code base via
[WXT](https://wxt.dev). The rest of this README covers local development; see
[`docs/`](docs/) for design notes.

## 🤖 AI Notice

The code in this repository is vibecoded and mostly human-reviewed.

## Repo layout

| Path             | What                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| `apps/extension` | The WebExtension (WXT, TypeScript)                                               |
| `apps/website`   | Self-contained one-page site, deployed to GitHub Pages                           |
| `docs`           | Project docs — [design](docs/plan.md), [motivation](docs/frustrated-comments.md) |
| `flake.nix`      | Nix dev shell (Node, pnpm, web-ext, Playwright browsers)                         |

## Develop

Requires Node ≥ 20 and pnpm. The Nix flake provides both:

```sh
git clone https://github.com/altano/vibeste.rs
cd vibeste.rs
nix develop          # or bring your own Node + `corepack enable pnpm`
pnpm install
```

Common tasks (run from the repo root):

```sh
pnpm dev             # Chrome, with hot reload
pnpm dev:firefox     # Firefox, with hot reload
pnpm check:types     # typecheck (wxt prepare && tsc --noEmit)
pnpm test:unit       # unit tests (Vitest)
pnpm test:e2e        # Playwright e2e (build first)
pnpm build           # build Chrome + Firefox + Safari
pnpm build:safari    # build only the Safari payload
pnpm zip             # package store-ready zips (all targets)
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

## Tests

- **Unit** (`pnpm test:unit`) — pure logic and DOM transforms run against real
  captured lobste.rs HTML (`apps/extension/tests/fixtures/html/`).
- **E2E** (`pnpm test:e2e`) — loads the built Chromium extension and drives it against
  those fixtures served as `lobste.rs`, offline and deterministically.
- **Firefox** is validated in CI with `web-ext lint`.

## License

[MIT](LICENSE).
