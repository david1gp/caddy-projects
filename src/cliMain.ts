import * as os from "node:os"
import { join } from "node:path"
import { createResult, createResultError, type PromiseResult } from "#result"

function socketDirDefault(): string {
  if (process.getuid?.() === 0) return "/run/caddy-projects"
  const xdg = Bun.env.XDG_RUNTIME_DIR
  if (xdg) return join(xdg, "caddy-projects")
  return "/tmp/caddy-projects"
}

function socketPathResolve(argv: string[]): string {
  const i = argv.indexOf("--socket")
  if (i !== -1 && argv[i + 1]) return argv[i + 1]!
  if (Bun.env.CADDY_PROJECTS_SOCKET) return Bun.env.CADDY_PROJECTS_SOCKET
  const user = os.userInfo().username
  return join(socketDirDefault(), `${user}.sock`)
}

function stripGlobalFlags(argv: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === "--socket") {
      i++
      continue
    }
    out.push(a)
  }
  return out
}

async function apiFetch(socketPath: string, path: string, init?: RequestInit): PromiseResult<unknown> {
  const op = "cliMain.api"
  try {
    const res = await fetch(`http://localhost${path}`, {
      ...init,
      unix: socketPath,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    } as RequestInit & { unix: string })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return createResultError(op, `non-JSON response (${res.status}): ${text}`)
    }
    if (
      !res.ok ||
      (json && typeof json === "object" && "success" in json && (json as { success: boolean }).success === false)
    ) {
      const err = json as { op?: string; errorMessage?: string; success: false }
      return createResultError(err.op ?? op, err.errorMessage ?? text)
    }
    if (json && typeof json === "object" && "success" in json && (json as { success: boolean }).success === true) {
      return createResult((json as unknown as { data: unknown }).data)
    }
    return createResult(json)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, msg)
  }
}

function flagMulti(args: string[], name: string): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) {
      out.push(args[i + 1]!)
      i++
    }
  }
  return out
}

function flagOne(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  return args[i + 1]
}

function flagBool(args: string[], name: string): boolean {
  return args.includes(name)
}

function projectBodyFromFlags(args: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const name = flagOne(args, "--name")
  if (name) body.name = name
  const port = flagOne(args, "--port")
  if (port) body.port = Number(port)
  const domains = flagMulti(args, "--domain")
  if (domains.length) body.domains = domains
  const path = flagOne(args, "--path")
  if (path !== undefined) body.path = path
  const kind = flagOne(args, "--kind")
  if (kind) body.kind = kind
  const access = flagOne(args, "--access")
  if (access) body.access = access
  if (flagBool(args, "--no-docs")) body.docs = false
  if (flagBool(args, "--browse")) body.browse = true
  if (flagBool(args, "--shared")) body.shared = true
  if (flagBool(args, "--template")) body.template = true
  const headerUps = flagMulti(args, "--header-up")
  if (headerUps.length) {
    const headerUp: Record<string, string> = {}
    for (const h of headerUps) {
      const eq = h.indexOf("=")
      if (eq === -1) continue
      headerUp[h.slice(0, eq)] = h.slice(eq + 1)
    }
    body.headerUp = headerUp
  }
  return body
}

function tableProjects(projects: Array<Record<string, unknown>>): string {
  const lines = ["NAME\tPORT\tKIND\tACCESS\tDOMAINS\tUSER"]
  for (const p of projects) {
    const domains = Array.isArray(p.domains) ? (p.domains as string[]).join(",") : ""
    lines.push(`${p.name}\t${p.port}\t${p.kind}\t${p.access}\t${domains}\t${p.user}`)
  }
  return lines.join("\n")
}

const HELP = `caddy-projects — manage Caddy reverse-proxy/static projects

Usage:
  caddy-projects list [--mine] [--templates] [--json]
  caddy-projects get <name> [--json]
  caddy-projects create --name x --port N --domain d [--path p] [--kind proxy|static]
                        [--access internal|external] [--no-docs] [--browse] [--shared]
                        [--template] [--header-up K=V]
  caddy-projects edit <name> [same flags as create]
  caddy-projects delete <name>
  caddy-projects config [--pretty]
  caddy-projects history [--name x] [--limit n]
  caddy-projects apply
  caddy-projects --help | --version

Global:
  --socket <path>   unix socket (or CADDY_PROJECTS_SOCKET)
`

export async function cliMain(argv: string[]): PromiseResult<string> {
  const op = "cliMain"
  const socketPath = socketPathResolve(argv)
  const args = stripGlobalFlags(argv)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return createResult(HELP)
  }
  if (args[0] === "--version" || args[0] === "-v") {
    return createResult("0.1.0")
  }

  const cmd = args[0]!
  const rest = args.slice(1)

  if (cmd === "list") {
    const qs = new URLSearchParams()
    if (flagBool(rest, "--mine")) qs.set("mine", "1")
    if (flagBool(rest, "--templates")) qs.set("templates", "1")
    const q = qs.toString()
    const r = await apiFetch(socketPath, `/projects${q ? `?${q}` : ""}`)
    if (!r.success) return r
    if (flagBool(rest, "--json")) return createResult(JSON.stringify(r.data, null, 2))
    return createResult(tableProjects(r.data as Array<Record<string, unknown>>))
  }

  if (cmd === "get") {
    const name = rest[0]
    if (!name) return createResultError(op, "usage: get <name>")
    const r = await apiFetch(socketPath, `/projects/${encodeURIComponent(name)}`)
    if (!r.success) return r
    return createResult(JSON.stringify(r.data, null, 2))
  }

  if (cmd === "create") {
    const body = projectBodyFromFlags(rest)
    const r = await apiFetch(socketPath, "/projects", { method: "POST", body: JSON.stringify(body) })
    if (!r.success) return r
    return createResult(JSON.stringify(r.data, null, 2))
  }

  if (cmd === "edit") {
    const name = rest[0]
    if (!name) return createResultError(op, "usage: edit <name> [flags]")
    const body = projectBodyFromFlags(rest.slice(1))
    const r = await apiFetch(socketPath, `/projects/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
    if (!r.success) return r
    return createResult(JSON.stringify(r.data, null, 2))
  }

  if (cmd === "delete") {
    const name = rest[0]
    if (!name) return createResultError(op, "usage: delete <name>")
    const r = await apiFetch(socketPath, `/projects/${encodeURIComponent(name)}`, { method: "DELETE" })
    if (!r.success) return r
    return createResult(JSON.stringify(r.data, null, 2))
  }

  if (cmd === "config") {
    const pretty = flagBool(rest, "--pretty")
    const r = await apiFetch(socketPath, `/config${pretty ? "?pretty=1" : ""}`)
    if (!r.success) return r
    if (typeof r.data === "string") return createResult(r.data)
    return createResult(JSON.stringify(r.data, null, pretty ? 2 : 0))
  }

  if (cmd === "history") {
    const qs = new URLSearchParams()
    const name = flagOne(rest, "--name")
    if (name) qs.set("name", name)
    const limit = flagOne(rest, "--limit")
    if (limit) qs.set("limit", limit)
    const q = qs.toString()
    const r = await apiFetch(socketPath, `/history${q ? `?${q}` : ""}`)
    if (!r.success) return r
    return createResult(JSON.stringify(r.data, null, 2))
  }

  if (cmd === "apply") {
    const r = await apiFetch(socketPath, "/apply", { method: "POST" })
    if (!r.success) return r
    return createResult("applied")
  }

  return createResultError(op, `unknown command: ${cmd}`)
}
