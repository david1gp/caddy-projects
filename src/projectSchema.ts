import * as a from "valibot"

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
}

export const projectInputSchema = a.object({
  port: a.pipe(a.number(), a.integer(), a.minValue(1), a.maxValue(65535)),
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
})

export type ProjectInput = {
  port: number
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
}
