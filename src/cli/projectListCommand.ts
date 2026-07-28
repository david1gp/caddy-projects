import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"
import { cliTableProjects } from "./cliTableProjects.js"

type ListFlags = {
  mine?: boolean
  templates?: boolean
  json?: boolean
  socket?: string
}

export const projectListCommand = buildCommand({
  async func(this: CommandContext, flags: ListFlags) {
    const socketPath = cliSocketPath(flags.socket)
    const qs = new URLSearchParams()
    if (flags.mine) qs.set("mine", "1")
    if (flags.templates) qs.set("templates", "1")
    const q = qs.toString()
    const r = await cliApiFetch(socketPath, `/projects${q ? `?${q}` : ""}`)
    if (!r.success) cliFail(r)
    if (flags.json) {
      this.process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`)
      return
    }
    this.process.stdout.write(`${cliTableProjects(r.data as Array<Record<string, unknown>>)}\n`)
  },
  parameters: {
    flags: {
      mine: {
        kind: "boolean",
        optional: true,
        brief: "Only list projects owned by the current user",
      },
      templates: {
        kind: "boolean",
        optional: true,
        brief: "Only list template projects",
      },
      json: {
        kind: "boolean",
        optional: true,
        brief: "Output JSON instead of a table",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "List visible projects",
  },
})
