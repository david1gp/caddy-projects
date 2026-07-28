import * as a from "valibot"

export const oidcOptionsSchema = a.object({
  providerName: a.pipe(a.string(), a.minLength(1)),
  issuer: a.pipe(a.string(), a.minLength(1)),
  clientId: a.pipe(a.string(), a.minLength(1)),
  clientSecret: a.pipe(a.string(), a.minLength(1)),
  scope: a.optional(a.array(a.string()), ["openid", "email", "profile"]),
  username: a.optional(a.string(), "email"),
  cookieName: a.optional(a.string(), "caddy"),
  cookieSecret: a.pipe(
    a.string(),
    a.check((s) => s.length === 32 || s.length === 64, "cookieSecret must be exactly 32 or 64 bytes long"),
  ),
  cookieMaxAge: a.optional(a.string(), "168h"),
  redirectUrl: a.optional(a.string(), "/oauth2/callback"),
})

export type OidcOptions = {
  providerName: string
  issuer: string
  clientId: string
  clientSecret: string
  scope?: string[]
  username?: string
  cookieName?: string
  cookieSecret: string
  cookieMaxAge?: string
  redirectUrl?: string
}

export const caddyConfigOptionsSchema = a.object({
  httpPort: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1), a.maxValue(65535)), 443),
  oidc: a.optional(oidcOptionsSchema),
})

export type CaddyConfigOptions = {
  httpPort?: number
  oidc?: OidcOptions
}
