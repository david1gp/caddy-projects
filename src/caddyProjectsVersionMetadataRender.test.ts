import { expect, test } from "bun:test"
import { caddyProjectsVersionMetadataRender } from "./caddyProjectsVersionMetadataRender.js"

test("renders package and environment metadata", () => {
  const rendered = caddyProjectsVersionMetadataRender()

  expect(rendered).toStartWith("0.4.2\n")
  expect(rendered).toContain("user agent: @adaptive-ds/caddy-projects/0.4.2")
  expect(rendered).toMatch(/executable: .+\nexecutable target: .+\n/)
  expect(rendered).toContain("version: 0.4.2")
  expect(rendered).toContain(
    "description: API + CLI to manage Caddy projects: JSON project definitions, generated Caddy config, git-tracked history.",
  )
  expect(rendered).toContain("author: unavailable")
  expect(rendered).toContain("license: MIT")
  expect(rendered).toContain("project: https://github.com/david1gp/caddy-projects")
  expect(rendered).toContain("installation type: development checkout")
  expect(rendered).toContain("runtime: bun ")
  expect(rendered).toContain("runtime requirements: unavailable")
  expect(rendered).toContain(`platform: ${process.platform} ${process.arch} (OS release `)
})
