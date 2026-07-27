import { gitStoreRead } from "#git-store"
import { createResult, type PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"
import { type Project, projectSchema } from "./projectSchema.js"
import { projectStorePath } from "./projectStorePath.js"

export async function projectStoreGet(store: ProjectStore, user: string, name: string): PromiseResult<Project> {
  const r = await gitStoreRead(store.git, projectStorePath(user, name), projectSchema)
  if (!r.success) return r
  return createResult(r.data as Project)
}
