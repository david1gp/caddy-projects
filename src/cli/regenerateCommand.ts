import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type RegenerateFlags = {
  socket?: string
}

export const regenerateCommand = buildCommand({
  async func(this: CommandContext, flags: RegenerateFlags) {
    const socketPath = cliSocketPath(flags.socket)
    const r = await cliApiFetch(socketPath, "/regenerate", { method: "POST" })
    if (!r.success) cliFail(r)
    this.process.stdout.write("regenerated\n")
  },
  parameters: {
    flags: {
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Force regenerate + validate + reload Caddy config",
  },
})
