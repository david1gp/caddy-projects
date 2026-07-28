export const cliBooleanPairFlags = {
  docs: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Enable docs serving",
  },
  noDocs: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Disable docs serving",
  },
  browse: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Enable directory browsing (static)",
  },
  noBrowse: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Disable directory browsing",
  },
  shared: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Make project visible to all users",
  },
  noShared: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Make project private",
  },
  template: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Mark as template (not emitted to Caddy)",
  },
  noTemplate: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Unmark as template",
  },
  disabled: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Disable project (omit from Caddy config)",
  },
  enabled: {
    kind: "boolean" as const,
    optional: true as const,
    withNegated: false as const,
    brief: "Enable project (clear disabled)",
  },
}

export type CliBooleanPairFlags = {
  docs?: boolean
  noDocs?: boolean
  browse?: boolean
  noBrowse?: boolean
  shared?: boolean
  noShared?: boolean
  template?: boolean
  noTemplate?: boolean
  disabled?: boolean
  enabled?: boolean
}
