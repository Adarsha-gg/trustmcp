# TrustMCP — Roadmap & Left To Do

> Living backlog. We keep shipping. Newest flagship work lands at the top of
> "In progress / next"; everything below is the queue.

## The pain point we're chasing

People who expose tools/APIs to AI agents (MCP servers, x402 endpoints, internal
agent platforms) share one nightmare:

> **A trusted agent gets prompt-injected, jailbroken, or stuck in a loop — and
> before anyone notices it has drained a wallet, deleted records, exfiltrated
> PII, or burned thousands of dollars in API spend.**

Identity & reputation (Valiron) answers *"who is calling and can I trust them?"*
But the most expensive incidents come from agents that *were* trusted and then
went rogue mid-session. Trust is necessary but not sufficient. The money/safety
pain lives in the **actual call**: what is this agent trying to do *right now*,
how fast, how much is it spending, and does the payload look malicious?

**TrustMCP's answer: Trust (identity) + Guardrails (behavior) at the gateway.**
Every tool call is scored *and* policed in real time, and a trusted agent that
starts misbehaving is automatically quarantined.

---

## ✅ Shipped

- MCP-compatible gateway (`initialize` / `tools/list` / `tools/call`)
- Valiron trust gating per tool (min-score policy)
- Risk-adjusted dynamic pricing (bad agents pay more)
- Auto-sandbox for unknown agents
- Live SSE decision console
- Agent Passport inspector (real `getAgentProfile`: ERC-8004, sandbox, World ID)
- Attack-wave simulator
- Runtime trust-mode toggle (auto / live / mock)
- Frictionless Connect tab (mcp.json + curl)
- Real Valiron operator billing (paywall middleware in Next + usage logging)
- x402 agentic payments — 402 challenge + `x-payment` settlement + receipts,
  over both the MCP endpoint and a dedicated HTTP endpoint (trust-priced)
- Seamless single-page UI: drop-in `mcp.json` hero + read-only activity log

## 🔥 In progress / next (the flagship)

- [x] **Guardrails engine** — the rogue-agent killer:
  - [x] Per-agent **spend budget caps** + velocity limits (runaway-cost defense)
  - [x] **Prompt-injection / exfiltration screening** on tool arguments
  - [x] **Burst / anomaly detection** (too many high-risk calls in a window)
  - [x] **Automatic quarantine** — misbehaving trusted agents get locked down
  - [x] Live alerts feed + per-agent budget meters in the UI

## 📋 Backlog — 10+ features to build next

1. **Policy-as-code editor** — define per-tool/per-agent rules (allowed scopes,
   max amount, allowed hours, geo) in the UI or a `trustmcp.policy.ts`, hot-reloaded.
2. **Real MCP transport via official SDK** — adopt `@modelcontextprotocol/sdk`
   Streamable HTTP + session management so any compliant client/inspector works,
   and proxy to real downstream MCP tool servers (not just mock executors).
3. **Human-in-the-loop approvals** — high-risk calls (e.g. `send_payment` > $X)
   pause and ping a Slack/Telegram/web approval before executing; agent gets a
   202 + resumes on approve. Pairs with Valiron's webhook events.
4. ~~**x402 settlement integration**~~ ✅ done (mock settlement; swap in a real
   facilitator / on-chain settle next). Next: real USDC settlement on Base.
5. **Audit log + tamper-evident trail** — persist every decision to a database
   and commit Valiron `getAgentSnapshot()` hash chains on-chain for provable,
   immutable history (compliance / disputes).
6. **Reputation write-back** — when an agent misbehaves or behaves well at the
   gateway, submit ERC-8004 feedback so the whole network benefits (closes the
   trust loop, not just consumes it).
7. **Anomaly ML scoring** — per-agent behavioral baselines (tool mix, timing,
   args entropy) with drift detection, beyond static thresholds.
8. **Multi-tenant operator console** — teams, multiple gateways, per-environment
   keys, role-based access, and usage/cost dashboards per project.
9. **Spend analytics & alerts** — budget burn-down charts, anomaly alerts via
   email/Slack, projected monthly cost per agent, top-spender leaderboard.
10. **SDK / drop-in middleware package** — publish `@trustmcp/guard` so any
    Express/Fastify/Next/Hono API gets Trust + Guardrails in one line.
11. **Agent identity onboarding flow** — guided World ID + Icebreaker linking so
    your *own* agents boost their trust score before calling partners.
12. **Replay & simulation lab** — record real traffic, replay against new
    policies to see what *would* have been blocked before you ship a rule.
13. **Rate-limit & quota tiers** — per-tier request quotas (AAA gets more) with
    Retry-After + 429 semantics that match what Valiron's sandbox rewards.
14. **Kill switch / attack mode** — one toggle to fail-closed everything or drop
    to read-only tools during an active incident.
15. **Vercel one-click deploy** — `Deploy` button, hosted demo URL, env wizard.

## Stretch / moonshots

- Cross-gateway shared threat intel (a bad agent blocked at one gateway warns others)
- Natural-language policy authoring ("never let unverified agents move money")
- Browser extension to inspect any agent's passport on the web
