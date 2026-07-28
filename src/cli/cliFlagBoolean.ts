import { createResult, createResultError, type Result } from "#result"

export function cliFlagBoolean(on: boolean | undefined, off: boolean | undefined): Result<boolean | undefined> {
  const op = "cliFlagBoolean"
  if (on === true && off === true) {
    return createResultError(op, "cannot pass both enable and disable flags together")
  }
  if (on === true) return createResult(true)
  if (off === true) return createResult(false)
  return createResult(undefined)
}
