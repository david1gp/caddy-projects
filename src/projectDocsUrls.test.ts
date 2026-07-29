import { describe, expect, test } from "bun:test"
import { projectOpencode, projectStartup } from "../test/referenceProjects.js"
import { projectDocsUrls } from "./projectDocsUrls.js"

describe("projectDocsUrls", () => {
  test("builds https urls for each domain", () => {
    const multi = {
      ...projectStartup,
      domains: ["a.example", "b.example"],
    }
    const r = projectDocsUrls(multi, "guide/intro.md")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.urls).toEqual(["https://a.example/docs/guide/intro.md", "https://b.example/docs/guide/intro.md"])
  })

  test("strips /docs/ prefix", () => {
    const r = projectDocsUrls(projectStartup, "/docs/architecture.md")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.urls).toEqual(["https://preview.startup.contentoren.de/docs/architecture.md"])
  })

  test("strips docs/ prefix without leading slash", () => {
    const r = projectDocsUrls(projectStartup, "docs/x.md")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.urls[0]).toBe("https://preview.startup.contentoren.de/docs/x.md")
  })

  test("http scheme", () => {
    const r = projectDocsUrls(projectStartup, "x.md", { scheme: "http" })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.urls[0]?.startsWith("http://")).toBe(true)
  })

  test("docs disabled", () => {
    const r = projectDocsUrls(projectOpencode, "x.md")
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toContain("docs disabled")
  })

  test("rejects empty path", () => {
    const r = projectDocsUrls(projectStartup, "  ")
    expect(r.success).toBe(false)
  })

  test("rejects traversal", () => {
    const r = projectDocsUrls(projectStartup, "../secret.md")
    expect(r.success).toBe(false)
  })

  test("rejects non-md", () => {
    const r = projectDocsUrls(projectStartup, "readme.txt")
    expect(r.success).toBe(false)
  })

  test("rejects path without .md", () => {
    const r = projectDocsUrls(projectStartup, "guide/")
    expect(r.success).toBe(false)
  })
})
