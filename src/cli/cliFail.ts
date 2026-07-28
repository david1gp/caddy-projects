import type { ResultErr } from "#result"

export function cliFail(err: ResultErr): never {
  console.error(`${err.op}: ${err.errorMessage}`)
  process.exit(1)
}
