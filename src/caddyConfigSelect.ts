import { createResult, createResultError, type Result } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import type { Project } from "./projectSchema.js"

function routeHosts(route: unknown): string[] {
  if (!route || typeof route !== "object") return []
  const match = (route as { match?: Array<{ host?: string[] }> }).match
  if (!Array.isArray(match) || !match[0]?.host) return []
  return match[0].host
}

function routesOf(config: CaddyConfig): unknown[] {
  return config.apps.http.servers.srv0.routes
}

export function caddyConfigSelect(config: CaddyConfig, projects: Project[], selector: string): Result<unknown[]> {
  const op = "caddyConfigSelect"
  const active = projects.filter((p) => !p.disabled && !p.template)
  const sel = selector
  const selLower = sel.toLowerCase()
  const routes = routesOf(config)

  let domains: string[] | null = null

  const byName = active.find((p) => p.name.toLowerCase() === selLower)
  if (byName) {
    domains = [...byName.domains]
  }

  if (!domains && /^\d+$/.test(sel)) {
    const port = Number(sel)
    const byPort = active.find((p) => p.port === port)
    if (byPort) {
      domains = [...byPort.domains]
    }
  }

  if (!domains) {
    const byDomain = active.find((p) => p.domains.some((d) => d.toLowerCase() === selLower))
    if (byDomain) {
      const hit = byDomain.domains.find((d) => d.toLowerCase() === selLower)
      if (hit) domains = [hit]
    }
  }

  if (!domains) {
    const matched = routes.filter((r) => routeHosts(r).some((h) => h.toLowerCase() === selLower))
    if (matched.length === 0) {
      return createResultError(op, `no server block matching: ${selector}`)
    }
    return createResult(matched)
  }

  const domainSet = new Set(domains.map((d) => d.toLowerCase()))
  const matched = routes.filter((r) => routeHosts(r).some((h) => domainSet.has(h.toLowerCase())))
  if (matched.length === 0) {
    return createResultError(op, `no server block matching: ${selector}`)
  }
  return createResult(matched)
}
