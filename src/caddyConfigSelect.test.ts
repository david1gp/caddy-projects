import { describe, expect, test } from "bun:test"
import { projectOpencode, projectStartup } from "../test/referenceProjects.js"
import { caddyConfigGenerate } from "./caddyConfigGenerate.js"
import { caddyConfigSelect } from "./caddyConfigSelect.js"
import type { Project } from "./projectSchema.js"

function hostOf(route: unknown): string[] {
  const match = (route as { match: Array<{ host: string[] }> }).match
  return match[0]!.host
}

const disabled: Project = {
  ...projectStartup,
  name: "gone",
  domains: ["gone.example"],
  port: 3990,
  disabled: true,
}

const template: Project = {
  ...projectStartup,
  name: "tmpl",
  domains: ["tmpl.example"],
  port: 3991,
  template: true,
}

describe("caddyConfigSelect", () => {
  test("select by name", () => {
    const gen = caddyConfigGenerate([projectOpencode, projectStartup], {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = caddyConfigSelect(gen.data, [projectOpencode, projectStartup], "opencode")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.length).toBe(1)
    expect(hostOf(r.data[0]!)).toEqual(projectOpencode.domains)
  })

  test("select by port", () => {
    const gen = caddyConfigGenerate([projectOpencode, projectStartup], {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = caddyConfigSelect(gen.data, [projectOpencode, projectStartup], "3121")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.length).toBe(1)
    expect(hostOf(r.data[0]!)).toEqual(projectStartup.domains)
  })

  test("select by domain", () => {
    const gen = caddyConfigGenerate([projectOpencode, projectStartup], {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = caddyConfigSelect(gen.data, [projectOpencode, projectStartup], "oc.leonardomora.de")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.length).toBe(1)
    expect(hostOf(r.data[0]!)).toEqual(projectOpencode.domains)
  })

  test("project with multiple domains returns its single route", () => {
    const gen = caddyConfigGenerate([projectOpencode], {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = caddyConfigSelect(gen.data, [projectOpencode], "opencode")
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.length).toBe(1)
    expect(hostOf(r.data[0]!)).toEqual(projectOpencode.domains)
  })

  test("unknown selector errors", () => {
    const gen = caddyConfigGenerate([projectOpencode], {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = caddyConfigSelect(gen.data, [projectOpencode], "nope")
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.errorMessage).toContain("no server block matching: nope")
  })

  test("disabled and template projects are not selectable", () => {
    const all = [projectOpencode, disabled, template]
    const gen = caddyConfigGenerate(all, {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    expect(caddyConfigSelect(gen.data, all, "gone").success).toBe(false)
    expect(caddyConfigSelect(gen.data, all, "tmpl").success).toBe(false)
    expect(caddyConfigSelect(gen.data, all, "gone.example").success).toBe(false)
    expect(caddyConfigSelect(gen.data, all, "3990").success).toBe(false)
  })
})
