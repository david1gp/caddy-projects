import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { which } from "bun"
import { type ApiContext, apiHandle } from "../src/apiHandle.js"
import { projectStoreHistory } from "../src/projectStoreHistory.js"
import { projectStoreListAll } from "../src/projectStoreListAll.js"
import { projectStoreOpen } from "../src/projectStoreOpen.js"

const tmpRoot = Bun.env.TMPDIR ?? "/tmp"
const dirs: string[] = []
const caddyBin =
  which("caddy") ??
  ((await Bun.file("/home/david/.local/bin/caddy").exists()) ? "/home/david/.local/bin/caddy" : "caddy")

function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpRoot, prefix))
  dirs.push(d)
  return d
}

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop()
    if (d) rmSync(d, { recursive: true, force: true })
  }
})

async function ctxFor(user: string): Promise<ApiContext> {
  const dir = tempDir("caddy-projects-api-")
  const openR = await projectStoreOpen({
    dir,
    authorName: "Test",
    authorEmail: "test@example.com",
    autoPush: false,
  })
  if (!openR.success) throw new Error(openR.errorMessage)
  return {
    user,
    store: openR.data,
    options: {
      caddy: {},
      skipValidate: false,
      skipReload: true,
      caddyBin,
    },
  }
}

async function sharedStoreCtx(users: [string, string]): Promise<[ApiContext, ApiContext]> {
  const dir = tempDir("caddy-projects-api-shared-")
  const openR = await projectStoreOpen({
    dir,
    authorName: "Test",
    authorEmail: "test@example.com",
    autoPush: false,
  })
  if (!openR.success) throw new Error(openR.errorMessage)
  const base = {
    store: openR.data,
    options: {
      caddy: {},
      skipValidate: false,
      skipReload: true,
      caddyBin,
    },
  }
  return [
    { ...base, user: users[0] },
    { ...base, user: users[1] },
  ]
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://local${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function json(res: Response): Promise<any> {
  return res.json()
}

describe("apiHandle", () => {
  test("health", async () => {
    const ctx = await ctxFor("alice")
    const res = await apiHandle(req("GET", "/health"), ctx)
    expect(res.status).toBe(200)
    const j = await json(res)
    expect(j.data.ok).toBe(true)
    expect(j.data.user).toBe("alice")
  })

  test("create, list, get, patch, delete", async () => {
    const ctx = await ctxFor("alice")
    const createBody = {
      name: "app",
      port: 4000,
      domains: ["app.example"],
      path: "",
      docs: false,
      kind: "proxy",
      access: "external",
    }
    const createRes = await apiHandle(req("POST", "/projects", createBody), ctx)
    expect(createRes.status).toBe(201)
    const created = await json(createRes)
    expect(created.success).toBe(true)
    expect(created.data.user).toBe("alice")

    const listRes = await apiHandle(req("GET", "/projects"), ctx)
    const list = await json(listRes)
    expect(list.data.length).toBe(1)

    const getRes = await apiHandle(req("GET", "/projects/app"), ctx)
    expect(getRes.status).toBe(200)

    const patchRes = await apiHandle(req("PATCH", "/projects/app", { port: 4001 }), ctx)
    expect(patchRes.status).toBe(200)
    const patched = await json(patchRes)
    expect(patched.data.port).toBe(4001)

    const delRes = await apiHandle(req("DELETE", "/projects/app"), ctx)
    expect(delRes.status).toBe(200)

    const list2 = await json(await apiHandle(req("GET", "/projects"), ctx))
    expect(list2.data.length).toBe(0)
  })

  test("duplicate name 409", async () => {
    const ctx = await ctxFor("alice")
    const body = {
      name: "app",
      port: 4000,
      domains: ["app.example"],
      docs: false,
    }
    expect((await apiHandle(req("POST", "/projects", body), ctx)).status).toBe(201)
    const dup = await apiHandle(req("POST", "/projects", { ...body, domains: ["other.example"] }), ctx)
    expect(dup.status).toBe(409)
  })

  test("domain conflict 409", async () => {
    const ctx = await ctxFor("alice")
    const body = {
      name: "app",
      port: 4000,
      domains: ["app.example"],
      docs: false,
    }
    expect((await apiHandle(req("POST", "/projects", body), ctx)).status).toBe(201)
    const dup = await apiHandle(
      req("POST", "/projects", { name: "app2", port: 4001, domains: ["app.example"], docs: false }),
      ctx,
    )
    expect(dup.status).toBe(409)
  })

  test("list scoping across two users", async () => {
    const [alice, bob] = await sharedStoreCtx(["alice", "bob"])
    await apiHandle(req("POST", "/projects", { name: "a1", port: 4000, domains: ["a1.example"], docs: false }), alice)
    await apiHandle(req("POST", "/projects", { name: "b1", port: 4001, domains: ["b1.example"], docs: false }), bob)
    await apiHandle(
      req("POST", "/projects", {
        name: "shared",
        port: 4002,
        domains: ["shared.example"],
        docs: false,
        shared: true,
      }),
      alice,
    )

    const aliceList = await json(await apiHandle(req("GET", "/projects"), alice))
    const namesA = aliceList.data.map((p: { name: string }) => p.name).sort()
    expect(namesA).toEqual(["a1", "shared"])

    const bobList = await json(await apiHandle(req("GET", "/projects"), bob))
    const namesB = bobList.data.map((p: { name: string }) => p.name).sort()
    expect(namesB).toEqual(["b1", "shared"])

    const bobGetA = await apiHandle(req("GET", "/projects/a1"), bob)
    expect(bobGetA.status).toBe(404)
  })

  test("config endpoint", async () => {
    const ctx = await ctxFor("alice")
    await apiHandle(req("POST", "/projects", { name: "app", port: 4000, domains: ["app.example"], docs: false }), ctx)
    const res = await apiHandle(req("GET", "/config"), ctx)
    expect(res.status).toBe(200)
    const j = await json(res)
    expect(j.success).toBe(true)
    expect(j.data.apps.http.servers.srv0.routes.length).toBe(1)
  })

  test("history endpoint", async () => {
    const ctx = await ctxFor("alice")
    await apiHandle(req("POST", "/projects", { name: "app", port: 4000, domains: ["app.example"], docs: false }), ctx)
    const res = await apiHandle(req("GET", "/history?name=app"), ctx)
    expect(res.status).toBe(200)
    const j = await json(res)
    expect(j.data.length).toBeGreaterThanOrEqual(1)
  })

  test("port conflict 409 on create and edit", async () => {
    const [alice, bob] = await sharedStoreCtx(["alice", "bob"])
    const createAlice = await apiHandle(
      req("POST", "/projects", { name: "a1", port: 3000, domains: ["a1.example"], docs: false }),
      alice,
    )
    expect(createAlice.status).toBe(201)

    const createBob = await apiHandle(
      req("POST", "/projects", { name: "b1", port: 3000, domains: ["b1.example"], docs: false }),
      bob,
    )
    expect(createBob.status).toBe(409)
    const bobJ = await json(createBob)
    expect(bobJ.errorMessage).toContain("port conflict: 3000 used by alice/a1")

    await apiHandle(req("POST", "/projects", { name: "b2", port: 3001, domains: ["b2.example"], docs: false }), bob)
    const editBob = await apiHandle(req("PATCH", "/projects/b2", { port: 3000 }), bob)
    expect(editBob.status).toBe(409)
    const editJ = await json(editBob)
    expect(editJ.errorMessage).toContain("port conflict: 3000 used by alice/a1")
  })

  test("auto-assigned port returned on create", async () => {
    const ctx = await ctxFor("alice")
    const res = await apiHandle(req("POST", "/projects", { name: "auto", domains: ["auto.example"], docs: false }), ctx)
    expect(res.status).toBe(201)
    const j = await json(res)
    expect(j.success).toBe(true)
    expect(j.data.port).toBe(3000)

    const res2 = await apiHandle(
      req("POST", "/projects", { name: "auto2", domains: ["auto2.example"], docs: false }),
      ctx,
    )
    expect(res2.status).toBe(201)
    const j2 = await json(res2)
    expect(j2.data.port).toBe(3001)
  })

  test("delete by port success and 404 for other user", async () => {
    const [alice, bob] = await sharedStoreCtx(["alice", "bob"])
    await apiHandle(req("POST", "/projects", { name: "a1", port: 3000, domains: ["a1.example"], docs: false }), alice)
    await apiHandle(req("POST", "/projects", { name: "b1", port: 3001, domains: ["b1.example"], docs: false }), bob)

    const bobTriesAlice = await apiHandle(req("DELETE", "/projects/by-port/3000"), bob)
    expect(bobTriesAlice.status).toBe(404)
    const notFound = await json(bobTriesAlice)
    expect(notFound.errorMessage).toBe("no project with port 3000")

    const del = await apiHandle(req("DELETE", "/projects/by-port/3000"), alice)
    expect(del.status).toBe(200)
    const delJ = await json(del)
    expect(delJ.data.deleted).toBe("a1")

    const list = await json(await apiHandle(req("GET", "/projects"), alice))
    expect(list.data.length).toBe(0)
  })

  test("POST /regenerate works; POST /apply 404s", async () => {
    const ctx = await ctxFor("alice")
    await apiHandle(req("POST", "/projects", { name: "app", port: 4000, domains: ["app.example"], docs: false }), ctx)
    const regen = await apiHandle(req("POST", "/regenerate"), ctx)
    expect(regen.status).toBe(200)
    const regenJ = await json(regen)
    expect(regenJ.success).toBe(true)
    expect(regenJ.data.apps.http).toBeDefined()

    const apply = await apiHandle(req("POST", "/apply"), ctx)
    expect(apply.status).toBe(404)
  })

  test("failed regenerate reverts git write", async () => {
    const dir = tempDir("caddy-projects-api-revert-")
    const openR = await projectStoreOpen({
      dir,
      authorName: "Test",
      authorEmail: "test@example.com",
      autoPush: false,
    })
    if (!openR.success) throw new Error(openR.errorMessage)
    // create a project that will fail generate: docs true with empty path
    // but schema allows it — generate rejects. Use skipValidate false so caddy validate runs;
    // actually generate fails first for docs without path.
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
    const res = await apiHandle(
      req("POST", "/projects", {
        name: "bad",
        port: 4000,
        domains: ["bad.example"],
        path: "",
        docs: true,
        kind: "proxy",
      }),
      ctx,
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
    const listR = await projectStoreListAll(ctx.store)
    expect(listR.success).toBe(true)
    if (!listR.success) return
    expect(listR.data.length).toBe(0)
    // history should have create + revert delete (or empty if nothing left)
    const hist = await projectStoreHistory(ctx.store)
    expect(hist.success).toBe(true)
  })
})
