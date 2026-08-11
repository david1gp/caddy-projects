import * as a from "valibot"

const optionalExtras = {
  /** Override Routed response header (default: port or "static") */
  routed: a.optional(a.string()),
  /** Path-scoped OIDC (only these paths gated); empty/undefined + access=internal => full host */
  oidcPaths: a.optional(a.array(a.pipe(a.string(), a.minLength(1)))),
  /** Override docs root (default: `${path}/docs`) */
  docsPath: a.optional(a.string()),
  /** file_server browse template path (Caddy browse { template }) */
  browseTemplate: a.optional(a.string()),
  /** If set, only these path matchers are allowed for static (wiki-style allowlist) */
  staticAllow: a.optional(a.array(a.pipe(a.string(), a.minLength(1)))),
  /** Block paths matching ^/\..* before file_server */
  denyDotfiles: a.optional(a.boolean(), false),
  /** Static SPA: try_files {path} /index.html before file_server */
  spa: a.optional(a.boolean(), false),
  /**
   * reverse_proxy flush_interval (Caddy duration ns, or -1 for immediate flush).
   * Recommended -1 for SSE/streaming backends such as OpenCode.
   */
  flushInterval: a.optional(a.number()),
}

export const projectSchema = a.object({
  port: a.pipe(a.number(), a.integer(), a.minValue(1), a.maxValue(65535)),
  domains: a.pipe(a.array(a.pipe(a.string(), a.minLength(1))), a.minLength(1)),
  name: a.pipe(a.string(), a.regex(/^[a-z0-9][a-z0-9-]*$/)),
  path: a.optional(a.string(), ""),
  user: a.pipe(a.string(), a.minLength(1)),
  access: a.optional(a.picklist(["internal", "external"]), "external"),
  kind: a.optional(a.picklist(["proxy", "static"]), "proxy"),
  docs: a.optional(a.boolean(), true),
  browse: a.optional(a.boolean(), false),
  headerUp: a.optional(a.record(a.string(), a.string()), {}),
  shared: a.optional(a.boolean(), false),
  template: a.optional(a.boolean(), false),
  disabled: a.optional(a.boolean(), false),
  ...optionalExtras,
})

export type Project = {
  port: number
  domains: string[]
  name: string
  path: string
  user: string
  access: "internal" | "external"
  kind: "proxy" | "static"
  docs: boolean
  browse: boolean
  headerUp: Record<string, string>
  shared: boolean
  template: boolean
  disabled: boolean
  routed?: string
  oidcPaths?: string[]
  docsPath?: string
  browseTemplate?: string
  staticAllow?: string[]
  denyDotfiles?: boolean
  spa?: boolean
  flushInterval?: number
}

export const projectInputSchema = a.object({
  port: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1), a.maxValue(65535))),
  domains: a.pipe(a.array(a.pipe(a.string(), a.minLength(1))), a.minLength(1)),
  name: a.pipe(a.string(), a.regex(/^[a-z0-9][a-z0-9-]*$/)),
  path: a.optional(a.string(), ""),
  access: a.optional(a.picklist(["internal", "external"]), "external"),
  kind: a.optional(a.picklist(["proxy", "static"]), "proxy"),
  docs: a.optional(a.boolean(), true),
  browse: a.optional(a.boolean(), false),
  headerUp: a.optional(a.record(a.string(), a.string()), {}),
  shared: a.optional(a.boolean(), false),
  template: a.optional(a.boolean(), false),
  disabled: a.optional(a.boolean(), false),
  ...optionalExtras,
})

export type ProjectInput = {
  port?: number
  domains: string[]
  name: string
  path: string
  access: "internal" | "external"
  kind: "proxy" | "static"
  docs: boolean
  browse: boolean
  headerUp: Record<string, string>
  shared: boolean
  template: boolean
  disabled: boolean
  routed?: string
  oidcPaths?: string[]
  docsPath?: string
  browseTemplate?: string
  staticAllow?: string[]
  denyDotfiles?: boolean
  spa?: boolean
  flushInterval?: number
}
