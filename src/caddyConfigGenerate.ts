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

function projectRouteBuild(project: Project, options: CaddyConfigOptions): unknown {
  const inner: unknown[] = []

  inner.push({
    handle: [
      {
        handler: "headers",
        response: {
          set: {
            Routed: [String(project.kind === "static" ? "static" : project.port)],
          },
        },
      },
    ],
  })

  if (project.access === "internal" && options.oidc) {
    inner.push({
      handle: [
        {
          handler: "oidc",
          inherits: options.oidc.providerName,
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
        },
      ],
    })
  }

  if (project.docs === true && project.path !== "") {
    const docsRoot = `${project.path}/docs`
    inner.push({
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
    })
    inner.push({
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
    })
  }

  if (project.kind === "proxy") {
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
    inner.push({ handle: [proxy] })
  } else {
    const handles: unknown[] = [{ handler: "vars", root: project.path }]
    const fileServer: Record<string, unknown> = { handler: "file_server" }
    if (project.browse) {
      fileServer.browse = {}
    }
    handles.push(fileServer)
    inner.push({ handle: handles })
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
