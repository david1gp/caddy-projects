import { describe, expect, test } from "bun:test"
import { which } from "bun"
import { referenceProjects } from "../test/referenceProjects.js"
import { caddyConfigGenerate } from "./caddyConfigGenerate.js"
import { caddyConfigValidate } from "./caddyConfigValidate.js"

const caddyBin =
  which("caddy") ?? ((await Bun.file("/home/david/.local/bin/caddy").exists()) ? "/home/david/.local/bin/caddy" : null)

describe("caddyConfigValidate", () => {
  test("validates generated config without oidc", async () => {
    if (!caddyBin) {
      console.warn("skip: caddy not found")
      return
    }
    const gen = caddyConfigGenerate(referenceProjects, {})
    expect(gen.success).toBe(true)
    if (!gen.success) return
    const r = await caddyConfigValidate(gen.data, caddyBin)
    expect(r.success).toBe(true)
  })

  test("rejects broken config", async () => {
    if (!caddyBin) {
      console.warn("skip: caddy not found")
      return
    }
    const r = await caddyConfigValidate({ apps: { http: { servers: { srv0: { listen: 5 } } } } }, caddyBin)
    expect(r.success).toBe(false)
  })
})
