import { createResult, type PromiseResult } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import { caddyAdminReload } from "./caddyAdminReload.js"
import { caddyConfigGenerate } from "./caddyConfigGenerate.js"
import type { CaddyConfigOptions } from "./caddyConfigOptionsSchema.js"
import { caddyConfigValidate } from "./caddyConfigValidate.js"
import type { ProjectStore } from "./ProjectStore.js"
import { projectStoreListAll } from "./projectStoreListAll.js"

export type ProjectsRegenerateOptions = {
  caddy: CaddyConfigOptions
  skipValidate?: boolean
  skipReload?: boolean
  caddyBin?: string
  adminUrl?: string
  /** default { from: 3000, to: 3999 } for auto port assignment on create */
  portRange?: { from: number; to: number }
}

export async function projectsRegenerate(
  store: ProjectStore,
  options: ProjectsRegenerateOptions,
): PromiseResult<CaddyConfig> {
  const op = "projectsRegenerate"
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
