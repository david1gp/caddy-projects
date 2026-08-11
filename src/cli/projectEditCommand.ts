import { buildCommand, type CommandContext } from "@stricli/core"
import * as a from "valibot"
import { createResultError } from "#result"
import { cliApiFetch } from "./cliApiFetch.js"
import { type CliBodyFlags, cliBodyFromFlags } from "./cliBodyFromFlags.js"
import { cliBooleanPairFlags } from "./cliBooleanPairFlags.js"
import { cliEditBodySchema } from "./cliEditBodySchema.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type EditFlags = CliBodyFlags & {
  socket?: string
}

export const projectEditCommand = buildCommand({
  async func(this: CommandContext, flags: EditFlags, name: string) {
    const op = "projectEditCommand"
    const socketPath = cliSocketPath(flags.socket)
    const bodyR = cliBodyFromFlags(flags)
    if (!bodyR.success) cliFail(bodyR)

    const parsed = a.safeParse(cliEditBodySchema, bodyR.data)
    if (!parsed.success) {
      cliFail(createResultError(op, a.summarize(parsed.issues), JSON.stringify(bodyR.data)))
    }

    const r = await cliApiFetch(socketPath, `/projects/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.output),
    })
    if (!r.success) cliFail(r)
    this.process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`)
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Project name",
          parse: String,
          placeholder: "name",
        },
      ],
    },
    flags: {
      name: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "Rename project (slug: a-z0-9-)",
      },
      port: {
        kind: "parsed",
        parse: Number,
        optional: true,
        brief: "Upstream port 1..65535",
      },
      domain: {
        kind: "parsed",
        parse: String,
        variadic: true,
        optional: true,
        brief: "Hostname (repeatable; replaces domains when set)",
      },
      path: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "Filesystem path for static/docs",
      },
      kind: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "proxy or static",
      },
      access: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "internal or external",
      },
      headerUp: {
        kind: "parsed",
        parse: String,
        variadic: true,
        optional: true,
        brief: "Reverse-proxy header_up as K=V (repeatable)",
      },
      flushInterval: {
        kind: "parsed",
        parse: Number,
        optional: true,
        brief: "reverse_proxy flush_interval (-1 for immediate flush / SSE)",
      },
      ...cliBooleanPairFlags,
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Edit a project (partial PATCH)",
  },
})
