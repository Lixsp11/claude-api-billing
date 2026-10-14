# claude-api-billing

Route the Claude platform balance left out of Claude Code into [magpie](https://usemagpie.ai), by rewriting the two leading `system` blocks Claude Code sends to the Anthropic Messages API.

Claude Code always puts two blocks first in the `system` array:

```
x-anthropic-billing-header: cc_version=…; cc_entrypoint=cli;
You are Claude Code, Anthropic's official CLI for Claude.
```

Upstream keys the account routing off the billing header's `cc_entrypoint`: `cli` routes and bills as the Claude Code CLI, `sdk-cli` as the Claude Agent SDK. Ablation-verified against the same account: flip only `cc_entrypoint=cli` to `sdk-cli` and the identical request goes from 400 "credit balance too low" to 200 — nothing else in the request changed. The identity line is what the model reads itself as.

This middleware rewrites the two blocks in place and leaves everything else alone:

- `system[0]`: `cc_entrypoint=<value>` → `cc_entrypoint=<entrypoint>`
- `system[1]`: the CLI identity line → `<identity>`

Only blocks that look like Claude Code's own are touched; anything unrecognised passes through unchanged.

## Install

From magpie's **Plugins → Discover → GitHub**, or:

```
magpie plugin add github:Lixsp11/claude-api-billing
```

Then set options under **Plugins → Installed → Options**, or:

```
magpie plugin options claude-api-billing '<json>'
```

## Options

```json
{ "entrypoint": "sdk-cli",
  "identity":   "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
  "probe":      false }
```

- **`entrypoint`** — the value written after `cc_entrypoint=` in the billing block (default `sdk-cli`).
- **`identity`** — the text that replaces the CLI identity block (default the Agent SDK line).
- **`probe`** — `true` turns a user message of exactly `PROBE_CLAUDE_API_BILLING` into a 418, proving the middleware is loaded. Off by default.

## Notes

- It is a magpie **gateway middleware**, not an OpenCode provider plugin. Configure a Claude provider in magpie with the platform API account, then attach this middleware to it.
- Scope: for routing your own subscription accounts through your own gateway. One gateway, one user.
