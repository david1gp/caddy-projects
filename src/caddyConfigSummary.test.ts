import { describe, expect, test } from "bun:test"
import { projectOpencode, projectStartup } from "../test/referenceProjects.js"
import { caddyConfigSummary } from "./caddyConfigSummary.js"
import type { Project } from "./projectSchema.js"

describe("caddyConfigSummary", () => {
  test("skips disabled/template and sorts by first domain", () => {
    const disabled: Project = {
      ...projectStartup,
      name: "z-disabled",
      domains: ["aaa.example"],
      disabled: true,
    }
    const template: Project = {
      ...projectStartup,
      name: "z-template",
      domains: ["bbb.example"],
      template: true,
    }
    const entries = caddyConfigSummary([projectOpencode, projectStartup, disabled, template])
    expect(entries.map((e) => e.name)).toEqual(["opencode", "startup"])
    expect(entries[0]!.domains).toEqual(projectOpencode.domains)
    expect(entries[0]!.port).toBe(4096)
    expect(entries[1]!.port).toBe(3121)
  })

  test("empty when no active projects", () => {
    expect(caddyConfigSummary([])).toEqual([])
  })
})
