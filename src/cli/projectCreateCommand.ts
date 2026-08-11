import { buildCommand, type CommandContext } from "@stricli/core"
import * as a from "valibot"
import { createResultError } from "#result"
import { cliApiFetch } from "./cliApiFetch.js"
import { type CliBodyFlags, cliBodyFromFlags } from "./cliBodyFromFlags.js"
import { cliBooleanPairFlags } from "./cliBooleanPairFlags.js"
import { cliCreateBodySchema } from "./cliCreateBodySchema.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type CreateFlags = CliBodyFlags & {
  name: string
  domain: string[]
  socket?: string
}

export const projectCreateCommand = buildCommand({
  async func(this: CommandContext, flags: CreateFlags) {
    const op = "projectCreateCommand"
    const socketPath = cliSocketPath(flags.socket)
    const bodyR = cliBodyFromFlags(flags)
    if (!bodyR.success) cliFail(bodyR)

    const parsed = a.safeParse(cliCreateBodySchema, bodyR.data)
    if (!parsed.success) {
      cliFail(createResultError(op, a.summarize(parsed.issues), JSON.stringify(bodyR.data)))
    }

    const r = await cliApiFetch(socketPath, "/projects", {
      method: "POST",
      body: JSON.stringify(parsed.output),
    })
    if (!r.success) cliFail(r)

    const project = r.data as { name: string; port: number }
    this.process.stdout.write(`created ${project.name} (port ${project.port})\n`)
  },
  parameters: {
    flags: {
      name: {
        kind: "parsed",
        parse: String,
        brief: "Project name (slug: a-z0-9-)",
      },
      port: {
        kind: "parsed",
        parse: Number,
        optional: true,
        brief: "Upstream port 1..65535 (auto-assigned when omitted)",
      },
      domain: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Hostname (repeatable; at least one required)",
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
    brief: "Create a project",
  },
})
