import { buildCommand, type CommandContext } from "@stricli/core"
import { createResultError } from "#result"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type DeleteFlags = {
  port?: number
  socket?: string
}

export const projectDeleteCommand = buildCommand({
  async func(this: CommandContext, flags: DeleteFlags, name?: string) {
    const op = "projectDeleteCommand"
    const socketPath = cliSocketPath(flags.socket)
    const hasName = name !== undefined && name !== ""
    const hasPort = flags.port !== undefined

    if (hasName === hasPort) {
      cliFail(
        createResultError(
          op,
          hasName ? "provide either <name> or --port, not both" : "provide either <name> or --port",
        ),
      )
    }

    const path = hasPort ? `/projects/by-port/${flags.port}` : `/projects/${encodeURIComponent(name!)}`
    const r = await cliApiFetch(socketPath, path, { method: "DELETE" })
    if (!r.success) cliFail(r)
    this.process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`)
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Project name (omit when using --port)",
          parse: String,
          placeholder: "name",
          optional: true,
        },
      ],
    },
    flags: {
      port: {
        kind: "parsed",
        parse: Number,
        optional: true,
        brief: "Delete own project by port instead of name",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Delete a project by name or --port",
  },
})
