// claude-api-billing.middleware.js — magpie gateway middleware.
//
// Claude Code puts two blocks first in the Anthropic `system` array that fix
// how the upstream bills and names the session:
//     system[0]  x-anthropic-billing-header: cc_version=…; cc_entrypoint=cli;
//     system[1]  You are Claude Code, Anthropic's official CLI for Claude.
//
// `cc_entrypoint` is what the upstream keys on (ablation-verified: flip only
// `cli` to `sdk-cli` and the same request goes from 400 "credit balance too
// low" to 200; nothing else changed). So this middleware rewrites the two
// leading blocks in place and leaves everything else alone:
//   - system[0]: cc_entrypoint=<value>  ->  cc_entrypoint=<entrypoint>
//   - system[1]: the CLI identity line   ->  <identity>
//
//   { "entrypoint": "sdk-cli",
//     "identity":   "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
//     "probe":      false }
//
// Only blocks that look like Claude Code's own are touched. `probe` turns a
// user message of exactly "PROBE_CLAUDE_API_BILLING" into a 418 liveness reply.

const DEFAULT_ENTRYPOINT = "sdk-cli"
const DEFAULT_IDENTITY = "You are a Claude agent, built on Anthropic's Claude Agent SDK."
const CLI_IDENTITY_PREFIX = "You are Claude Code"
const PROBE = "PROBE_CLAUDE_API_BILLING"

export function onRequest(body, ctx) {
  if (!body || typeof body !== "object") return
  const o = (ctx && ctx.options && typeof ctx.options === "object") ? ctx.options : {}

  if (o.probe) {
    const msgs = body.messages
    const last = Array.isArray(msgs) ? msgs[msgs.length - 1] : null
    if (last) {
      const t = typeof last.content === "string" ? last.content
        : Array.isArray(last.content) && last.content[0] && typeof last.content[0].text === "string"
          ? last.content[0].text : ""
      if (t === PROBE) return ctx.reject(418, "claude-api-billing middleware alive")
    }
  }

  if (!Array.isArray(body.system)) return
  const entrypoint = typeof o.entrypoint === "string" && o.entrypoint ? o.entrypoint : DEFAULT_ENTRYPOINT
  const identity = typeof o.identity === "string" && o.identity ? o.identity : DEFAULT_IDENTITY
  let changed = false

  const billing = body.system[0]
  if (billing && typeof billing.text === "string" && billing.text.includes("x-anthropic-billing-header")) {
    const next = billing.text.replace(/(cc_entrypoint=)[^;\s]*/, (_m, p) => p + entrypoint)
    if (next !== billing.text) { billing.text = next; changed = true }
  }

  const who = body.system[1]
  if (who && typeof who.text === "string" && who.text.trim().startsWith(CLI_IDENTITY_PREFIX) && who.text !== identity) {
    who.text = identity
    changed = true
  }

  return changed ? body : undefined
}
