import { gitStoreWrite } from "#git-store"
import type { PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"
import type { Project } from "./projectSchema.js"
import { projectStorePath } from "./projectStorePath.js"

export async function projectStorePut(store: ProjectStore, project: Project, message: string): PromiseResult<string> {
  return gitStoreWrite(store.git, projectStorePath(project.user, project.name), project, message)
}
