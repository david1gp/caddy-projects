export function cliTableProjects(projects: Array<Record<string, unknown>>): string {
  const lines = ["NAME\tPORT\tKIND\tACCESS\tDOMAINS\tUSER"]
  for (const p of projects) {
    const domains = Array.isArray(p.domains) ? (p.domains as string[]).join(",") : ""
    lines.push(`${p.name}\t${p.port}\t${p.kind}\t${p.access}\t${domains}\t${p.user}`)
  }
  return lines.join("\n")
}
