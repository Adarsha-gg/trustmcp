# TrustMCP — Iteration log

> What shipped in the **feat/iteration-2** pass (May 29, 2026).  
> Builds on the design revamp merged in PR #1.

---

## Summary

This iteration turns the dashboard from a **demo console** into an **operator console**: inspect agents, watch guardrails in real time, flip incident modes, and see full x402 challenge details — all wired to existing backend APIs (no new mocks).

---

## Features added

### 1. Agent Passport inspector (`#passport`)

- **UI:** `src/components/passport.tsx`
- **API:** `POST /api/inspect` (existing)
- Lookup any agent ID (datalist + quick picks from demo catalog).
- Shows tier, score, route, live vs mock source, and signal cards:
  - ERC-8004 on-chain feedback
  - Behavioral sandbox tier
  - World ID verification
  - Icebreaker handles

### 2. Guardrails dashboard (`#guardrails`)

- **UI:** `src/components/guardrails-panel.tsx`
- **API:** `GET /api/guardrails`, `POST /api/guardrails` (reset)
- Polls every 2.5s for live updates.
- **Policy chips:** budget cap, velocity window, burst limit, quarantine duration.
- **Spend meters:** per-agent budget % with color thresholds (green → amber → red).
- **Violation alerts:** injection, budget, velocity, burst, quarantine — newest first.

### 3. Gateway ops & incident controls (`#ops`)

- **UI:** `src/components/ops.tsx`
- **Runtime panel:** trust mode, chain, Valiron operator billing on/off (`VALIRON_OPERATOR_KEY`).
- **Incident modes** (new backend + UI):
  | Mode | Behavior |
  |------|----------|
  | `normal` | Full pipeline |
  | `read_only` | Only public GREEN tools (`search_web`, `get_market_data`, weather upstreams) |
  | `fail_closed` | Kill switch — deny every call immediately (`blockedBy: kill-switch`, HTTP 503 on proxy) |
- **Red team:** “Launch attack wave” → `POST /api/attack` (16 hostile + 2 trusted agents), shows last wave stats.

### 4. x402 simulator polish

- **File:** `src/components/simulator.tsx`
- `/api/gate` now returns full `paymentRequired` object (not just boolean).
- **402 challenge receipt** shows `payTo`, `resource`, `network`, and “attach x-payment & retry” when `broke-agent` hits a paid tool.
- Banner when kill switch or read-only mode is active.
- Pipeline animation handles `kill-switch` and `read-only` stop steps.

### 5. Store & header upgrades

- **File:** `src/components/store.tsx`
  - `inspect()`, `refreshGuardrails()`, `resetGuardrails()`, `runAttackWave()`
  - Config: `chain`, `operator`, `incident`
  - Ambient auto-traffic **pauses** when incident ≠ `normal`
- **Header:** nav links to Passport / Guardrails / BYO API; incident pill when not normal.

---

## Backend changes

| File | Change |
|------|--------|
| `src/lib/config.ts` | `IncidentMode`: `normal` \| `fail_closed` \| `read_only` |
| `src/lib/gateway.ts` | Kill switch + read-only checks before trust / after trust |
| `src/lib/proxy.ts` | Same incident checks for BYO API traffic |
| `src/lib/incident.ts` | `isReadOnlyAllowed()` helper |
| `src/lib/types.ts` | `blockedBy` adds `kill-switch`, `read-only` |
| `src/app/api/config/route.ts` | GET/POST `incident` field |

---

## Page layout (new order)

1. Header  
2. Hero  
3. Tier strip  
4. **Passport** ← new  
5. Simulator  
6. **Guardrails** ← new  
7. BYO API  
8. **Ops** ← new  
9. Activity  
10. Footer  

---

## How to try it

```bash
npm run dev
# open http://localhost:3000

# Passport — inspect aaa-trusted-agent vs malicious-drainer
# Simulator — broke-agent + read_customer_records → 402 challenge receipt
# Guardrails — Run sample traffic, watch meters + alerts
# Ops — Launch attack wave, toggle Kill switch, flip Read-only
```

---

## Not in this pass (still on ROADMAP)

- Policy-as-code editor  
- Real MCP SDK transport  
- Human-in-the-loop approvals  
- Persistent audit DB + on-chain snapshot hashes  
- Real USDC x402 settlement on Base  

---

## Files touched

**New**

- `src/components/passport.tsx`
- `src/components/guardrails-panel.tsx`
- `src/components/ops.tsx`
- `src/lib/incident.ts`
- `ITERATION.md` (this file)

**Updated**

- `src/components/store.tsx`
- `src/components/simulator.tsx`
- `src/components/ui.tsx`
- `src/components/chrome.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/api/config/route.ts`
- `src/app/api/gate/route.ts`
- `src/lib/config.ts`
- `src/lib/gateway.ts`
- `src/lib/proxy.ts`
- `src/lib/types.ts`
