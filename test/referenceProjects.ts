import type { Project } from "../src/projectSchema.js"

/** plain proxy, no docs, no auth, multiple domains */
export const projectOpencode: Project = {
  port: 4096,
  domains: ["opencode.leonardomora.de", "oc.leonardomora.de", "o.leonardomora.de"],
  name: "opencode",
  path: "",
  user: "leo",
  access: "external",
  kind: "proxy",
  docs: false,
  browse: false,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

/** proxy + docs */
export const projectStartup: Project = {
  port: 3121,
  domains: ["preview.startup.contentoren.de"],
  name: "startup",
  path: "/home/leo/projects/startup",
  user: "leo",
  access: "external",
  kind: "proxy",
  docs: true,
  browse: false,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

/** proxy + oidc (internal) + headerUp */
export const projectHermes: Project = {
  port: 9119,
  domains: ["hermes.leonardomora.de"],
  name: "hermes",
  path: "",
  user: "leo",
  access: "internal",
  kind: "proxy",
  docs: false,
  browse: false,
  headerUp: {
    Host: "127.0.0.1:9119",
    Origin: "http://127.0.0.1:9119",
  },
  shared: false,
  template: false,
  disabled: false,
}

/** static file_server + docs */
export const projectDemos: Project = {
  port: 3999,
  domains: ["demos.leonardomora.de"],
  name: "demos",
  path: "/home/leo/projects/demos",
  user: "leo",
  access: "external",
  kind: "static",
  docs: true,
  browse: false,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

/** static + browse + oidc internal + docs */
export const projectBlue: Project = {
  port: 3998,
  domains: ["blue.leonardomora.de"],
  name: "blue",
  path: "/home/leo/projects/blue/alice-superstar",
  user: "leo",
  access: "internal",
  kind: "static",
  docs: true,
  browse: true,
  headerUp: {},
  shared: false,
  template: false,
  disabled: false,
}

export const referenceProjects: Project[] = [projectOpencode, projectStartup, projectHermes, projectDemos, projectBlue]

export const oidcTestOptions = {
  providerName: "zitadel",
  issuer: "https://auth.contentoren.de",
  clientId: "test-client",
  clientSecret: "test-secret",
  cookieSecret: "cookie-secret-for-tests",
  scope: ["openid", "email", "profile"],
  username: "email",
  cookieName: "caddy",
  cookieMaxAge: "168h",
  redirectUrl: "/oauth2/callback",
}
