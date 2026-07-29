import * as os from "node:os"
import { join } from "node:path"

const SOCKET_DIR_DEFAULT = "/run/caddy-projects"

export function cliSocketPath(socketFlag?: string): string {
  if (socketFlag) return socketFlag
  if (Bun.env.CADDY_PROJECTS_SOCKET) return Bun.env.CADDY_PROJECTS_SOCKET
  const user = os.userInfo().username
  return join(SOCKET_DIR_DEFAULT, `${user}.sock`)
}
