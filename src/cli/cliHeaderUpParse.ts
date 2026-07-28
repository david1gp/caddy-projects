import { createResult, createResultError, type Result } from "#result"

export function cliHeaderUpParse(entries: string[]): Result<Record<string, string>> {
  const op = "cliHeaderUpParse"
  const headerUp: Record<string, string> = {}
  for (const h of entries) {
    const eq = h.indexOf("=")
    if (eq === -1) {
      return createResultError(op, `--header-up requires K=V format, got: ${h}`)
    }
    headerUp[h.slice(0, eq)] = h.slice(eq + 1)
  }
  return createResult(headerUp)
}
