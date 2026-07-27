import { createResult, createResultError, type PromiseResult, resultTryParsingFetchErr } from "#result"

export async function caddyAdminReload(config: unknown, adminUrl = "http://localhost:2019"): PromiseResult<true> {
  const op = "caddyAdminReload"
  const url = `${adminUrl.replace(/\/$/, "")}/load`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cache-control": "must-revalidate",
      },
      body: JSON.stringify(config),
    })
    if (!res.ok) {
      const body = await res.text()
      return resultTryParsingFetchErr(op, body, res.status, res.statusText)
    }
    return createResult(true)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, msg)
  }
}
