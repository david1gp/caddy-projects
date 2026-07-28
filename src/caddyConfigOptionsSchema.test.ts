import { expect, test } from "bun:test"
import * as a from "valibot"
import { oidcOptionsSchema } from "./caddyConfigOptionsSchema.js"

const base = {
  providerName: "zitadel",
  issuer: "https://auth.example.com",
  clientId: "id",
  clientSecret: "secret",
}

test("oidcOptionsSchema: accepts a 32 byte cookie secret", () => {
  const r = a.safeParse(oidcOptionsSchema, { ...base, cookieSecret: "0".repeat(32) })
  expect(r.success).toBe(true)
})

test("oidcOptionsSchema: accepts a 64 byte cookie secret", () => {
  const r = a.safeParse(oidcOptionsSchema, { ...base, cookieSecret: "0".repeat(64) })
  expect(r.success).toBe(true)
})

// caddy-oidc rejects any other length at provision time; catch it before generating config.
test("oidcOptionsSchema: rejects other cookie secret lengths", () => {
  for (const len of [1, 16, 31, 33, 63, 65]) {
    const r = a.safeParse(oidcOptionsSchema, { ...base, cookieSecret: "0".repeat(len) })
    expect(r.success).toBe(false)
  }
})
