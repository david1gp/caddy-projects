#!/usr/bin/env bun
import { run } from "@stricli/core"
import { caddyProjectsApplication } from "./cli/caddyProjectsApplication.js"

await run(caddyProjectsApplication, process.argv.slice(2), { process })
