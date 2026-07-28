import { createResult, createResultError, type PromiseResult } from "#result"

export async function cliApiFetch(socketPath: string, path: string, init?: RequestInit): PromiseResult<unknown> {
  const op = "cliApiFetch"
  try {
    const res = await fetch(`http://localhost${path}`, {
      ...init,
      unix: socketPath,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    } as RequestInit & { unix: string })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return createResultError(op, `non-JSON response (${res.status}): ${text}`)
    }
    if (
      !res.ok ||
      (json && typeof json === "object" && "success" in json && (json as { success: boolean }).success === false)
    ) {
      const err = json as { op?: string; errorMessage?: string; success: false }
      return createResultError(err.op ?? op, err.errorMessage ?? text)
    }
    if (json && typeof json === "object" && "success" in json && (json as { success: boolean }).success === true) {
      return createResult((json as unknown as { data: unknown }).data)
    }
    return createResult(json)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, msg)
  }
}
