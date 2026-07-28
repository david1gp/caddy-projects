import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type ConfigFlags = {
  pretty?: boolean
  socket?: string
}

export const configShowCommand = buildCommand({
  async func(this: CommandContext, flags: ConfigFlags) {
    const socketPath = cliSocketPath(flags.socket)
    const pretty = flags.pretty === true
    const r = await cliApiFetch(socketPath, `/config${pretty ? "?pretty=1" : ""}`)
    if (!r.success) cliFail(r)
    if (typeof r.data === "string") {
      this.process.stdout.write(`${r.data}\n`)
      return
    }
    this.process.stdout.write(`${JSON.stringify(r.data, null, pretty ? 2 : 0)}\n`)
  },
  parameters: {
    flags: {
      pretty: {
        kind: "boolean",
        optional: true,
        brief: "Pretty-print the generated Caddy JSON",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Show generated Caddy config",
  },
})
