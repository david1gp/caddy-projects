import * as a from "valibot"
import { createResultError, type ResultErr } from "#result"
import type { CaddyConfig } from "./CaddyConfig.js"
import type { ProjectStore } from "./ProjectStore.js"
import { projectMutableBy } from "./projectMutableBy.js"
import { type Project, type ProjectInput, projectInputSchema, projectSchema } from "./projectSchema.js"
import { projectStoreGet } from "./projectStoreGet.js"
import { projectStoreHistory } from "./projectStoreHistory.js"
import { projectStoreListAll } from "./projectStoreListAll.js"
import { projectStorePut } from "./projectStorePut.js"
import { projectStoreRemove } from "./projectStoreRemove.js"
import type { ProjectsApplyOptions } from "./projectsApply.js"
import { projectsApply } from "./projectsApply.js"
import { projectVisibleTo } from "./projectVisibleTo.js"

export type ApiContext = {
  user: string
  store: ProjectStore
  options: ProjectsApplyOptions
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

type ApplyResult = { success: true; data: unknown } | ResultErr

async function applyOrRevert(ctx: ApiContext, revert: () => Promise<ApplyResult>): Promise<ApplyResult> {
  const applyR = await projectsApply(ctx.store, ctx.options)
  if (!applyR.success) {
    await revert()
    return applyR
  }
  return applyR
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
        next = { ...(parsed.output as ProjectInput), user: ctx.user, name }
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

      const old = existingR.data
      const putR = await projectStorePut(ctx.store, next, `edit project ${ctx.user}/${name}`)
      if (!putR.success) return jsonErr(putR, 500)

      const applyR = await applyOrRevert(ctx, async () =>
        projectStorePut(ctx.store, old, `revert edit ${ctx.user}/${name}`),
      )
      if (!applyR.success) return jsonErr(applyR, 500)
      return jsonOk(next)
    }

    if (method === "DELETE") {
      const existingR = await projectStoreGet(ctx.store, ctx.user, name)
      if (!existingR.success) {
        return jsonErr(createResultError("apiHandle.delete", `not found: ${name}`), 404)
      }
      if (!projectMutableBy(existingR.data, ctx.user)) {
        return jsonErr(createResultError("apiHandle.delete", "forbidden"), 403)
      }
      const old = existingR.data
      const delR = await projectStoreRemove(ctx.store, ctx.user, name, `delete project ${ctx.user}/${name}`)
      if (!delR.success) return jsonErr(delR, 500)

      const applyR = await applyOrRevert(ctx, async () =>
        projectStorePut(ctx.store, old, `revert delete ${ctx.user}/${name}`),
      )
      if (!applyR.success) return jsonErr(applyR, 500)
      return jsonOk({ deleted: name })
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
    const project: Project = { ...input, user: ctx.user }

    const existsR = await projectStoreGet(ctx.store, ctx.user, project.name)
    if (existsR.success) {
      return jsonErr(createResultError("apiHandle.create", `already exists: ${project.name}`), 409)
    }

    const allR = await projectStoreListAll(ctx.store)
    if (!allR.success) return jsonErr(allR, 500)
    const collision = domainCollision(allR.data, project.domains)
    if (collision) {
      return jsonErr(createResultError("apiHandle.create", `domain conflict: ${collision}`), 409)
    }

    const putR = await projectStorePut(ctx.store, project, `create project ${ctx.user}/${project.name}`)
    if (!putR.success) return jsonErr(putR, 500)

    const applyR = await applyOrRevert(ctx, async () =>
      projectStoreRemove(ctx.store, ctx.user, project.name, `revert create ${ctx.user}/${project.name}`),
    )
    if (!applyR.success) return jsonErr(applyR, 500)
    return jsonOk(project, 201)
  }

  if (method === "GET" && path === "/config") {
    const applyR = await projectsApply(ctx.store, {
      ...ctx.options,
      skipReload: true,
      skipValidate: true,
    })
    if (!applyR.success) return jsonErr(applyR, 500)
    const pretty = url.searchParams.get("pretty") === "1"
    if (pretty) {
      return new Response(JSON.stringify(applyR.data, null, 2), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    return jsonOk(applyR.data)
  }

  if (method === "POST" && path === "/apply") {
    const applyR = await projectsApply(ctx.store, ctx.options)
    if (!applyR.success) return jsonErr(applyR, 500)
    return jsonOk(applyR.data as CaddyConfig)
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
