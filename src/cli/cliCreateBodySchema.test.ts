import { describe, expect, test } from "bun:test"
import * as a from "valibot"
import { cliCreateBodySchema } from "./cliCreateBodySchema.js"
import { cliEditBodySchema } from "./cliEditBodySchema.js"

describe("cliCreateBodySchema", () => {
  test("valid minimal body", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"] })
    expect(r.success).toBe(true)
  })

  test("bad port NaN", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"], port: Number.NaN })
    expect(r.success).toBe(false)
  })

  test("bad port out of range", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"], port: 0 })
    expect(r.success).toBe(false)
    const r2 = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"], port: 70000 })
    expect(r2.success).toBe(false)
  })

  test("bad kind", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"], kind: "foo" })
    expect(r.success).toBe(false)
  })

  test("bad access", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: ["web.test"], access: "public" })
    expect(r.success).toBe(false)
  })

  test("empty domain", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web", domains: [""] })
    expect(r.success).toBe(false)
  })

  test("missing domains", () => {
    const r = a.safeParse(cliCreateBodySchema, { name: "web" })
    expect(r.success).toBe(false)
  })
})

describe("cliEditBodySchema", () => {
  test("empty patch ok", () => {
    const r = a.safeParse(cliEditBodySchema, {})
    expect(r.success).toBe(true)
  })

  test("bad port", () => {
    const r = a.safeParse(cliEditBodySchema, { port: Number.NaN })
    expect(r.success).toBe(false)
  })

  test("bad kind", () => {
    const r = a.safeParse(cliEditBodySchema, { kind: "other" })
    expect(r.success).toBe(false)
  })

  test("bad access", () => {
    const r = a.safeParse(cliEditBodySchema, { access: "x" })
    expect(r.success).toBe(false)
  })
})
