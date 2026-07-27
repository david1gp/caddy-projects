#!/usr/bin/env bun
import { chmodSync, chownSync, existsSync, mkdirSync, unlinkSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { type ApiContext, apiHandle } from "./apiHandle.js"
import type { CaddyConfigOptions, OidcOptions } from "./caddyConfigOptionsSchema.js"
import { projectStoreOpen } from "./projectStoreOpen.js"
import type { ProjectsApplyOptions } from "./projectsApply.js"
import { systemUserUid } from "./systemUserUid.js"

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i === -1) return undefined
  return argv[i + 1]
}

function flagHas(argv: string[], name: string): boolean {
  return argv.includes(name)
}

function socketDirDefault(): string {
  if (process.getuid?.() === 0) return "/run/caddy-projects"
  const xdg = Bun.env.XDG_RUNTIME_DIR
  if (xdg) return join(xdg, "caddy-projects")
  return "/tmp/caddy-projects"
}

function oidcFromEnv(): OidcOptions | undefined {
  const issuer = Bun.env.CADDY_PROJECTS_OIDC_ISSUER
  if (!issuer) return undefined
  const clientId = Bun.env.CADDY_PROJECTS_OIDC_CLIENT_ID ?? ""
  const clientSecret = Bun.env.CADDY_PROJECTS_OIDC_CLIENT_SECRET ?? ""
  const cookieSecret = Bun.env.CADDY_PROJECTS_OIDC_COOKIE_SECRET ?? ""
  const providerName = Bun.env.CADDY_PROJECTS_OIDC_PROVIDER ?? "zitadel"
  return {
    providerName,
    issuer,
    clientId,
    clientSecret,
    cookieSecret,
    scope: ["openid", "email", "profile"],
    username: "email",
    cookieName: "caddy",
    cookieMaxAge: "168h",
    redirectUrl: "/oauth2/callback",
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const repo = flagValue(argv, "--repo") ?? join(os.homedir(), "c/adaptive/caddy-projects-history")
  const socketDir = flagValue(argv, "--socket-dir") ?? socketDirDefault()
  const usersFlag = flagValue(argv, "--users")
  const adminUrl = flagValue(argv, "--admin-url") ?? "http://localhost:2019"
  const caddyBin = flagValue(argv, "--caddy-bin") ?? "caddy"
  const noPush = flagHas(argv, "--no-push")
  const isRoot = process.getuid?.() === 0

  let users: string[]
  if (usersFlag) {
    users = usersFlag
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
  } else {
    users = [os.userInfo().username]
  }
  if (!isRoot) {
    users = [os.userInfo().username]
  }

  const storeR = await projectStoreOpen({
    dir: repo,
    autoPush: !noPush,
    authorName: "caddy-projects",
    authorEmail: "caddy-projects@localhost",
  })
  if (!storeR.success) {
    console.error(`${storeR.op}: ${storeR.errorMessage}`)
    process.exit(1)
  }

  const caddy: CaddyConfigOptions = { httpPort: 443 }
  const oidc = oidcFromEnv()
  if (oidc) caddy.oidc = oidc

  const applyOptions: ProjectsApplyOptions = {
    caddy,
    caddyBin,
    adminUrl,
  }

  mkdirSync(socketDir, { recursive: true })

  const servers: ReturnType<typeof Bun.serve>[] = []
  for (const user of users) {
    const socketPath = join(socketDir, `${user}.sock`)
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath)
      } catch {
        // ignore
      }
    }

    const ctx: ApiContext = {
      user,
      store: storeR.data,
      options: applyOptions,
    }

    const server = Bun.serve({
      unix: socketPath,
      fetch: (req) => apiHandle(req, ctx),
    })
    servers.push(server)

    try {
      chmodSync(socketPath, 0o600)
    } catch {
      // ignore
    }
    if (isRoot) {
      const uidR = systemUserUid(user)
      if (uidR.success) {
        try {
          chownSync(socketPath, uidR.data, uidR.data)
        } catch (e) {
          console.error(`chown ${socketPath}: ${e}`)
        }
      } else {
        console.error(`uid for ${user}: ${uidR.errorMessage}`)
      }
    }
    console.error(`listening on ${socketPath} for user ${user}`)
  }

  void servers
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
