# OIDC setup for caddy-projects

`access: internal` projects emit a Caddy `oidc` handler. Stock Caddy does not ship that module, so `caddy validate` and the live server both need a custom binary built with [caddy-oidc](https://github.com/relvacode/caddy-oidc).

## 1. Build Caddy with caddy-oidc

```bash
./ops/caddy_oidc_install.sh
# or:
./ops/caddy_oidc_install.sh --output ~/.local/bin/caddy --local /home/david/c/adaptive/caddy-oidc
./ops/caddy_oidc_install.sh --remote
./ops/caddy_oidc_install.sh --caddy-version v2.11.2
```

Requires Go. Installs `xcaddy` if missing, builds with module `github.com/relvacode/caddy-oidc`, verifies `http.handlers.oidc` is present, and installs to `~/.local/bin/caddy` (backs up any existing binary to `.bak`).

Point the daemon at that binary with `--caddy-bin ~/.local/bin/caddy`.

## 2. Provision Zitadel OIDC clients

All scripts talk to `https://auth.contentoren.de`, read `IDP_ADMIN_PAT` from contentoren-server's `zitadel/podman/zitadel.env`, and write a chmod-600 env file. Safe to re-run; client secrets are preserved.

```bash
# leo-server (hermes/neo/blue/wiki/leonardomora)
./ops/provision_leo_server_oidc.sh
./ops/provision_leo_server_oidc.sh --dry-run

# local dev host
./ops/provision_localhost_oidc.sh
./ops/provision_localhost_oidc.sh --port 2015 --dry-run

# david-server (david-siewert.com / rift-command.com)
./ops/provision_david_server_oidc.sh
./ops/provision_david_server_oidc.sh --dry-run
```

Default env file paths:

- leo-server: `$LEO_SERVER_DIR/caddy_config/caddy-projects.oidc.env`
- localhost: `~/.config/caddy-projects/localhost.oidc.env`
- david-server: `$DAVID_SERVER_DIR/caddy_config/caddy-projects.oidc.env`

Override with `LEO_SERVER_OIDC_ENV_FILE`, `LOCALHOST_OIDC_ENV_FILE`, `DAVID_SERVER_OIDC_ENV_FILE`, or `ZITADEL_ENV`.

## 3. Env vars the daemon consumes

Each provisioning script writes:

- `CADDY_PROJECTS_OIDC_ISSUER` — e.g. `https://auth.contentoren.de`
- `CADDY_PROJECTS_OIDC_CLIENT_ID`
- `CADDY_PROJECTS_OIDC_CLIENT_SECRET`
- `CADDY_PROJECTS_OIDC_COOKIE_SECRET`
- `CADDY_PROJECTS_OIDC_PROVIDER` — default `zitadel`

Omit `CADDY_PROJECTS_OIDC_ISSUER` to disable OIDC entirely (internal projects then have no gate).

## 4. Point the daemon at the env file

```bash
set -a
source /path/to/caddy-projects.oidc.env
set +a

caddy-projectsd \
  --repo ~/c/adaptive/caddy-projects-history \
  --caddy-bin ~/.local/bin/caddy \
  ...
```

Or in systemd:

```ini
EnvironmentFile=/path/to/caddy-projects.oidc.env
Environment=CADDY_PROJECTS_OIDC_ISSUER=https://auth.contentoren.de
```

Never commit `*.oidc.env` files.
