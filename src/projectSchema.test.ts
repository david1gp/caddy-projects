import { describe, expect, test } from "bun:test"
import * as a from "valibot"
import { projectInputSchema, projectSchema } from "./projectSchema.js"

describe("projectSchema", () => {
  test("applies defaults", () => {
    const r = a.safeParse(projectSchema, {
      port: 3000,
      domains: ["a.example"],
      name: "foo",
      user: "david",
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.output.path).toBe("")
    expect(r.output.access).toBe("external")
    expect(r.output.kind).toBe("proxy")
    expect(r.output.docs).toBe(true)
    expect(r.output.browse).toBe(false)
    expect(r.output.headerUp).toEqual({})
    expect(r.output.shared).toBe(false)
    expect(r.output.template).toBe(false)
    expect(r.output.disabled).toBe(false)
    expect(r.output.spa).toBe(false)
  })

  test("accepts spa true", () => {
    const r = a.safeParse(projectSchema, {
      port: 3000,
      domains: ["a.example"],
      name: "foo",
      user: "david",
      kind: "static",
      path: "/srv/app",
      spa: true,
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.output.spa).toBe(true)
  })

  test("rejects bad port", () => {
    const r = a.safeParse(projectSchema, {
      port: 0,
      domains: ["a.example"],
      name: "foo",
      user: "david",
    })
    expect(r.success).toBe(false)
  })

  test("rejects bad name", () => {
    const r = a.safeParse(projectSchema, {
      port: 3000,
      domains: ["a.example"],
      name: "Bad_Name",
      user: "david",
    })
    expect(r.success).toBe(false)
  })

  test("rejects empty domains", () => {
    const r = a.safeParse(projectSchema, {
      port: 3000,
      domains: [],
      name: "foo",
      user: "david",
    })
    expect(r.success).toBe(false)
  })

  test("projectInputSchema omits user", () => {
    const r = a.safeParse(projectInputSchema, {
      port: 3000,
      domains: ["a.example"],
      name: "foo",
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect("user" in r.output).toBe(false)
  })

  test("projectInputSchema allows omitted port", () => {
    const r = a.safeParse(projectInputSchema, {
      domains: ["a.example"],
      name: "foo",
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.output.port).toBeUndefined()
  })
})
