import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"
import { cliTableProjects } from "./cliTableProjects.js"

type ConfigFlags = {
  pretty?: boolean
  json?: boolean
  socket?: string
}

export const configShowCommand = buildCommand({
  async func(this: CommandContext, flags: ConfigFlags, selector?: string) {
    const socketPath = cliSocketPath(flags.socket)

    if (selector === undefined) {
      const r = await cliApiFetch(socketPath, "/config?summary=1")
      if (!r.success) cliFail(r)
      const entries = r.data as Array<Record<string, unknown>>
      if (flags.json) {
        this.process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`)
        return
      }
      if (entries.length === 0) {
        this.process.stdout.write("no server blocks in config\n")
        return
      }
      this.process.stdout.write(`${cliTableProjects(entries)}\n`)
      return
    }

    if (selector === "all") {
      const pretty = flags.pretty === true
      const r = await cliApiFetch(socketPath, `/config${pretty ? "?pretty=1" : ""}`)
      if (!r.success) cliFail(r)
      if (typeof r.data === "string") {
        this.process.stdout.write(`${r.data}\n`)
        return
      }
      this.process.stdout.write(`${JSON.stringify(r.data, null, pretty ? 2 : 0)}\n`)
      return
    }

    const pretty = flags.pretty !== false
    const qs = new URLSearchParams({ select: selector })
    if (pretty) qs.set("pretty", "1")
    const r = await cliApiFetch(socketPath, `/config?${qs.toString()}`)
    if (!r.success) cliFail(r)
    if (typeof r.data === "string") {
      this.process.stdout.write(`${r.data}\n`)
      return
    }
    this.process.stdout.write(`${JSON.stringify(r.data, null, pretty ? 2 : 0)}\n`)
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: 'Selector: "all", project name, domain, or port (omit for summary)',
          parse: String,
          placeholder: "selector",
          optional: true,
        },
      ],
    },
    flags: {
      pretty: {
        kind: "boolean",
        optional: true,
        brief: "Pretty-print JSON (default on for selector; use with all)",
      },
      json: {
        kind: "boolean",
        optional: true,
        brief: "Output summary as JSON instead of a table",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: 'Show generated Caddy config: no arg = summary, "all" = full JSON, or a project name / domain / port',
  },
})
