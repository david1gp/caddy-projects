import { readFileSync } from "node:fs"
import { createResult, createResultError, type Result } from "#result"

export function systemUserUid(username: string): Result<number> {
  const op = "systemUserUid"
  let content: string
  try {
    content = readFileSync("/etc/passwd", "utf8")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, msg)
  }
  for (const line of content.split("\n")) {
    if (!line || line.startsWith("#")) continue
    const parts = line.split(":")
    if (parts[0] === username) {
      const uid = Number(parts[2])
      if (!Number.isFinite(uid)) {
        return createResultError(op, `invalid uid for ${username}`, line)
      }
      return createResult(uid)
    }
  }
  return createResultError(op, `user not found: ${username}`)
}
