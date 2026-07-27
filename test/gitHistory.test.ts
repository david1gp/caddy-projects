import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { which } from "bun"
import { type ApiContext, apiHandle } from "../src/apiHandle.js"
import { projectStoreHistory } from "../src/projectStoreHistory.js"
import { projectStoreOpen } from "../src/projectStoreOpen.js"

const historyRepo = "/home/david/c/adaptive/caddy-projects-history-test"
const tmpRoot = Bun.env.TMPDIR ?? "/tmp"
const caddyBin =
  which("caddy") ??
  ((await Bun.file("/home/david/.local/bin/caddy").exists()) ? "/home/david/.local/bin/caddy" : "caddy")

const extraDirs: string[] = []

function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpRoot, prefix))
  extraDirs.push(d)
  return d
}

async function git(cwd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  const p = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ])
  return { ok: code === 0, out: (stdout + stderr).trim() }
}

function resetHistoryRepo() {
  mkdirSync(historyRepo, { recursive: true })
  if (existsSync(join(historyRepo, ".git"))) {
    for (const name of readdirSync(historyRepo)) {
      if (name === ".git") continue
      rmSync(join(historyRepo, name), { recursive: true, force: true })
    }
  } else {
    // will be inited by projectStoreOpen
  }
}

afterEach(() => {
  while (extraDirs.length) {
    const d = extraDirs.pop()
    if (d) rmSync(d, { recursive: true, force: true })
  }
})

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://local${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("gitHistory end-to-end", () => {
  test("one commit per create/edit/delete and auto-push to bare origin", async () => {
    resetHistoryRepo()
    // wipe git and re-init clean
    rmSync(join(historyRepo, ".git"), { recursive: true, force: true })

    const bare = tempDir("caddy-projects-bare-")
    await git(bare, ["init", "--bare", "-b", "main"])

    const openR = await projectStoreOpen({
      dir: historyRepo,
      authorName: "Test",
      authorEmail: "test@example.com",
      autoPush: true,
      branch: "main",
    })
    expect(openR.success).toBe(true)
    if (!openR.success) return

    // add bare as origin
    const remote = await git(historyRepo, ["remote", "add", "origin", bare])
    expect(remote.ok).toBe(true)

    const ctx: ApiContext = {
      user: "alice",
      store: openR.data,
      options: {
        caddy: {},
        skipValidate: false,
        skipReload: true,
        caddyBin,
      },
    }

    const createRes = await apiHandle(
      req("POST", "/projects", {
        name: "app",
        port: 5000,
        domains: ["app.history.test"],
        docs: false,
      }),
      ctx,
    )
    expect(createRes.status).toBe(201)

    const editRes = await apiHandle(req("PATCH", "/projects/app", { port: 5001 }), ctx)
    expect(editRes.status).toBe(200)

    const delRes = await apiHandle(req("DELETE", "/projects/app"), ctx)
    expect(delRes.status).toBe(200)

    const hist = await projectStoreHistory(ctx.store, undefined, undefined, 20)
    expect(hist.success).toBe(true)
    if (!hist.success) return
    expect(hist.data.length).toBeGreaterThanOrEqual(3)
    const messages = hist.data.map((c) => c.message)
    expect(messages.some((m) => m.includes("create"))).toBe(true)
    expect(messages.some((m) => m.includes("edit"))).toBe(true)
    expect(messages.some((m) => m.includes("delete"))).toBe(true)

    // bare remote should have commits
    const bareLog = await git(bare, ["log", "--oneline"])
    expect(bareLog.ok).toBe(true)
    expect(bareLog.out.split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(3)
  })
})
