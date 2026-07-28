import * as os from "node:os"
import { join } from "node:path"

function socketDirDefault(): string {
  if (process.getuid?.() === 0) return "/run/caddy-projects"
  const xdg = Bun.env.XDG_RUNTIME_DIR
  if (xdg) return join(xdg, "caddy-projects")
  return "/tmp/caddy-projects"
}

export function cliSocketPath(socketFlag?: string): string {
  if (socketFlag) return socketFlag
  if (Bun.env.CADDY_PROJECTS_SOCKET) return Bun.env.CADDY_PROJECTS_SOCKET
  const user = os.userInfo().username
  return join(socketDirDefault(), `${user}.sock`)
}
