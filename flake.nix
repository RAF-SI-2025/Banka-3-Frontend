{
  description = "Banka-3-Frontend — Vite + React + Cypress dev shell.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem = {system, ...}: let
        # Node 20 LTS matches Dockerfile.dev + the prod Dockerfile. Upstream
        # nixpkgs marks it insecure once a CVE lands in the minor; for a dev
        # shell we accept that and pin via permittedInsecurePackages so devs
        # don't drift onto node 22 silently.
        pkgs = import inputs.nixpkgs {
          inherit system;
          config.permittedInsecurePackages = [
            "nodejs-20.20.2"
            # cypress (and others) pull nodejs-slim; same CVE story.
            "nodejs-slim-20.20.2"
          ];
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20

            # Cypress: nix-provided binary so the npm-installed prebuilt
            # doesn't have to find system libs (libxss/gtk/etc) at runtime
            # — a problem on NixOS in particular. CYPRESS_RUN_BINARY in
            # shellHook below points npm/npx at this binary.
            cypress

            # docker-compose for `make dev`, plus the cypress harness that
            # docker-exec's into the backend stack.
            docker-compose

            gnumake
            jq
            git
            curl
          ];

          shellHook = ''
            # Skip cypress's npm-time binary download (it won't run on NixOS
            # without system libs anyway). Point its runtime + version probe
            # at the nix-provided binary instead.
            export CYPRESS_INSTALL_BINARY=0
            export CYPRESS_RUN_BINARY="${pkgs.cypress}/bin/Cypress"
          '';
        };
      };
    };
}
