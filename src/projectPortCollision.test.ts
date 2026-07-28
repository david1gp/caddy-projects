import { describe, expect, test } from "bun:test"
import { projectPortCollision } from "./projectPortCollision.js"
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

describe("projectPortCollision", () => {
  test("returns null when free", () => {
    const projects = [project({ port: 3000, name: "a", user: "alice" })]
    expect(projectPortCollision(projects, 3001)).toBeNull()
  })

  test("returns colliding project", () => {
    const taken = project({ port: 3000, name: "a", user: "alice" })
    expect(projectPortCollision([taken], 3000)).toBe(taken)
  })

  test("skips disabled and template", () => {
    const projects = [
      project({ port: 3000, name: "d", user: "alice", disabled: true }),
      project({ port: 3001, name: "t", user: "alice", template: true }),
    ]
    expect(projectPortCollision(projects, 3000)).toBeNull()
    expect(projectPortCollision(projects, 3001)).toBeNull()
  })

  test("excludes named project on edit", () => {
    const p = project({ port: 3000, name: "a", user: "alice" })
    expect(projectPortCollision([p], 3000, "a", "alice")).toBeNull()
    expect(projectPortCollision([p], 3000, "a", "bob")).toBe(p)
  })

  test("detects across users", () => {
    const bob = project({ port: 3000, name: "a", user: "bob" })
    expect(projectPortCollision([bob], 3000)).toBe(bob)
  })
})
