import { createResult, type PromiseResult } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import { caddyAdminReload } from "./caddyAdminReload.js"
import { caddyConfigGenerate } from "./caddyConfigGenerate.js"
import type { CaddyConfigOptions } from "./caddyConfigOptionsSchema.js"
import { caddyConfigValidate } from "./caddyConfigValidate.js"
import type { ProjectStore } from "./ProjectStore.js"
import { projectStoreListAll } from "./projectStoreListAll.js"

export type ProjectsApplyOptions = {
  caddy: CaddyConfigOptions
  skipValidate?: boolean
  skipReload?: boolean
  caddyBin?: string
  adminUrl?: string
}

export async function projectsApply(store: ProjectStore, options: ProjectsApplyOptions): PromiseResult<CaddyConfig> {
  const op = "projectsApply"
  const listR = await projectStoreListAll(store)
  if (!listR.success) return listR

  const genR = caddyConfigGenerate(listR.data, options.caddy)
  if (!genR.success) return genR

  if (!options.skipValidate) {
    const valR = await caddyConfigValidate(genR.data, options.caddyBin)
    if (!valR.success) return valR
  }

  if (!options.skipReload) {
    const reloadR = await caddyAdminReload(genR.data, options.adminUrl)
    if (!reloadR.success) return reloadR
  }

  void op
  return createResult(genR.data)
}
