import { ValironSDK } from "@valiron/sdk";
import type { SupportedChain } from "@valiron/sdk";
import type { MoodysTier, RiskLevel, RouteDecision, TrustResult } from "./types";

/**
 * Trust layer for the TrustMCP gateway.
 *
 * It calls the real Valiron SDK to score incoming agents, but falls back to a
 * deterministic local profile registry when the API is unreachable or when
 * VALIRON_MODE=mock. This keeps the live demo bulletproof on stage while still
 * exercising the real `@valiron/sdk` when a network + real agent IDs exist.
 */

const MODE = process.env.VALIRON_MODE ?? "auto"; // "auto" | "live" | "mock"
const DEFAULT_CHAIN = process.env.VALIRON_CHAIN ?? "ethereum";

let sdk: ValironSDK | null = null;
function getSdk(): ValironSDK {
  if (!sdk) {
    sdk = new ValironSDK({
      chain: DEFAULT_CHAIN as SupportedChain,
      timeout: 4000,
      telemetry: { enabled: false },
    });
  }
  return sdk;
}

function tierFromScore(score: number): MoodysTier {
  if (score >= 95) return "AAA";
  if (score >= 88) return "AA";
  if (score >= 80) return "A";
  if (score >= 70) return "BAA";
  if (score >= 60) return "BA";
  if (score >= 50) return "B";
  if (score >= 35) return "CAA";
  if (score >= 20) return "CA";
  return "C";
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return "GREEN";
  if (score >= 45) return "YELLOW";
  return "RED";
}

function routeFromScore(score: number): RouteDecision {
  if (score >= 70) return "prod";
  if (score >= 60) return "prod_throttled";
  if (score >= 35) return "sandbox";
  return "sandbox_only";
}

/**
 * Seeded profiles used for the offline fallback + the canned demo agents.
 * Real agent IDs (e.g. ERC-8004 numeric ids) hit the live API first.
 */
const MOCK_PROFILES: Record<string, number> = {
  "aaa-trusted-agent": 96,
  "a-tier-research-bot": 82,
  "b-tier-bot": 54,
  "low-trust-scraper": 38,
  "malicious-drainer": 9,
};

// Agents that should look brand-new (no reputation yet -> pending sandbox).
const PENDING_AGENTS = new Set(["unknown-newcomer"]);

function mockProfile(agentId: string): TrustResult {
  if (PENDING_AGENTS.has(agentId)) {
    return {
      agentId,
      allow: false,
      score: 0,
      tier: "C",
      riskLevel: "RED",
      route: "sandbox",
      reasons: ["Agent pending evaluation — first-seen, sandbox running"],
      source: "mock",
      pending: true,
    };
  }

  // Stable pseudo-score for any unknown id so the demo is deterministic.
  let score = MOCK_PROFILES[agentId];
  if (score === undefined) {
    let h = 0;
    for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
    score = 25 + (h % 60); // 25-84
  }

  return {
    agentId,
    allow: score >= 65,
    score,
    tier: tierFromScore(score),
    riskLevel: riskFromScore(score),
    route: routeFromScore(score),
    reasons:
      score >= 65
        ? [`On-chain + behavioral score ${score} ≥ gate floor 65`]
        : [`Score ${score} below gate floor 65`],
    source: "mock",
  };
}

export async function evaluateAgent(
  agentId: string,
  opts: { minScore?: number } = {},
): Promise<TrustResult> {
  const minScore = opts.minScore ?? 65;

  if (MODE === "mock") {
    const m = mockProfile(agentId);
    return { ...m, allow: m.score >= minScore && !m.pending };
  }

  try {
    const gate = await getSdk().gate(agentId, { minScore });
    return {
      agentId,
      allow: gate.allow,
      score: gate.score,
      tier: gate.tier as MoodysTier,
      riskLevel: gate.riskLevel as RiskLevel,
      route: gate.route as RouteDecision,
      reasons: gate.allow
        ? [`Valiron score ${gate.score} (${gate.tier}) ≥ ${minScore}`]
        : [`Valiron score ${gate.score} (${gate.tier}) < ${minScore}`],
      source: "live",
    };
  } catch {
    if (MODE === "live") {
      // No silent fallback in strict live mode — surface a fail-closed deny.
      return {
        agentId,
        allow: false,
        score: 0,
        tier: "C",
        riskLevel: "RED",
        route: "sandbox_only",
        reasons: ["Trust gate unavailable — fail-closed deny"],
        source: "live",
      };
    }
    const m = mockProfile(agentId);
    return { ...m, allow: m.score >= minScore && !m.pending };
  }
}

export { tierFromScore, riskFromScore, routeFromScore };
