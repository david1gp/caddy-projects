import * as a from "valibot"

export const cliCreateBodySchema = a.object({
  name: a.pipe(a.string(), a.regex(/^[a-z0-9][a-z0-9-]*$/)),
  port: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1), a.maxValue(65535))),
  domains: a.pipe(a.array(a.pipe(a.string(), a.minLength(1))), a.minLength(1)),
  path: a.optional(a.string()),
  kind: a.optional(a.picklist(["proxy", "static"])),
  access: a.optional(a.picklist(["internal", "external"])),
  docs: a.optional(a.boolean()),
  browse: a.optional(a.boolean()),
  shared: a.optional(a.boolean()),
  template: a.optional(a.boolean()),
  disabled: a.optional(a.boolean()),
  spa: a.optional(a.boolean()),
  headerUp: a.optional(a.record(a.string(), a.string())),
  flushInterval: a.optional(a.number()),
})

export type CliCreateBody = a.InferOutput<typeof cliCreateBodySchema>
