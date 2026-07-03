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

## Install

- **Chrome** — [Chrome Web Store](https://chromewebstore.google.com/detail/vibesters/hjnkfiahlgknhllmjjhmiabjgiiikkga).
- **Firefox** — [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/vibesters/) (pending review).
- **Edge** — [install the released build manually](#edge) — it's not on the Edge
  Add-ons store, but the Chrome build runs unchanged.
- **Safari** — [build it yourself](#safari) — needs a Mac with Xcode (no
  one-click install); start from the release's Safari zip.

### Edge

Edge is Chromium, so the Chrome build runs as-is — there's just no store listing,
so you side-load it:

1. Download `vibesters-extension-<version>-chrome.zip` from the
   [latest release](https://github.com/altano/vibeste.rs/releases/latest) and
   unzip it.
2. Open `edge://extensions` and enable **Developer mode** (bottom-left toggle).
3. Click **Load unpacked** and select the unzipped folder.

Edge keeps it enabled across restarts. To update, download the newer release zip
and load it again the same way.

### Safari

Safari has no one-click install: it only runs web extensions wrapped in a
**signed, notarized macOS app**, which needs a paid Apple Developer account — so
you build and run it yourself on a Mac with Xcode. Start from either the released
Safari payload or a local build, then let Xcode wrap it:

```sh
# A) From the latest release: download + unzip
#    vibesters-extension-<version>-safari.zip, then point the converter at it:
xcrun safari-web-extension-converter <unzipped-safari-folder> \
  --app-name "vibeste.rs" --bundle-identifier rs.vibeste.extension --no-prompt

# B) From source:
pnpm build:safari
xcrun safari-web-extension-converter apps/extension/.output/safari-mv2 \
  --app-name "vibeste.rs" --bundle-identifier rs.vibeste.extension --no-prompt
```

Then open and run the generated Xcode project. Safari is build-supported but not
exercised in CI (headless Safari extension automation isn't possible).

## Load an unpacked build (development)

After `pnpm build`, to load your own build:

- **Chrome / Edge** — `chrome://extensions` → enable Developer mode → **Load
  unpacked** → select `apps/extension/.output/chrome-mv3`.
- **Firefox** — `about:debugging` → This Firefox → **Load Temporary Add-on** →
  pick any file in `apps/extension/.output/firefox-mv2`. (Or just `pnpm dev:firefox`.)
- **Safari** — see [Safari](#safari) above.

## Tests

- **Unit** (`pnpm test:unit`) — pure logic and DOM transforms run against real
  captured lobste.rs HTML (`apps/extension/tests/fixtures/html/`).
- **E2E** (`pnpm test:e2e`) — loads the built Chromium extension and drives it against
  those fixtures served as `lobste.rs`, offline and deterministically.
- **Firefox** is validated in CI with `web-ext lint`.

## Releasing

Releases are driven by [release-please](https://github.com/googleapis/release-please)
and the [`release` workflow](.github/workflows/release.yml). **GitHub Releases are
published automatically; uploading to the stores is a manual step** (this project
does not automate store submission).

### Cut a release

1. Land changes on `main` using [Conventional Commits](https://www.conventionalcommits.org)
   (`fix:`, `feat:`, `feat!:` / `BREAKING CHANGE:` decide the version bump).
2. release-please keeps an open **Release PR** that bumps
   `apps/extension/package.json` (the version WXT bakes into every manifest) and
   updates `apps/extension/CHANGELOG.md`. **Merge it when you want to ship** — no
   version numbers or changelog to edit by hand.
3. Merging tags `vX.Y.Z`, cuts a **GitHub Release**, and the workflow builds all
   targets and attaches the chrome / firefox / safari zips (plus the Firefox
   `-sources.zip`).

One-time setup: Settings → Actions → General → enable **"Allow GitHub Actions to
create and approve pull requests"** so release-please can open its Release PR.

### Upload to the stores (manual)

Download the zips from the GitHub Release, then:

- **Chrome Web Store** — [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
  → the item → **Package → Upload new package** →
  `vibesters-extension-<version>-chrome.zip` → **Submit for review**.
- **Firefox AMO** — [Developer Hub](https://addons.mozilla.org/developers/) →
  the add-on → **Upload New Version** →
  `vibesters-extension-<version>-firefox.zip`; when prompted for sources, upload
  `vibesters-extension-<version>-sources.zip` (AMO rebuilds bundled code).

Prefer the CLI? `pnpm -C apps/extension submit` uploads via the store APIs
instead, if you've set up `.env.submit` credentials. Edge and Safari aren't
published to a store — users install straight from the GitHub Release (see
[Install](#install)).

## License

[MIT](LICENSE).
