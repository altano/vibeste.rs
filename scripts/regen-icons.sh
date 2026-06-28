#!/usr/bin/env bash
# Regenerate every PNG icon from the single source SVG (apps/extension/assets/icon.svg).
# The PNGs are build outputs — edit the SVG, then run `pnpm regen:icons`, never edit
# the PNGs by hand. rsvg-convert (librsvg) is pinned by the flake dev shell.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/apps/extension/assets/icon.svg"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "regen-icons: rsvg-convert not found — enter the dev shell first (nix develop)." >&2
  exit 1
fi

# Extension toolbar icons — sizes must match the `icons` map in wxt.config.ts.
for s in 16 32 48 128; do
  rsvg-convert -w "$s" -h "$s" "$src" -o "$root/apps/extension/public/icon/$s.png"
done

# Website favicon + page logo — same source, keeps the branding in sync.
rsvg-convert -w 48  -h 48  "$src" -o "$root/apps/website/icon-48.png"
rsvg-convert -w 128 -h 128 "$src" -o "$root/apps/website/icon-128.png"

echo "regen-icons: wrote extension icons (16/32/48/128) and website icons (48/128)."
