import { createResult, createResultError, type Result } from "#result"
import type { Project } from "./projectSchema.js"

/** Same shape as Caddy project_docs path_regexp capture (relative under /docs/). */
const docsRelativePattern = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.md$/

export type ProjectDocsUrls = {
  urls: string[]
}

/**
 * Build public HTML review URLs for a docs markdown path under each project domain.
 * Input is a path relative to /docs/ (e.g. `guide/intro.md`), optionally with a `/docs/` prefix.
 */
export function projectDocsUrls(
  project: Pick<Project, "docs" | "domains">,
  relativePath: string,
  options?: { scheme?: "https" | "http" },
): Result<ProjectDocsUrls> {
  const op = "projectDocsUrls"
  if (project.docs !== true) {
    return createResultError(op, "docs disabled")
  }
  if (project.domains.length === 0) {
    return createResultError(op, "no domains")
  }

  let rel = relativePath.trim()
  if (rel === "") {
    return createResultError(op, "path required")
  }
  if (rel.startsWith("/docs/")) {
    rel = rel.slice("/docs/".length)
  } else if (rel.startsWith("docs/")) {
    rel = rel.slice("docs/".length)
  }
  rel = rel.replace(/^\/+/, "")

  if (rel.includes("..") || rel.includes("\0")) {
    return createResultError(op, "invalid path")
  }
  if (!docsRelativePattern.test(rel)) {
    return createResultError(op, "path must be a relative .md under /docs/ (e.g. guide/intro.md)")
  }

  const scheme = options?.scheme ?? "https"
  const urls = project.domains.map((d) => `${scheme}://${d}/docs/${rel}`)
  return createResult({ urls })
}
