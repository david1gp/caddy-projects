import { describe, expect, test } from "bun:test"
import { cliHeaderUpParse } from "./cliHeaderUpParse.js"

describe("cliHeaderUpParse", () => {
  test("parses K=V pairs", () => {
    const r = cliHeaderUpParse(["Host=127.0.0.1:3000", "X-Foo=bar"])
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({ Host: "127.0.0.1:3000", "X-Foo": "bar" })
    }
  })

  test("rejects missing equals", () => {
    const r = cliHeaderUpParse(["FOO"])
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.errorMessage).toContain("K=V")
      expect(r.errorMessage).toContain("FOO")
    }
  })

  test("empty list", () => {
    const r = cliHeaderUpParse([])
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({})
  })
})
