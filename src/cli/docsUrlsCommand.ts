import { buildCommand, type CommandContext } from "@stricli/core"
import { cliApiFetch } from "./cliApiFetch.js"
import { cliFail } from "./cliFail.js"
import { cliSocketFlag } from "./cliSocketFlag.js"
import { cliSocketPath } from "./cliSocketPath.js"
import { projectNameFromPath } from "./projectNameFromPath.js"

type DocsFlags = {
  json?: boolean
  http?: boolean
  socket?: string
}

export const docsUrlsCommand = buildCommand({
  async func(this: CommandContext, flags: DocsFlags, nameOrPath: string, path?: string) {
    const socketPath = cliSocketPath(flags.socket)

    let name: string
    let docsPath: string
    if (path !== undefined) {
      name = nameOrPath
      docsPath = path
    } else {
      docsPath = nameOrPath
      const listR = await cliApiFetch(socketPath, "/projects")
      if (!listR.success) cliFail(listR)
      const projects = listR.data as Array<{ name: string; path: string }>
      const nameR = projectNameFromPath(projects, this.process.cwd())
      if (!nameR.success) cliFail(nameR)
      name = nameR.data
    }

    const qs = new URLSearchParams({ path: docsPath })
    if (flags.http === true) qs.set("scheme", "http")
    const r = await cliApiFetch(socketPath, `/projects/${encodeURIComponent(name)}/docs?${qs.toString()}`)
    if (!r.success) cliFail(r)
    const data = r.data as { urls: string[] }
    if (flags.json) {
      this.process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
      return
    }
    for (const url of data.urls) {
      this.process.stdout.write(`${url}\n`)
    }
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Project name, or docs path when name is omitted (inferred from cwd)",
          parse: String,
          placeholder: "name-or-path",
        },
        {
          brief: "Docs path relative to /docs/ (e.g. guide/intro.md); required when name is given",
          parse: String,
          placeholder: "path",
          optional: true,
        },
      ],
    },
    flags: {
      json: {
        kind: "boolean",
        optional: true,
        brief: "Output JSON { urls }",
      },
      http: {
        kind: "boolean",
        optional: true,
        brief: "Use http:// instead of https://",
      },
      socket: cliSocketFlag,
    },
  },
  docs: {
    brief: "Public review URLs for a docs markdown path (HTML-rendered at /docs/*.md)",
  },
})
