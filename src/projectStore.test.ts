import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { Project } from "./projectSchema.js"
import { projectStoreGet } from "./projectStoreGet.js"
import { projectStoreHistory } from "./projectStoreHistory.js"
import { projectStoreListAll } from "./projectStoreListAll.js"
import { projectStoreOpen } from "./projectStoreOpen.js"
import { projectStorePut } from "./projectStorePut.js"
import { projectStoreRemove } from "./projectStoreRemove.js"

const tmpRoot = Bun.env.TMPDIR ?? "/tmp"
const dirs: string[] = []

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

const sample: Project = {
  port: 3000,
  domains: ["a.example"],
  name: "alpha",
  path: "",
  user: "david",
  access: "external",
  kind: "proxy",
  docs: false,
  browse: false,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

describe("projectStore", () => {
  test("CRUD roundtrip and history commits", async () => {
    const dir = tempDir("caddy-projects-store-")
    const openR = await projectStoreOpen({
      dir,
      authorName: "Test",
      authorEmail: "test@example.com",
      autoPush: false,
    })
    expect(openR.success).toBe(true)
    if (!openR.success) return
    const store = openR.data

    const putR = await projectStorePut(store, sample, "create alpha")
    expect(putR.success).toBe(true)

    const getR = await projectStoreGet(store, "david", "alpha")
    expect(getR.success).toBe(true)
    if (!getR.success) return
    expect(getR.data.name).toBe("alpha")

    const listR = await projectStoreListAll(store)
    expect(listR.success).toBe(true)
    if (!listR.success) return
    expect(listR.data.length).toBe(1)

    const updated = { ...sample, port: 3001 }
    const editR = await projectStorePut(store, updated, "edit alpha")
    expect(editR.success).toBe(true)

    const histR = await projectStoreHistory(store, "david", "alpha")
    expect(histR.success).toBe(true)
    if (!histR.success) return
    expect(histR.data.length).toBeGreaterThanOrEqual(2)
    expect(histR.data.some((c) => c.message.includes("create"))).toBe(true)

    const delR = await projectStoreRemove(store, "david", "alpha", "delete alpha")
    expect(delR.success).toBe(true)

    const list2 = await projectStoreListAll(store)
    expect(list2.success).toBe(true)
    if (!list2.success) return
    expect(list2.data.length).toBe(0)
  })
})
