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
- **Live security console** — real-time dashboard of every allow/deny decision.
- **Bulletproof demo** — `VALIRON_MODE=auto` uses the real SDK when reachable and
  falls back to deterministic local profiles offline, so the stage demo never dies.

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

## Suggested 3-minute demo script

1. Open the dashboard. Show the gated tool catalog (note `send_payment` needs ≥85).
2. Click **Atlas (AAA)** → every call is allowed, cheapest pricing.
3. Click **Gremlin (CAA)** → reads cost 8×, `read_customer_records` and
   `delete_records` are **blocked** in red.
4. Click **Reaper (C)** → `send_payment` for $100k is denied on the spot.
5. Click **Nova (new)** → held *pending evaluation* (auto-sandbox).
6. Point out the revenue counter — bad actors paid the premium, good actors got discounts.

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
    page.tsx              # live dashboard
    api/mcp/route.ts      # MCP JSON-RPC gateway
    api/events/route.ts   # SSE decision stream
    api/simulate/route.ts # drive demo agents
    api/catalog/route.ts  # tools + agents for the UI
  lib/
    trust.ts              # Valiron integration + offline fallback
    gateway.ts            # core gate-then-execute logic
    tools.ts              # gated tool catalog + dynamic pricing
    agents.ts             # demo agents
    events.ts             # in-memory decision bus
scripts/agent.ts          # CLI MCP client
```

## License

MIT
