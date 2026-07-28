import { createResult, createResultError, type Result } from "#result"
import type { Project } from "./projectSchema.js"

export function projectPortNext(projects: Project[], range?: { from: number; to: number }): Result<number> {
  const op = "projectPortNext"
  const from = range?.from ?? 3000
  const to = range?.to ?? 3999
  const used = new Set<number>()
  for (const p of projects) {
    if (p.disabled || p.template) continue
    used.add(p.port)
  }
  for (let port = from; port <= to; port++) {
    if (!used.has(port)) return createResult(port)
  }
  return createResultError(op, `no free port in range ${from}-${to}`)
}
