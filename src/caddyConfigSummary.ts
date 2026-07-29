import type { CaddyConfigSummaryEntry } from "./CaddyConfigSummaryEntry.js"
import type { Project } from "./projectSchema.js"

export function caddyConfigSummary(projects: Project[]): CaddyConfigSummaryEntry[] {
  const active = projects.filter((p) => !p.disabled && !p.template)
  const sorted = [...active].sort((a, b) => {
    const da = a.domains[0] ?? a.name
    const db = b.domains[0] ?? b.name
    return da.localeCompare(db)
  })
  return sorted.map((p) => ({
    name: p.name,
    user: p.user,
    port: p.port,
    kind: p.kind,
    access: p.access,
    domains: [...p.domains],
  }))
}
