import type { Project } from "./projectSchema.js"

export function projectPortCollision(
  projects: Project[],
  port: number,
  excludeName?: string,
  excludeUser?: string,
): Project | null {
  for (const p of projects) {
    if (p.disabled || p.template) continue
    if (excludeName && excludeUser && p.name === excludeName && p.user === excludeUser) continue
    if (p.port === port) return p
  }
  return null
}
