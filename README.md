# @adaptive-ds/caddy-projects

API + CLI to manage Caddy reverse-proxy and static "projects": JSON definitions, generated Caddy JSON config, validated with `caddy validate`, reloaded via the admin API, and every change committed to a git repo.

## Install

```bash
bun install
bun run build
```

Binaries after build: `caddy-projects` (CLI), `caddy-projectsd` (daemon).

## Daemon

```bash
bun run src/daemon.ts \
  --repo ~/c/adaptive/caddy-projects-history \
  --socket-dir /run/caddy-projects \
  --users leo,david \
  --admin-url http://localhost:2019 \
  --caddy-bin caddy \
  --no-push
```

Env (OIDC; omit issuer to skip oidc app entirely):

- `CADDY_PROJECTS_OIDC_ISSUER`
- `CADDY_PROJECTS_OIDC_CLIENT_ID`
- `CADDY_PROJECTS_OIDC_CLIENT_SECRET`
- `CADDY_PROJECTS_OIDC_COOKIE_SECRET`
- `CADDY_PROJECTS_OIDC_PROVIDER` (default `zitadel`)

Listens on one unix socket per user: `<socket-dir>/<username>.sock` (mode `0600`, chown to user when root).

### systemd example

```ini
[Unit]
Description=caddy-projects daemon
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/caddy-projectsd --repo /var/lib/caddy-projects --socket-dir /run/caddy-projects --users leo,david
Restart=on-failure
Environment=CADDY_PROJECTS_OIDC_ISSUER=https://auth.example
Environment=CADDY_PROJECTS_OIDC_CLIENT_ID=...
Environment=CADDY_PROJECTS_OIDC_CLIENT_SECRET=...
Environment=CADDY_PROJECTS_OIDC_COOKIE_SECRET=...

[Install]
WantedBy=multi-user.target
```

## CLI

Talks to the daemon over the current user's socket (`--socket` or `CADDY_PROJECTS_SOCKET`).

```bash
caddy-projects list [--mine] [--templates] [--json]
caddy-projects get <name> [--json]
caddy-projects create --name app --port 3000 --domain app.example.com \
  [--path /srv/app] [--kind proxy|static] [--access internal|external] \
  [--no-docs] [--browse] [--shared] [--template] [--header-up Host=127.0.0.1:3000]
caddy-projects edit app --port 3001
caddy-projects delete app
caddy-projects config [--pretty]
caddy-projects history [--name app] [--limit 20]
caddy-projects apply
caddy-projects --help
caddy-projects --version
```

## Project JSON

| field | type | notes |
| --- | --- | --- |
| `port` | number 1..65535 | upstream port; primary key per user |
| `domains` | string[] | >=1 hostnames |
| `name` | slug | `^[a-z0-9][a-z0-9-]*$` |
| `path` | string | absolute path; `""` allowed |
| `user` | string | linux username (set by server) |
| `access` | `internal` \| `external` | internal => OIDC gate when configured |
| `kind` | `proxy` \| `static` | reverse_proxy vs file_server |
| `docs` | boolean | default true: serve `path/docs/*.md` at `/docs/*` |
| `browse` | boolean | static only; default false |
| `headerUp` | record | reverse_proxy `header_up`; default `{}` |
| `shared` | boolean | visible to all users; default false |
| `template` | boolean | not emitted into caddy config; default false |
| `disabled` | boolean | omit from caddy config; default false |

Storage: `projects/<user>/<name>.json` in the git history repo.

Visibility: own projects, or any with `shared` / `template`. Mutations only on own projects.

## Caddy config

`caddyConfigGenerate` builds Caddy JSON (apps.http + optional apps.oidc). Mutating API routes write git then generate → validate → reload; on apply failure the git change is reverted.

**Note:** `access: "internal"` requires the [caddy-oidc](https://github.com/) plugin compiled into your caddy binary. Validation of configs that include the `oidc` handler will fail on stock caddy.

## Dev

```bash
bun test
bun run dev:daemon
bun run dev:cli -- list
```
