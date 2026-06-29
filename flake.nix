{
  description = "vibeste.rs — cross-browser extension that de-vibes lobste.rs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages =
            [
              pkgs.nodejs_22
              pkgs.pnpm_10 # honors package.json's packageManager pin via pnpm's built-in version management
              pkgs.web-ext # firefox: run / lint the extension
              pkgs.librsvg # rsvg-convert: render icon.svg -> PNG icons (pnpm regen:icons)
            ]
            # Playwright's own browser download is broken under Nix, so pull the
            # browsers from nixpkgs instead. They build cleanly on Linux (CI/local);
            # on macOS, develop e2e against system browsers / CI.
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
              pkgs.playwright-driver.browsers
              pkgs.xvfb-run # virtual display for the headed e2e Chromium (CI)
            ];

          shellHook = pkgs.lib.optionalString pkgs.stdenv.isLinux ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';
        };
      }
    );
}
