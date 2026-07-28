import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"

type HistoryFlags = {
  name?: string
  limit?: number
  socket?: string
}

export const historyShowCommand = buildCommand({
  async func(this: CommandContext, flags: HistoryFlags) {
    const socketPath = cliSocketPath(flags.socket)
    const qs = new URLSearchParams()
    if (flags.name) qs.set("name", flags.name)
    if (flags.limit !== undefined) qs.set("limit", String(flags.limit))
    const q = qs.toString()
    const r = await cliApiFetch(socketPath, `/history${q ? `?${q}` : ""}`)
    if (!r.success) cliFail(r)
    this.process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`)
  },
  parameters: {
    flags: {
      name: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "Filter history by project name",
      },
      limit: {
        kind: "parsed",
        parse: Number,
        optional: true,
        brief: "Max number of commits to return",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Show git history of project changes",
  },
})
