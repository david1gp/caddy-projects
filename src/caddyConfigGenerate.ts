import { createResult, createResultError, type Result } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import type { CaddyConfigOptions, OidcOptions } from "./caddyConfigOptionsSchema.js"
import { caddyDocsTemplate } from "./caddyDocsTemplate.js"
import type { Project } from "./projectSchema.js"

function oidcNormalized(oidc: OidcOptions): Required<OidcOptions> {
  return {
    providerName: oidc.providerName,
    issuer: oidc.issuer,
    clientId: oidc.clientId,
    clientSecret: oidc.clientSecret,
    scope: oidc.scope ?? ["openid", "email", "profile"],
    username: oidc.username ?? "email",
    cookieName: oidc.cookieName ?? "caddy",
    cookieSecret: oidc.cookieSecret,
    cookieMaxAge: oidc.cookieMaxAge ?? "168h",
    redirectUrl: oidc.redirectUrl ?? "/oauth2/callback",
  }
}

function oidcHandler(providerName: string): unknown {
  return {
    handler: "oidc",
    provider: providerName,
    policies: [
      {
        action: "allow",
        match: {
          user: {
            usernames: ["*"],
          },
        },
      },
    ],
  }
}

function docsRoutes(docsRoot: string): unknown[] {
  return [
    {
      group: "docs",
      match: [
        {
          path_regexp: {
            name: "project_docs",
            pattern: "^/docs/((?:[A-Za-z0-9][A-Za-z0-9._-]*/)*[A-Za-z0-9][A-Za-z0-9._-]*\\.md)$",
          },
        },
      ],
      handle: [
        {
          handler: "subroute",
          routes: [
            {
              handle: [
                { handler: "vars", root: docsRoot },
                {
                  handler: "headers",
                  response: {
                    set: {
                      "Content-Type": ["text/html; charset=utf-8"],
                      "Content-Security-Policy": [
                        "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'",
                      ],
                      "X-Content-Type-Options": ["nosniff"],
                    },
                  },
                },
                { handler: "templates" },
                { handler: "static_response", body: caddyDocsTemplate },
              ],
            },
          ],
        },
      ],
    },
    {
      group: "docs",
      match: [{ path: ["/docs", "/docs/*"] }],
      handle: [
        {
          handler: "subroute",
          routes: [
            {
              handle: [{ handler: "static_response", body: "Not found", status_code: 404 }],
            },
          ],
        },
      ],
    },
  ]
}

function proxyHandler(project: Project): Record<string, unknown> {
  const proxy: Record<string, unknown> = {
    handler: "reverse_proxy",
    upstreams: [{ dial: `localhost:${project.port}` }],
  }
  const headerEntries = Object.entries(project.headerUp)
  if (headerEntries.length > 0) {
    const set: Record<string, string[]> = {}
    for (const [k, v] of headerEntries) {
      set[k] = [v]
    }
    proxy.headers = { request: { set } }
  }
  return proxy
}

function staticHandles(project: Project): unknown[] {
  const handles: unknown[] = [{ handler: "vars", root: project.path }]
  if (project.spa === true) {
    handles.push({
      handler: "rewrite",
      uri: "{http.matchers.file.relative}",
    })
  }
  const fileServer: Record<string, unknown> = { handler: "file_server" }
  if (project.browse) {
    if (project.browseTemplate) {
      fileServer.browse = { template_file: project.browseTemplate }
    } else {
      fileServer.browse = {}
    }
  }
  handles.push(fileServer)
  return handles
}

/** Route entry for static sites; SPA uses try_files {path} /index.html */
function staticRoute(project: Project): Record<string, unknown> {
  const handles = staticHandles(project)
  if (project.spa === true) {
    return {
      match: [
        {
          file: {
            // root required on matcher: file match runs before vars handler
            root: project.path,
            try_files: ["{http.request.uri.path}", "/index.html"],
          },
        },
      ],
      handle: handles,
    }
  }
  return { handle: handles }
}

function projectRouteBuild(project: Project, options: CaddyConfigOptions): unknown {
  const inner: unknown[] = []

  const routedValue = project.routed ?? (project.kind === "static" ? "static" : String(project.port))

  inner.push({
    handle: [
      {
        handler: "headers",
        response: {
          set: {
            Routed: [routedValue],
          },
        },
      },
    ],
  })

  const pathOidc = project.oidcPaths !== undefined && project.oidcPaths.length > 0 && options.oidc
  const fullOidc = !pathOidc && project.access === "internal" && options.oidc

  if (fullOidc && options.oidc) {
    inner.push({
      handle: [oidcHandler(options.oidc.providerName)],
    })
  }

  const docsRoot =
    project.docs === true
      ? project.docsPath && project.docsPath !== ""
        ? project.docsPath
        : project.path !== ""
          ? `${project.path}/docs`
          : ""
      : ""
  if (docsRoot !== "") {
    inner.push(...docsRoutes(docsRoot))
  }

  if (project.denyDotfiles === true) {
    inner.push({
      match: [{ path_regexp: { pattern: "^/\\..*" } }],
      handle: [{ handler: "static_response", body: "Not found", status_code: 404 }],
    })
  }

  if (project.staticAllow && project.staticAllow.length > 0 && project.kind === "static") {
    // Paths not in allowlist → 403 (wiki-style). Matchers under `not` are OR'd.
    const allowMatchers = project.staticAllow.map((p) => ({ path: [p] }))
    inner.push({
      match: [{ not: allowMatchers }],
      handle: [
        {
          handler: "static_response",
          body: "Only markdown and YAML files are accessible",
          status_code: 403,
        },
      ],
    })
  }

  if (pathOidc && options.oidc) {
    // Path-scoped OIDC: gated paths get oidc + terminal handler; rest continue
    if (project.kind === "proxy") {
      inner.push({
        match: [{ path: [...project.oidcPaths!] }],
        handle: [
          {
            handler: "subroute",
            routes: [
              {
                handle: [oidcHandler(options.oidc.providerName), proxyHandler(project)],
              },
            ],
          },
        ],
      })
      inner.push({ handle: [proxyHandler(project)] })
    } else {
      const spaStatic = staticRoute(project)
      inner.push({
        match: [{ path: [...project.oidcPaths!] }],
        handle: [
          {
            handler: "subroute",
            routes: [
              {
                handle: [oidcHandler(options.oidc.providerName), ...(spaStatic.handle as unknown[])],
                ...(spaStatic.match ? { match: spaStatic.match } : {}),
              },
            ],
          },
        ],
      })
      inner.push(spaStatic)
    }
  } else if (project.kind === "proxy") {
    inner.push({ handle: [proxyHandler(project)] })
  } else {
    inner.push(staticRoute(project))
  }

  return {
    match: [{ host: [...project.domains] }],
    terminal: true,
    handle: [{ handler: "subroute", routes: inner }],
  }
}

export function caddyConfigGenerate(projects: Project[], options: CaddyConfigOptions = {}): Result<CaddyConfig> {
  const op = "caddyConfigGenerate"
  const httpPort = options.httpPort ?? 443
  const active = projects.filter((p) => !p.disabled && !p.template)

  const domainOwner = new Map<string, string>()
  for (const p of active) {
    if (p.kind === "static" && p.path === "") {
      return createResultError(op, `static project requires path: ${p.name}`)
    }
    for (const d of p.domains) {
      const existing = domainOwner.get(d)
      if (existing) {
        return createResultError(op, `duplicate domain: ${d}`)
      }
      domainOwner.set(d, p.name)
    }
  }

  const sorted = [...active].sort((a, b) => {
    const da = a.domains[0] ?? a.name
    const db = b.domains[0] ?? b.name
    return da.localeCompare(db)
  })

  const routes = sorted.map((p) => projectRouteBuild(p, options))

  const config: CaddyConfig = {
    apps: {
      http: {
        servers: {
          srv0: {
            listen: [`:${httpPort}`],
            routes,
          },
        },
      },
    },
  }

  if (options.oidc) {
    const o = oidcNormalized(options.oidc)
    config.apps.oidc = {
      providers: {
        [o.providerName]: {
          issuer: o.issuer,
          client_id: o.clientId,
          client_secret: o.clientSecret,
          scope: o.scope,
          username: o.username,
          authenticators: {
            authenticators: [
              {
                authenticator: "cookie",
                name: o.cookieName,
                secret: o.cookieSecret,
                max_age: o.cookieMaxAge,
                redirect_url: o.redirectUrl,
              },
            ],
          },
        },
      },
    }
  }

  return createResult(config)
}
