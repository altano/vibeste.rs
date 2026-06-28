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
              pkgs.corepack # provides pnpm pinned by package.json's packageManager field
              pkgs.web-ext # firefox: run / lint the extension
            ]
            # Playwright's own browser download is broken under Nix, so pull the
            # browsers from nixpkgs instead. They build cleanly on Linux (CI/local);
            # on macOS, develop e2e against system browsers / CI.
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
              pkgs.playwright-driver.browsers
              pkgs.xvfb-run # virtual display for the headed e2e Chromium (CI)
            ];

          shellHook = ''
            # Use the pnpm version pinned in package.json (packageManager field).
            corepack enable pnpm >/dev/null 2>&1 || true
          ''
          + pkgs.lib.optionalString pkgs.stdenv.isLinux ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';
        };
      }
    );
}
