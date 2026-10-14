import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"
import * as mod from "./claude-api-billing.middleware.js"

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"))
const copy = (v) => JSON.parse(JSON.stringify(v))

async function run(c) {
  const m = mod.default ?? mod
  let rejected
  const ctx = {
    protocol: "anthropic", model: "", stream: false, path: "", ...(c.ctx ?? {}),
    options: c.options ?? {}, state: {},
    reject(status, message) { rejected ??= { status, message } },
  }
  const out = {}
  if (c.request) {
    const r = m.onRequest ? await m.onRequest(copy(c.request), ctx) : undefined
    if (rejected) out.reject = rejected
    else out.request = r === undefined ? c.request : copy(r)
  }
  return out
}

for (const c of cases) {
  test(c.name, async () => {
    const got = await run(c)
    if (c.reject) {
      assert.equal(got.reject?.status, c.reject.status)
      if (c.reject.message) assert.ok(got.reject?.message?.includes(c.reject.message))
    } else {
      assert.equal(got.reject, undefined)
      if (c.request) assert.deepEqual(got.request, c.expect_request ?? c.request)
    }
  })
}
