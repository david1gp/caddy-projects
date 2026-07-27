#!/usr/bin/env bun
import { cliMain } from "./cliMain.js"

const r = await cliMain(process.argv.slice(2))
if (!r.success) {
  console.error(`${r.op}: ${r.errorMessage}`)
  process.exit(1)
}
console.log(r.data)
