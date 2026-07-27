import { type GitStoreOptions, gitStoreOpen } from "#git-store"
import { createResult, type PromiseResult } from "#result"
import type { ProjectStore } from "./ProjectStore.js"

export async function projectStoreOpen(options: GitStoreOptions): PromiseResult<ProjectStore> {
  const r = await gitStoreOpen(options)
  if (!r.success) return r
  return createResult({ git: r.data })
}
