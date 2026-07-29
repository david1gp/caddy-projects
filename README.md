# @adaptive-ds/caddy-projects

API + CLI to manage Caddy reverse-proxy and static "projects": JSON definitions, generated Caddy JSON config, validated with `caddy validate`, reloaded via the admin API, and every change committed to a git repo.

## Why

One server, one Caddy instance, several developers. Editing a shared `Caddyfile` by hand has a few sharp edges:

- **No isolation.** Everyone edits the same file, so anyone can break or clobber anyone else's sites.
- **No audit trail.** When a site breaks, nothing says who changed what, when, or how to get back.
- **Easy to take everything down.** A typo is only caught when Caddy reloads — by then the whole config is already broken.
- **Repetitive.** Every site repeats the same reverse-proxy / docs / OIDC boilerplate.

This project replaces hand-edited Caddyfiles with a small API:

- **Per-user scoping.** Each user only sees and edits their own projects, plus anything explicitly marked `shared` or `template`. No user can read or mutate another user's private entries.
- **Git-backed history.** Every create/edit/delete is a commit (optionally pushed), so the config's history is a normal `git log` you can diff, blame, and revert.
- **Validate before reload.** Generated config is checked with `caddy validate` first. If it fails, Caddy is never reloaded and the git write is reverted — a bad entry cannot take the server down.
- **A tiny schema instead of Caddy JSON.** You declare a port, domains and a path; the boilerplate (reverse proxy, static serving, markdown docs, OIDC gate, `Routed` header) is generated.

## How it works

```
CLI  --unix socket-->  daemon  -->  git repo (project JSON, one commit per change)
                          |
                          +-->  generate Caddy JSON
                          +-->  caddy validate          (abort + revert on failure)
                          +-->  POST /load to admin API (zero-downtime reload)
```

**Identity comes from the socket, not the request.** The daemon listens on one unix socket per user at `<socket-dir>/<username>.sock`, mode `0600` and owned by that user. The username is implied by which socket a request arrived on, so it cannot be spoofed by sending a different header — the kernel's file permissions do the authentication. No tokens, no passwords, nothing to configure per user.

**Every mutation runs the same pipeline**, in this order:

1. Write the project JSON into the git repo and commit it.
2. Read all projects, generate the full Caddy JSON.
3. Validate it by shelling out to `caddy validate`.
4. Reload via `POST /load` on the Caddy admin API.

If step 3 or 4 fails, the git change is reverted with a follow-up commit and the API returns the error. The live config is only ever replaced by something Caddy already accepted.

**Project data is the source of truth.** The generated Caddy config is disposable — it is rebuilt from all project files on every change, and routes are sorted deterministically so the output diffs cleanly. `GET /config` returns the full generated JSON for debugging.

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

| flag | default | notes |
| --- | --- | --- |
| `--repo` | `~/c/adaptive/caddy-projects-history` | git repo holding project JSON |
| `--socket-dir` | `/run/caddy-projects` (or `$XDG_RUNTIME_DIR`/`/tmp` when not root) | one socket per user |
| `--users` | current user | comma separated; only honoured when running as root |
| `--admin-url` | `http://localhost:2019` | Caddy admin API |
| `--caddy-bin` | `caddy` | binary used for `caddy validate` |
| `--no-push` | off | do not push commits to `origin` |
| `--skip-validate` | off | skip `caddy validate` (testing only) |
| `--skip-reload` | off | generate and validate but never reload Caddy (dry run) |

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

Talks to the daemon over the current user's socket (`--socket` or `CADDY_PROJECTS_SOCKET`). Built with `@stricli/core` — every command and flag has help text via `caddy-projects <command> --help`.

```bash
caddy-projects list [--mine] [--templates] [--json]
caddy-projects get <name> [--json]
caddy-projects create --name app --domain app.example.com [--port 3000] \
  [--path /srv/app] [--kind proxy|static] [--access internal|external] \
  [--docs|--no-docs] [--browse|--no-browse] [--shared|--no-shared] \
  [--template|--no-template] [--disabled|--enabled] \
  [--header-up Host=127.0.0.1:3000]
caddy-projects edit app [--port 3001] [same flags as create]
caddy-projects delete <name>
caddy-projects delete --port 3000
caddy-projects config                  # summary table of server blocks
caddy-projects config all [--pretty]   # full generated Caddy JSON
caddy-projects config <selector>       # one block by project name, domain, or port
caddy-projects config --json           # summary as JSON
caddy-projects history [--name app] [--limit 20]
caddy-projects regenerate
caddy-projects --help
caddy-projects create --help
caddy-projects --version
```

- `--port` is optional on create: when omitted the daemon assigns the lowest free port in range (default 3000–3999) and the CLI prints `created <name> (port N)`.
- Boolean project fields have both enable and disable flags (`--docs` / `--no-docs`, etc.). Only flags you pass are sent on `edit` (true partial PATCH).
- `delete` accepts either a positional name or `--port <n>` (not both).
- `config` with no arg prints a summary table of blocks actually in the generated config; `config all` dumps full JSON; `config <selector>` prints matching route(s) (pretty by default). Selector is project name, domain, or port.
- Request bodies are validated client-side before the API call (e.g. bad `--port abc` fails with a clear error).

## API

All routes are JSON over the user's unix socket. The acting user is bound from the socket, never from the request body.

| method | path | notes |
| --- | --- | --- |
| `GET` | `/health` | `{ ok: true, user }` |
| `GET` | `/projects` | visible to user; `?mine=1`, `?templates=1` |
| `POST` | `/projects` | create; `port` optional (auto-assign); 409 on duplicate name, domain, or port |
| `GET` | `/projects/:name` | 404 if not visible |
| `PUT` | `/projects/:name` | full replace (`port` required) |
| `PATCH` | `/projects/:name` | partial merge |
| `DELETE` | `/projects/:name` | own projects only |
| `DELETE` | `/projects/by-port/:port` | delete own project that owns that port |
| `GET` | `/config` | full generated Caddy JSON; `?pretty=1`; `?summary=1` summary rows; `?select=<name\|domain\|port>` matching route(s) (404 if none); visibility-scoped |
| `POST` | `/regenerate` | force regenerate + validate + reload |
| `GET` | `/history` | commits; `?name=`, `?limit=` |

Success responses are `{ success: true, data }`. Errors return a `ResultErr` (`{ success: false, op, errorMessage }`) with status 400 (validation/conflict), 404 (not found) or 500. Port/domain conflicts use 409.

**Port uniqueness.** Ports are unique across all users (one shared machine). Disabled and template projects are ignored for collision checks. On create, omit `port` to get the lowest free port in the configured range (default 3000–3999 via `ProjectsRegenerateOptions.portRange`); the assigned port is in the returned project object (`data.port`).

```bash
curl --unix-socket /run/caddy-projects/$USER.sock http://localhost/projects
# create without port → auto-assign
curl --unix-socket /run/caddy-projects/$USER.sock -X POST http://localhost/projects \
  -d '{"name":"auto","domains":["auto.test"],"kind":"proxy","access":"external","docs":false}'
# delete by port
curl --unix-socket /run/caddy-projects/$USER.sock -X DELETE http://localhost/projects/by-port/3000
```

## Project JSON

| field | type | notes |
| --- | --- | --- |
| `port` | number 1..65535 | upstream port; required when stored; **optional on create** (auto-assigned); unique across all users |
| `domains` | string[] | >=1 hostnames; unique across all users (active projects) |
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

`caddyConfigGenerate` builds Caddy JSON (apps.http + optional apps.oidc). Mutating API routes write git then generate → validate → reload; on regenerate failure the git change is reverted. `POST /regenerate` forces the same pipeline without a project mutation.

**Note:** `access: "internal"` requires the [caddy-oidc](https://github.com/relvacode/caddy-oidc) plugin compiled into your caddy binary. Validation of configs that include the `oidc` handler will fail on stock caddy.

## OIDC setup

Custom Caddy build + Zitadel client provisioning scripts live under [`ops/`](ops/README.md):

- `ops/caddy_oidc_install.sh` — build/install Caddy with `caddy-oidc` via xcaddy
- `ops/provision_leo_server_oidc.sh` / `provision_localhost_oidc.sh` / `provision_david_server_oidc.sh` — idempotent Zitadel OIDC clients
- See [ops/README.md](ops/README.md) for env vars (`CADDY_PROJECTS_OIDC_*`) and how to wire the daemon

## Dev

```bash
bun test
bun run dev:daemon
bun run dev:cli -- list
```
