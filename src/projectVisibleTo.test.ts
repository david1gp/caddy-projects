import { describe, expect, test } from "bun:test"
import { projectMutableBy } from "./projectMutableBy.js"
import type { Project } from "./projectSchema.js"
import { projectVisibleTo } from "./projectVisibleTo.js"

const base: Project = {
  port: 3000,
  domains: ["a.example"],
  name: "a",
  path: "",
  user: "alice",
  access: "external",
  kind: "proxy",
  docs: false,
  browse: false,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

describe("projectVisibleTo", () => {
  test("owner sees own", () => {
    expect(projectVisibleTo(base, "alice")).toBe(true)
  })

  test("other user does not see private", () => {
    expect(projectVisibleTo(base, "bob")).toBe(false)
  })

  test("shared visible to all", () => {
    expect(projectVisibleTo({ ...base, shared: true }, "bob")).toBe(true)
  })

  test("template visible to all", () => {
    expect(projectVisibleTo({ ...base, template: true }, "bob")).toBe(true)
  })
})

describe("projectMutableBy", () => {
  test("only owner", () => {
    expect(projectMutableBy(base, "alice")).toBe(true)
    expect(projectMutableBy(base, "bob")).toBe(false)
  })
})
