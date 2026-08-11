import { createResult, createResultError, type Result } from "#result"
import type { CliBooleanPairFlags } from "./cliBooleanPairFlags.js"
import { cliFlagBoolean } from "./cliFlagBoolean.js"
import { cliHeaderUpParse } from "./cliHeaderUpParse.js"

export type CliBodyFlags = CliBooleanPairFlags & {
  name?: string
  port?: number
  domain?: string[]
  path?: string
  kind?: string
  access?: string
  headerUp?: string[]
  flushInterval?: number
}

export function cliBodyFromFlags(flags: CliBodyFlags): Result<Record<string, unknown>> {
  const op = "cliBodyFromFlags"
  const body: Record<string, unknown> = {}

  if (flags.name !== undefined) body.name = flags.name
  if (flags.port !== undefined) body.port = flags.port
  if (flags.domain !== undefined && flags.domain.length > 0) body.domains = flags.domain
  if (flags.path !== undefined) body.path = flags.path
  if (flags.kind !== undefined) body.kind = flags.kind
  if (flags.access !== undefined) body.access = flags.access

  const docsR = cliFlagBoolean(flags.docs, flags.noDocs)
  if (!docsR.success) return createResultError(op, "conflicting --docs and --no-docs")
  if (docsR.data !== undefined) body.docs = docsR.data

  const browseR = cliFlagBoolean(flags.browse, flags.noBrowse)
  if (!browseR.success) return createResultError(op, "conflicting --browse and --no-browse")
  if (browseR.data !== undefined) body.browse = browseR.data

  const sharedR = cliFlagBoolean(flags.shared, flags.noShared)
  if (!sharedR.success) return createResultError(op, "conflicting --shared and --no-shared")
  if (sharedR.data !== undefined) body.shared = sharedR.data

  const templateR = cliFlagBoolean(flags.template, flags.noTemplate)
  if (!templateR.success) return createResultError(op, "conflicting --template and --no-template")
  if (templateR.data !== undefined) body.template = templateR.data

  // disabled: --disabled => true, --enabled => false
  const disabledR = cliFlagBoolean(flags.disabled, flags.enabled)
  if (!disabledR.success) return createResultError(op, "conflicting --disabled and --enabled")
  if (disabledR.data !== undefined) body.disabled = disabledR.data

  const spaR = cliFlagBoolean(flags.spa, flags.noSpa)
  if (!spaR.success) return createResultError(op, "conflicting --spa and --no-spa")
  if (spaR.data !== undefined) body.spa = spaR.data

  if (flags.headerUp !== undefined && flags.headerUp.length > 0) {
    const hR = cliHeaderUpParse(flags.headerUp)
    if (!hR.success) return hR
    body.headerUp = hR.data
  }

  if (flags.flushInterval !== undefined) body.flushInterval = flags.flushInterval

  return createResult(body)
}
