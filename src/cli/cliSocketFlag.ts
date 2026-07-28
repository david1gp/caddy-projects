export const cliSocketFlag = {
  kind: "parsed" as const,
  parse: String,
  optional: true as const,
  brief: "Unix socket path (or CADDY_PROJECTS_SOCKET env)",
}
