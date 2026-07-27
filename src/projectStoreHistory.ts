import { type GitStoreCommitInfo, gitStoreHistory } from "#git-store"
import type { PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"
import { projectStorePath } from "./projectStorePath.js"

export async function projectStoreHistory(
  store: ProjectStore,
  user?: string,
  name?: string,
  limit?: number,
): PromiseResult<GitStoreCommitInfo[]> {
  let rel: string | undefined
  if (user && name) {
    rel = projectStorePath(user, name)
  } else if (user) {
    rel = `projects/${user}`
  } else {
    rel = "projects"
  }
  return gitStoreHistory(store.git, rel, limit)
}
