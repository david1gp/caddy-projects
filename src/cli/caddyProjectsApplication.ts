import { buildApplication, buildRouteMap } from "@stricli/core"
import { configShowCommand } from "./configShowCommand.js"
import { historyShowCommand } from "./historyShowCommand.js"
import { projectCreateCommand } from "./projectCreateCommand.js"
import { projectDeleteCommand } from "./projectDeleteCommand.js"
import { projectEditCommand } from "./projectEditCommand.js"
import { projectGetCommand } from "./projectGetCommand.js"
import { projectListCommand } from "./projectListCommand.js"
import { regenerateCommand } from "./regenerateCommand.js"

const routes = buildRouteMap({
  routes: {
    list: projectListCommand,
    get: projectGetCommand,
    create: projectCreateCommand,
    edit: projectEditCommand,
    delete: projectDeleteCommand,
    config: configShowCommand,
    history: historyShowCommand,
    regenerate: regenerateCommand,
  },
  docs: {
    brief: "Manage Caddy reverse-proxy/static projects",
  },
})

export const caddyProjectsApplication = buildApplication(routes, {
  name: "caddy-projects",
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
  versionInfo: {
    currentVersion: "0.1.0",
  },
})
