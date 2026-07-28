import { describe, expect, test } from "bun:test"
import { cliFlagBoolean } from "./cliFlagBoolean.js"

describe("cliFlagBoolean", () => {
  test("neither passed => undefined", () => {
    const r = cliFlagBoolean(undefined, undefined)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBeUndefined()
  })

  test("on only => true", () => {
    const r = cliFlagBoolean(true, undefined)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe(true)
  })

  test("off only => false", () => {
    const r = cliFlagBoolean(undefined, true)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe(false)
  })

  test("both passed => error", () => {
    const r = cliFlagBoolean(true, true)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.errorMessage).toContain("both")
    }
  })

  test("false values treated as not passed", () => {
    const r = cliFlagBoolean(false, false)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBeUndefined()
  })
})
