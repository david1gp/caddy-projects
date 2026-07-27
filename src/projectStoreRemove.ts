import { gitStoreDelete } from "#git-store"
import type { PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"
import { projectStorePath } from "./projectStorePath.js"

export async function projectStoreRemove(
  store: ProjectStore,
  user: string,
  name: string,
  message: string,
): PromiseResult<string> {
  return gitStoreDelete(store.git, projectStorePath(user, name), message)
}
