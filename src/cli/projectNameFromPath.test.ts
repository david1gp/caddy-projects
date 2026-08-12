import { describe, expect, test } from "bun:test"
import { projectNameFromPath } from "./projectNameFromPath.js"

const projects = [
  { name: "assets-optimizer", path: "/home/david/adaptive/assets-optimizer" },
  { name: "zitadel-login", path: "/home/david/adaptive/zitadel-login" },
  { name: "empty-path", path: "" },
  { name: "nested-child", path: "/home/david/adaptive/zitadel-login/docs" },
]

describe("projectNameFromPath", () => {
  test("exact path match", () => {
    const r = projectNameFromPath(projects, "/home/david/adaptive/assets-optimizer")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe("assets-optimizer")
  })

  test("cwd under project path", () => {
    const r = projectNameFromPath(projects, "/home/david/adaptive/assets-optimizer/src/cli")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe("assets-optimizer")
  })

  test("prefers longest matching path", () => {
    const r = projectNameFromPath(projects, "/home/david/adaptive/zitadel-login/docs/guide")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe("nested-child")
  })

  test("skips empty paths", () => {
    const r = projectNameFromPath([{ name: "empty-path", path: "" }], "/tmp")
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toContain("no project matches cwd")
  })

  test("no match", () => {
    const r = projectNameFromPath(projects, "/tmp/other")
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.op).toBe("projectNameFromPath")
  })

  test("does not match path prefix without separator", () => {
    const r = projectNameFromPath([{ name: "app", path: "/home/david/adaptive/app" }], "/home/david/adaptive/app-extra")
    expect(r.success).toBe(false)
  })
})
