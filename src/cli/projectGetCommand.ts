import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type GetFlags = {
  json?: boolean
  socket?: string
}

export const projectGetCommand = buildCommand({
  async func(this: CommandContext, flags: GetFlags, name: string) {
    const socketPath = cliSocketPath(flags.socket)
    const r = await cliApiFetch(socketPath, `/projects/${encodeURIComponent(name)}`)
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
      json: {
        kind: "boolean",
        optional: true,
        brief: "Output JSON (default)",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Get a project by name",
  },
})
