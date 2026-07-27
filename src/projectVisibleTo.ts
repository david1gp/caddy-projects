import type { Project } from "./projectSchema.js"

export function projectVisibleTo(project: Project, user: string): boolean {
  if (project.user === user) return true
  if (project.shared === true) return true
  if (project.template === true) return true
  return false
}
