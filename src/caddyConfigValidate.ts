import { unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createResult, createResultError, type PromiseResult } from "#result"

export async function caddyConfigValidate(config: unknown, caddyBin = "caddy"): PromiseResult<true> {
  const op = "caddyConfigValidate"
  const tmp = join(
    Bun.env.TMPDIR ?? "/tmp",
    `caddy-projects-validate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  )

  try {
    await writeFile(tmp, JSON.stringify(config), "utf8")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, `failed to write temp config: ${msg}`)
  }

  try {
    const proc = Bun.spawn([caddyBin, "validate", "--config", tmp, "--adapter", ""], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (exitCode === 0) {
      return createResult(true)
    }
    const errText = (stderr || stdout).trim() || `caddy validate exited ${exitCode}`
    return createResultError(op, errText)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, msg)
  } finally {
    try {
      await unlink(tmp)
    } catch {
      // ignore
    }
  }
}
