import { afterEach, describe, expect, test } from "bun:test"
import * as os from "node:os"
import { join } from "node:path"
import { cliSocketPath } from "./cliSocketPath.js"

const ENV_KEY = "CADDY_PROJECTS_SOCKET"

describe("cliSocketPath", () => {
  const prev = Bun.env[ENV_KEY]

  afterEach(() => {
    if (prev === undefined) delete Bun.env[ENV_KEY]
    else Bun.env[ENV_KEY] = prev
  })

  test("--socket flag wins over env and default", () => {
    Bun.env[ENV_KEY] = "/env/custom.sock"
    expect(cliSocketPath("/flag/custom.sock")).toBe("/flag/custom.sock")
  })

  test("CADDY_PROJECTS_SOCKET wins over default", () => {
    Bun.env[ENV_KEY] = "/env/custom.sock"
    expect(cliSocketPath()).toBe("/env/custom.sock")
    expect(cliSocketPath(undefined)).toBe("/env/custom.sock")
  })

  test("default is /run/caddy-projects/$USER.sock", () => {
    delete Bun.env[ENV_KEY]
    const user = os.userInfo().username
    expect(cliSocketPath()).toBe(join("/run/caddy-projects", `${user}.sock`))
  })
})
