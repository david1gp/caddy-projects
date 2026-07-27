import type { Project } from "./projectSchema.js"

export function projectMutableBy(project: Project, user: string): boolean {
  return project.user === user
}
