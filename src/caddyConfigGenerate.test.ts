import { describe, expect, test } from "bun:test"
import {
  oidcTestOptions,
  projectBlue,
  projectDemos,
  projectHermes,
  projectOpencode,
  projectStartup,
  referenceProjects,
} from "../test/referenceProjects.js"
import { caddyConfigGenerate } from "./caddyConfigGenerate.js"
import type { Project } from "./projectSchema.js"

function routesOf(config: { apps: { http: { servers: { srv0: { routes: unknown[] } } } } }) {
  return config.apps.http.servers.srv0.routes as Array<Record<string, unknown>>
}

function hostOf(route: Record<string, unknown>): string[] {
  const match = route.match as Array<{ host: string[] }>
  return match[0]!.host
}

function innerHandles(route: Record<string, unknown>): unknown[] {
  const handle = route.handle as Array<{
    handler: string
    routes: Array<{ handle?: unknown[]; match?: unknown; group?: string }>
  }>
  return handle[0]!.routes
}

describe("caddyConfigGenerate", () => {
  test("generates one route per active project, sorted by first domain", () => {
    const r = caddyConfigGenerate(referenceProjects, { oidc: oidcTestOptions })
    expect(r.success).toBe(true)
    if (!r.success) return
    const routes = routesOf(r.data)
    expect(routes.length).toBe(5)
    const hosts = routes.map((rt) => hostOf(rt)[0])
    const sorted = [...hosts].sort((a, b) => a!.localeCompare(b!))
    expect(hosts).toEqual(sorted)
  })

  test("opencode: multi-domain proxy, no oidc, no docs, Routed=port, flush_interval -1", () => {
    const r = caddyConfigGenerate([projectOpencode], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const route = routesOf(r.data)[0]!
    expect(hostOf(route)).toEqual(projectOpencode.domains)
    expect(route.terminal).toBe(true)
    const inner = innerHandles(route) as Array<Record<string, unknown>>
    const headers = (inner[0]!.handle as Array<Record<string, unknown>>)[0]!
    expect(headers.handler).toBe("headers")
    expect((headers.response as { set: { Routed: string[] } }).set.Routed).toEqual(["4096"])
    const proxyRoute = inner[inner.length - 1]! as { handle: Array<Record<string, unknown>> }
    expect(proxyRoute.handle[0]!.handler).toBe("reverse_proxy")
    expect(proxyRoute.handle[0]!.upstreams).toEqual([{ dial: "localhost:4096" }])
    expect(proxyRoute.handle[0]!.flush_interval).toBe(-1)
    const allHandlers = JSON.stringify(inner)
    expect(allHandlers).not.toContain('"handler":"oidc"')
    expect(allHandlers).not.toContain("project_docs")
  })

  test("proxy without flushInterval omits flush_interval", () => {
    const r = caddyConfigGenerate([projectHermes], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const proxy = (innerHandles(routesOf(r.data)[0]!).at(-1) as { handle: Array<Record<string, unknown>> }).handle[0]!
    expect(proxy.handler).toBe("reverse_proxy")
    expect(proxy.flush_interval).toBeUndefined()
  })

  test("startup: proxy + docs routes", () => {
    const r = caddyConfigGenerate([projectStartup], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const inner = innerHandles(routesOf(r.data)[0]!) as Array<Record<string, unknown>>
    const docs = inner.filter((x) => x.group === "docs")
    expect(docs.length).toBe(2)
    const mdMatch = docs[0]!.match as Array<{ path_regexp: { name: string; pattern: string } }>
    expect(mdMatch[0]!.path_regexp.name).toBe("project_docs")
    const fallback = docs[1]!.match as Array<{ path: string[] }>
    expect(fallback[0]!.path).toEqual(["/docs", "/docs/*"])
  })

  test("hermes: oidc + headerUp + reverse_proxy dial", () => {
    const r = caddyConfigGenerate([projectHermes], { oidc: oidcTestOptions })
    expect(r.success).toBe(true)
    if (!r.success) return
    const config = r.data
    expect(config.apps.oidc).toBeDefined()
    expect(config.apps.oidc?.providers.zitadel?.issuer).toBe("https://auth.contentoren.de")
    const inner = innerHandles(routesOf(config)[0]!) as Array<Record<string, unknown>>
    const oidcHandle = (inner[1]!.handle as Array<Record<string, unknown>>)[0]!
    expect(oidcHandle.handler).toBe("oidc")
    expect(oidcHandle.provider).toBe("zitadel")
    const proxy = (inner[inner.length - 1]!.handle as Array<Record<string, unknown>>)[0]!
    expect(proxy.handler).toBe("reverse_proxy")
    expect(proxy.upstreams).toEqual([{ dial: "localhost:9119" }])
    expect(proxy.headers).toEqual({
      request: {
        set: {
          Host: ["127.0.0.1:9119"],
          Origin: ["http://127.0.0.1:9119"],
        },
      },
    })
  })

  test("demos: static + docs, Routed=static", () => {
    const r = caddyConfigGenerate([projectDemos], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const inner = innerHandles(routesOf(r.data)[0]!) as Array<Record<string, unknown>>
    const headers = (inner[0]!.handle as Array<Record<string, unknown>>)[0]!
    expect((headers.response as { set: { Routed: string[] } }).set.Routed).toEqual(["static"])
    const terminal = inner[inner.length - 1]! as { handle: Array<Record<string, unknown>>; match?: unknown }
    expect(terminal.match).toBeUndefined()
    expect(terminal.handle[0]!.handler).toBe("vars")
    expect(terminal.handle[0]!.root).toBe("/home/leo/projects/demos")
    expect(terminal.handle[1]!.handler).toBe("file_server")
    expect(terminal.handle[1]!.browse).toBeUndefined()
  })

  test("static spa: try_files {path} /index.html + rewrite + file_server", () => {
    const spa: Project = { ...projectDemos, name: "spa-app", domains: ["spa.example"], docs: false, spa: true }
    const r = caddyConfigGenerate([spa], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const terminal = innerHandles(routesOf(r.data)[0]!).at(-1) as {
      match: Array<{ file: { try_files: string[] } }>
      handle: Array<Record<string, unknown>>
    }
    expect(terminal.match[0]!.file.root).toBe("/home/leo/projects/demos")
    expect(terminal.match[0]!.file.try_files).toEqual(["{http.request.uri.path}", "/index.html"])
    expect(terminal.handle[0]!.handler).toBe("vars")
    expect(terminal.handle[0]!.root).toBe("/home/leo/projects/demos")
    expect(terminal.handle[1]!.handler).toBe("rewrite")
    expect(terminal.handle[1]!.uri).toBe("{http.matchers.file.relative}")
    expect(terminal.handle[2]!.handler).toBe("file_server")
  })

  test("static without spa omits try_files and rewrite", () => {
    const r = caddyConfigGenerate([{ ...projectDemos, spa: false }], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const all = JSON.stringify(routesOf(r.data)[0])
    expect(all).not.toContain("try_files")
    expect(all).not.toContain('"handler":"rewrite"')
  })

  test("blue: static + browse + oidc + docs", () => {
    const r = caddyConfigGenerate([projectBlue], { oidc: oidcTestOptions })
    expect(r.success).toBe(true)
    if (!r.success) return
    const inner = innerHandles(routesOf(r.data)[0]!) as Array<Record<string, unknown>>
    expect(JSON.stringify(inner)).toContain('"handler":"oidc"')
    const terminal = inner[inner.length - 1]!.handle as Array<Record<string, unknown>>
    expect(terminal[1]!.handler).toBe("file_server")
    expect(terminal[1]!.browse).toEqual({})
  })

  test("skips disabled and template projects", () => {
    const disabled: Project = { ...projectOpencode, name: "x", domains: ["x.example"], disabled: true }
    const tmpl: Project = { ...projectOpencode, name: "y", domains: ["y.example"], template: true }
    const r = caddyConfigGenerate([disabled, tmpl, projectHermes], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(routesOf(r.data).length).toBe(1)
  })

  test("rejects duplicate domains", () => {
    const dup: Project = { ...projectHermes, name: "other", port: 1 }
    const r = caddyConfigGenerate([projectHermes, dup], {})
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toContain("duplicate domain")
  })

  test("rejects static without path", () => {
    const bad: Project = { ...projectDemos, path: "" }
    const r = caddyConfigGenerate([bad], {})
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toContain("static project requires path")
  })

  // docs defaults to true, so a project without a path must still generate: docs routes are simply skipped.
  test("docs without path skips the docs routes instead of failing", () => {
    const noPath: Project = { ...projectStartup, path: "" }
    const r = caddyConfigGenerate([noPath], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const routes = r.data.apps.http.servers.srv0.routes as Array<{
      handle: Array<{ routes: Array<{ group?: string }> }>
    }>
    const inner = routes[0]!.handle[0]!.routes
    expect(inner.some((x) => x.group === "docs")).toBe(false)
  })

  test("internal without oidc options omits oidc handler", () => {
    const r = caddyConfigGenerate([projectHermes], {})
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apps.oidc).toBeUndefined()
    expect(JSON.stringify(r.data)).not.toContain('"handler":"oidc"')
  })
})
