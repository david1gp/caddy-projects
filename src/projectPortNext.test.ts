import { describe, expect, test } from "bun:test"
import { projectPortNext } from "./projectPortNext.js"
import type { Project } from "./projectSchema.js"

function project(partial: Partial<Project> & Pick<Project, "port" | "name" | "user">): Project {
  return {
    domains: ["x.example"],
    path: "",
    access: "external",
    kind: "proxy",
    docs: false,
    browse: false,
    headerUp: {},
    shared: false,
    template: false,
    disabled: false,
    ...partial,
  }
}

describe("projectPortNext", () => {
  test("picks lowest free in default range", () => {
    const r = projectPortNext([])
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe(3000)
  })

  test("skips taken and respects gaps", () => {
    const projects = [
      project({ port: 3000, name: "a", user: "alice" }),
      project({ port: 3001, name: "b", user: "alice" }),
      project({ port: 3003, name: "c", user: "alice" }),
    ]
    const r = projectPortNext(projects)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe(3002)
  })

  test("skips disabled and template", () => {
    const projects = [
      project({ port: 3000, name: "d", user: "alice", disabled: true }),
      project({ port: 3001, name: "t", user: "alice", template: true }),
    ]
    const r = projectPortNext(projects)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe(3000)
  })

  test("errors when range exhausted", () => {
    const projects = [project({ port: 10, name: "a", user: "alice" }), project({ port: 11, name: "b", user: "alice" })]
    const r = projectPortNext(projects, { from: 10, to: 11 })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toBe("no free port in range 10-11")
  })

  test("respects custom range", () => {
    const r = projectPortNext([], { from: 5000, to: 5005 })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).toBe(5000)
  })
})
