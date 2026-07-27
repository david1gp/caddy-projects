import { gitStoreList, gitStoreRead } from "#git-store"
import { createResult, type PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"
import { type Project, projectSchema } from "./projectSchema.js"

export async function projectStoreListAll(store: ProjectStore): PromiseResult<Project[]> {
  const op = "projectStoreListAll"
  const listR = await gitStoreList(store.git, "projects")
  if (!listR.success) return listR

  const projects: Project[] = []
  for (const rel of listR.data) {
    const r = await gitStoreRead(store.git, rel, projectSchema)
    if (!r.success) {
      return {
        success: false,
        op,
        errorMessage: `${rel}: ${r.errorMessage}`,
        errorData: r.errorData,
      }
    }
    projects.push(r.data as Project)
  }
  return createResult(projects)
}
