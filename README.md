# TrustMCP — a trust-gated MCP gateway

**The identity & reputation layer for MCP tool calls.** TrustMCP sits in front of
your [Model Context Protocol](https://modelcontextprotocol.io) tools and scores
every calling agent with [Valiron](https://valiron.co) *before* the tool runs.
High-trust agents get full access, mediocre agents are throttled and pay more,
and low-trust or unknown agents are sandboxed or blocked — automatically.

Built on [`@valiron/sdk`](https://www.npmjs.com/package/@valiron/sdk) (ERC-8004
on-chain reputation + behavioral sandbox + Moody's-style AAA→C tiers).

```
Agent ──tools/call──▶  TrustMCP gateway  ──▶ valiron.gate()  ──▶ allow / throttle / block
                              │
                              └──▶ live decision feed (dashboard)
```

## Why it matters

MCP is becoming the default way agents reach tools — APIs, wallets, databases.
But MCP has **no notion of *which* agent is calling or whether it can be
trusted**. TrustMCP closes that gap: it's a drop-in MCP endpoint that inherits
Valiron's trust gating, so a single line of config protects every tool from
malicious or unproven agents.

## Features

- **MCP-compatible endpoint** (`POST /api/mcp`, JSON-RPC: `initialize`,
  `tools/list`, `tools/call`) — point any MCP client at it.
- **Per-tool trust policy** — each tool declares a minimum Valiron score; risky
  tools (`send_payment`, `delete_records`) demand AAA-grade trust.
- **Risk-adjusted dynamic pricing** — bad agents pay up to 8× per call (the
  Valiron dynamic-pricing pattern) so abuse subsidizes its own risk.
- **Auto-sandbox** — unknown agents are held `pending` evaluation, never allowed
  through blind.
- **Guardrails engine** — behavioral policing *after* the trust gate, so even a
  trusted agent that gets prompt-injected or loops is caught: per-agent spend
  budgets + velocity caps, prompt-injection/exfiltration screening on tool
  arguments, high-risk burst detection, and automatic **quarantine**. This is
  the rogue-agent defense identity alone can't provide (see `ROADMAP.md`).
- **Agent Passport inspector** — resolve any agent ID / wallet into its full
  Valiron trust profile: on-chain ERC-8004 reputation, behavioral sandbox tier,
  World ID proof-of-personhood, and routing — a credit report for agents.
- **Attack-wave simulator** — unleash a swarm of malicious agents at the most
  dangerous tools and watch the gateway hold the line in real time.
- **Live security console** — real-time SSE dashboard of every allow/deny
  decision, with revenue, allow/block, and per-agent stats.
- **Runtime trust-mode toggle** — flip `auto` / `live` / `mock` from the UI with
  no restart. `live` is strict real-API-only; `mock` is fully offline.
- **Frictionless connect** — copy-paste `mcp.json` for Claude/Cursor and a ready
  curl command, generated for your host.
- **Bulletproof demo** — `auto` mode uses the real SDK when reachable and falls
  back to deterministic local profiles offline, so the stage demo never dies.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

Open the dashboard and click **▶ Run full demo**, or drive it from a terminal:

```bash
# trusted agent — allowed, AAA pricing
npx tsx scripts/agent.ts aaa-trusted-agent send_payment '{"to":"0xabc","amountUsd":25}'

# low-trust scraper — blocked from sensitive tools
npx tsx scripts/agent.ts low-trust-scraper delete_records '{"table":"users"}'

# brand-new agent — held pending sandbox evaluation
npx tsx scripts/agent.ts unknown-newcomer get_market_data '{"symbol":"SOL"}'
```

## The demo: one button

The UI is a single seamless workflow — no tabs. Just click **▶ Play guided
demo** in the header and it auto-plays the whole story with on-screen captions
and auto-scroll:

1. **Atlas (AAA)** — high reputation. The animated **Agent → Trust → Guardrails →
   Tool** pipeline lights all green; calls allowed at the cheapest price.
2. **Gremlin (CAA)** — low trust. Reads cost 8×; sensitive tools blocked right at
   the trust gate (pipeline goes red at the Trust stage).
3. **Nova (new)** — never seen before; auto-sandboxed, held pending.
4. **The money shot — Atlas (hijacked)**: a AAA-trusted agent that's been
   prompt-injected. Trust says TRUSTED (pipeline green through Trust)… then
   **Guardrails** light red, block the malicious payload, and quarantine it.
   Identity said "trusted"; behavior said "rogue". Nothing else on the floor
   catches this.

Everything is also live on the same page: the decision feed, guardrail budgets +
alerts, the agent passport inspector (try real id `25459`), and the copy-paste
MCP config. Flip the **mode toggle** (auto/live/mock) to prove it's hitting the
real Valiron API.

## Real operator billing (optional)

By default TrustMCP gates locally. Flip on the **real Valiron operator** to route
every tool call through the production trust gate *and* log billable usage to
your [Valiron dashboard](https://valiron.co/dashboard) (revenue, agents, call
logs, analytics):

```bash
# 1. Create your operator account + register the paid endpoints + print your key
VALIRON_EMAIL=you@example.com VALIRON_PASSWORD=secret VALIRON_NAME="You" \
  npx tsx scripts/register-operator.ts

# 2. Put the printed key in .env.local
echo 'VALIRON_OPERATOR_KEY=val_op_xxxx' >> .env.local

# 3. Restart — the header badge flips to "operator: live billing"
npm run dev
```

When `VALIRON_OPERATOR_KEY` is set, `src/lib/operator.ts` drives the SDK's
`paywall` middleware from inside the Next.js route handlers (via a small
Express-shaped shim), so gating decisions and usage are recorded on the real
Valiron backend. Remove the key to fall back to the local trust layer.

## How the trust gate works

`src/lib/gateway.ts` runs every tool call through `evaluateAgent()`
(`src/lib/trust.ts`), which calls `valiron.gate(agentId, { minScore })`. The
result (score, tier, risk, route) drives the allow/deny decision and the
`dynamicPrice()` calculation in `src/lib/tools.ts`.

To run against **real** agents, set `VALIRON_MODE=live` and pass real ERC-8004
agent IDs (e.g. `25459`) via the `x-agent-id` header.

## Project layout

```
src/
  app/
    page.tsx              # tabbed console: live / inspect / connect
    api/mcp/route.ts      # MCP JSON-RPC gateway
    api/events/route.ts   # SSE decision stream
    api/simulate/route.ts # drive demo agents
    api/attack/route.ts   # red-team attack-wave simulator
    api/inspect/route.ts  # agent passport lookup
    api/config/route.ts   # runtime trust-mode toggle
    api/catalog/route.ts  # tools + agents for the UI
  lib/
    trust.ts              # Valiron integration + passport + offline fallback
    gateway.ts            # core gate-then-execute logic
    tools.ts              # gated tool catalog + dynamic pricing
    agents.ts             # demo agents
    events.ts             # in-memory decision bus
    config.ts             # runtime trust-mode config
scripts/agent.ts          # CLI MCP client
```

## License

MIT
