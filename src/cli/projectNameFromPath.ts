import { resolve } from "node:path"
import { createResult, createResultError, type Result } from "#result"

/**
 * Resolve project name by matching cwd against project filesystem paths.
 * Prefers the longest matching path (exact or ancestor of cwd).
 */
export function projectNameFromPath(projects: Array<{ name: string; path: string }>, cwd: string): Result<string> {
  const op = "projectNameFromPath"
  const resolvedCwd = resolve(cwd)

  let bestName: string | undefined
  let bestLen = -1

  for (const p of projects) {
    if (typeof p.path !== "string" || p.path === "") continue
    const projectPath = resolve(p.path)
    const match = resolvedCwd === projectPath || resolvedCwd.startsWith(`${projectPath}/`)
    if (!match) continue
    if (projectPath.length > bestLen) {
      bestLen = projectPath.length
      bestName = p.name
    }
  }

  if (bestName === undefined) {
    return createResultError(op, `no project matches cwd: ${resolvedCwd}`)
  }
  return createResult(bestName)
}
