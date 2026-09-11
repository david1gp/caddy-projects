#!/usr/bin/env bun
import { run } from "@stricli/core"
import { caddyProjectsVersionMetadataRender } from "./caddyProjectsVersionMetadataRender.js"
import { caddyProjectsApplication } from "./cli/caddyProjectsApplication.js"

const args = process.argv.slice(2)
const verboseVersion = args.includes("--verbose") && (args.includes("--version") || args[0] === "version")

if (verboseVersion) {
  process.stdout.write(caddyProjectsVersionMetadataRender())
} else {
  await run(caddyProjectsApplication, args, { process })
}
