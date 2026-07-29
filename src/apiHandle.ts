import * as a from "valibot"
import { createResultError, type ResultErr } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import { caddyConfigSelect } from "./caddyConfigSelect.js"
import { caddyConfigSummary } from "./caddyConfigSummary.js"
import type { ProjectStore } from "./ProjectStore.js"
import { projectDocsUrls } from "./projectDocsUrls.js"
import { projectMutableBy } from "./projectMutableBy.js"
import { projectPortCollision } from "./projectPortCollision.js"
import { projectPortNext } from "./projectPortNext.js"
import { type Project, type ProjectInput, projectInputSchema, projectSchema } from "./projectSchema.js"
import { projectStoreGet } from "./projectStoreGet.js"
import { projectStoreHistory } from "./projectStoreHistory.js"
import { projectStoreListAll } from "./projectStoreListAll.js"
import { projectStorePut } from "./projectStorePut.js"
import { projectStoreRemove } from "./projectStoreRemove.js"
import type { ProjectsRegenerateOptions } from "./projectsRegenerate.js"
import { projectsRegenerate } from "./projectsRegenerate.js"
import { projectVisibleTo } from "./projectVisibleTo.js"

export type ApiContext = {
  user: string
  store: ProjectStore
  options: ProjectsRegenerateOptions
}

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function jsonErr(err: ResultErr, status?: number): Response {
  const s = status ?? err.statusCode ?? (err.errorMessage.includes("not found") ? 404 : 400)
  return new Response(JSON.stringify(err), {
    status: s,
    headers: { "content-type": "application/json" },
  })
}

async function bodyJson(req: Request): Promise<{ success: true; data: unknown } | ResultErr> {
  const op = "apiHandle.body"
  try {
    return { success: true, data: await req.json() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return createResultError(op, `invalid JSON body: ${msg}`)
  }
}

function domainCollision(
  projects: Project[],
  domains: string[],
  excludeName?: string,
  excludeUser?: string,
): string | null {
  for (const p of projects) {
    if (p.disabled || p.template) continue
    if (excludeName && excludeUser && p.name === excludeName && p.user === excludeUser) continue
    for (const d of domains) {
      if (p.domains.includes(d)) return d
    }
  }
  return null
}

type RegenerateResult = { success: true; data: unknown } | ResultErr

async function regenerateOrRevert(ctx: ApiContext, revert: () => Promise<RegenerateResult>): Promise<RegenerateResult> {
  const regenR = await projectsRegenerate(ctx.store, ctx.options)
  if (!regenR.success) {
    await revert()
    return regenR
  }
  return regenR
}

async function projectDelete(ctx: ApiContext, existing: Project): Promise<Response> {
  if (!projectMutableBy(existing, ctx.user)) {
    return jsonErr(createResultError("apiHandle.delete", "forbidden"), 403)
  }
  const name = existing.name
  const delR = await projectStoreRemove(ctx.store, ctx.user, name, `delete project ${ctx.user}/${name}`)
  if (!delR.success) return jsonErr(delR, 500)

  const regenR = await regenerateOrRevert(ctx, async () =>
    projectStorePut(ctx.store, existing, `revert delete ${ctx.user}/${name}`),
  )
  if (!regenR.success) return jsonErr(regenR, 500)
  return jsonOk({ deleted: name })
}

export async function apiHandle(request: Request, ctx: ApiContext): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method.toUpperCase()

  if (method === "GET" && path === "/health") {
    return jsonOk({ ok: true, user: ctx.user })
  }

  if (method === "GET" && path === "/projects") {
    const listR = await projectStoreListAll(ctx.store)
    if (!listR.success) return jsonErr(listR, 500)
    let items = listR.data.filter((p) => projectVisibleTo(p, ctx.user))
    if (url.searchParams.get("mine") === "1") {
      items = items.filter((p) => p.user === ctx.user)
    }
    if (url.searchParams.get("templates") === "1") {
      items = items.filter((p) => p.template === true)
    }
    return jsonOk(items)
  }

  const byPortMatch = path.match(/^\/projects\/by-port\/(\d+)$/)
  if (byPortMatch && method === "DELETE") {
    const port = Number(byPortMatch[1])
    const listR = await projectStoreListAll(ctx.store)
    if (!listR.success) return jsonErr(listR, 500)
    const found = listR.data.find((p) => p.user === ctx.user && p.port === port)
    if (!found) {
      return jsonErr(createResultError("apiHandle.deleteByPort", `no project with port ${port}`), 404)
    }
    return projectDelete(ctx, found)
  }

  const docsMatch = path.match(/^\/projects\/([^/]+)\/docs$/)
  if (docsMatch && method === "GET") {
    const name = decodeURIComponent(docsMatch[1]!)
    const listR = await projectStoreListAll(ctx.store)
    if (!listR.success) return jsonErr(listR, 500)
    const found = listR.data.find((p) => p.name === name && projectVisibleTo(p, ctx.user))
    if (!found) return jsonErr(createResultError("apiHandle.docs", `not found: ${name}`), 404)
    const rel = url.searchParams.get("path") ?? ""
    const schemeParam = url.searchParams.get("scheme")
    const scheme = schemeParam === "http" ? "http" : "https"
    const urlsR = projectDocsUrls(found, rel, { scheme })
    if (!urlsR.success) return jsonErr(urlsR, 400)
    return jsonOk(urlsR.data)
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/)
  if (projectMatch) {
    const name = decodeURIComponent(projectMatch[1]!)
    if (method === "GET") {
      const listR = await projectStoreListAll(ctx.store)
      if (!listR.success) return jsonErr(listR, 500)
      const found = listR.data.find((p) => p.name === name && projectVisibleTo(p, ctx.user))
      if (!found) return jsonErr(createResultError("apiHandle.get", `not found: ${name}`), 404)
      return jsonOk(found)
    }

    if (method === "PUT" || method === "PATCH") {
      const bodyR = await bodyJson(request)
      if (!bodyR.success) return jsonErr(bodyR, 400)
      const existingR = await projectStoreGet(ctx.store, ctx.user, name)
      if (!existingR.success) {
        return jsonErr(createResultError("apiHandle.edit", `not found: ${name}`), 404)
      }
      if (!projectMutableBy(existingR.data, ctx.user)) {
        return jsonErr(createResultError("apiHandle.edit", "forbidden"), 403)
      }

      let next: Project
      if (method === "PUT") {
        const parsed = a.safeParse(projectInputSchema, bodyR.data)
        if (!parsed.success) {
          return jsonErr(
            createResultError("apiHandle.put", a.summarize(parsed.issues), JSON.stringify(bodyR.data)),
            400,
          )
        }
        const input = parsed.output as ProjectInput
        if (input.port === undefined) {
          return jsonErr(createResultError("apiHandle.put", "port is required on full replace"), 400)
        }
        next = { ...input, port: input.port, user: ctx.user, name }
      } else {
        const patch = bodyR.data as Record<string, unknown>
        const merged = { ...existingR.data, ...patch, user: ctx.user, name }
        const parsed = a.safeParse(projectSchema, merged)
        if (!parsed.success) {
          return jsonErr(createResultError("apiHandle.patch", a.summarize(parsed.issues), JSON.stringify(merged)), 400)
        }
        next = parsed.output as Project
      }

      const allR = await projectStoreListAll(ctx.store)
      if (!allR.success) return jsonErr(allR, 500)
      const collision = domainCollision(allR.data, next.domains, name, ctx.user)
      if (collision) {
        return jsonErr(createResultError("apiHandle.edit", `domain conflict: ${collision}`), 409)
      }
      const portHit = projectPortCollision(allR.data, next.port, name, ctx.user)
      if (portHit) {
        return jsonErr(
          createResultError("apiHandle.edit", `port conflict: ${next.port} used by ${portHit.user}/${portHit.name}`),
          409,
        )
      }

      const old = existingR.data
      const putR = await projectStorePut(ctx.store, next, `edit project ${ctx.user}/${name}`)
      if (!putR.success) return jsonErr(putR, 500)

      const regenR = await regenerateOrRevert(ctx, async () =>
        projectStorePut(ctx.store, old, `revert edit ${ctx.user}/${name}`),
      )
      if (!regenR.success) return jsonErr(regenR, 500)
      return jsonOk(next)
    }

    if (method === "DELETE") {
      const existingR = await projectStoreGet(ctx.store, ctx.user, name)
      if (!existingR.success) {
        return jsonErr(createResultError("apiHandle.delete", `not found: ${name}`), 404)
      }
      return projectDelete(ctx, existingR.data)
    }
  }

  if (method === "POST" && path === "/projects") {
    const bodyR = await bodyJson(request)
    if (!bodyR.success) return jsonErr(bodyR, 400)
    const parsed = a.safeParse(projectInputSchema, bodyR.data)
    if (!parsed.success) {
      return jsonErr(createResultError("apiHandle.create", a.summarize(parsed.issues), JSON.stringify(bodyR.data)), 400)
    }
    const input = parsed.output as ProjectInput

    const existsR = await projectStoreGet(ctx.store, ctx.user, input.name)
    if (existsR.success) {
      return jsonErr(createResultError("apiHandle.create", `already exists: ${input.name}`), 409)
    }

    const allR = await projectStoreListAll(ctx.store)
    if (!allR.success) return jsonErr(allR, 500)
    const collision = domainCollision(allR.data, input.domains)
    if (collision) {
      return jsonErr(createResultError("apiHandle.create", `domain conflict: ${collision}`), 409)
    }

    let port = input.port
    if (port === undefined) {
      const nextR = projectPortNext(allR.data, ctx.options.portRange)
      if (!nextR.success) return jsonErr(nextR, 400)
      port = nextR.data
    } else {
      const portHit = projectPortCollision(allR.data, port)
      if (portHit) {
        return jsonErr(
          createResultError("apiHandle.create", `port conflict: ${port} used by ${portHit.user}/${portHit.name}`),
          409,
        )
      }
    }

    const project: Project = { ...input, port, user: ctx.user }

    const putR = await projectStorePut(ctx.store, project, `create project ${ctx.user}/${project.name}`)
    if (!putR.success) return jsonErr(putR, 500)

    const regenR = await regenerateOrRevert(ctx, async () =>
      projectStoreRemove(ctx.store, ctx.user, project.name, `revert create ${ctx.user}/${project.name}`),
    )
    if (!regenR.success) return jsonErr(regenR, 500)
    return jsonOk(project, 201)
  }

  if (method === "GET" && path === "/config") {
    const summary = url.searchParams.get("summary") === "1"
    const select = url.searchParams.get("select")
    const pretty = url.searchParams.get("pretty") === "1"

    if (summary) {
      const listR = await projectStoreListAll(ctx.store)
      if (!listR.success) return jsonErr(listR, 500)
      const visible = listR.data.filter((p) => projectVisibleTo(p, ctx.user))
      return jsonOk(caddyConfigSummary(visible))
    }

    const regenR = await projectsRegenerate(ctx.store, {
      ...ctx.options,
      skipReload: true,
      skipValidate: true,
    })
    if (!regenR.success) return jsonErr(regenR, 500)

    if (select !== null && select !== "") {
      const listR = await projectStoreListAll(ctx.store)
      if (!listR.success) return jsonErr(listR, 500)
      const visible = listR.data.filter((p) => projectVisibleTo(p, ctx.user))
      const visibleDomains = new Set(
        visible.filter((p) => !p.disabled && !p.template).flatMap((p) => p.domains.map((d) => d.toLowerCase())),
      )
      const full = regenR.data as CaddyConfig
      const scoped: CaddyConfig = {
        ...full,
        apps: {
          ...full.apps,
          http: {
            ...full.apps.http,
            servers: {
              srv0: {
                ...full.apps.http.servers.srv0,
                routes: full.apps.http.servers.srv0.routes.filter((route) => {
                  const match = (route as { match?: Array<{ host?: string[] }> }).match
                  const hosts = match?.[0]?.host ?? []
                  return hosts.some((h) => visibleDomains.has(h.toLowerCase()))
                }),
              },
            },
          },
        },
      }
      const selR = caddyConfigSelect(scoped, visible, select)
      if (!selR.success) return jsonErr(selR, 404)
      if (pretty) {
        return new Response(JSON.stringify(selR.data, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      return jsonOk(selR.data)
    }

    if (pretty) {
      return new Response(JSON.stringify(regenR.data, null, 2), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    return jsonOk(regenR.data)
  }

  if (method === "POST" && path === "/regenerate") {
    const regenR = await projectsRegenerate(ctx.store, ctx.options)
    if (!regenR.success) return jsonErr(regenR, 500)
    return jsonOk(regenR.data as CaddyConfig)
  }

  if (method === "GET" && path === "/history") {
    const name = url.searchParams.get("name") ?? undefined
    const limitRaw = url.searchParams.get("limit")
    const limit = limitRaw ? Number(limitRaw) : undefined
    const histR = await projectStoreHistory(ctx.store, name ? ctx.user : undefined, name, limit)
    if (!histR.success) return jsonErr(histR, 500)
    return jsonOk(histR.data)
  }

  return jsonErr(createResultError("apiHandle", `not found: ${method} ${path}`), 404)
}
