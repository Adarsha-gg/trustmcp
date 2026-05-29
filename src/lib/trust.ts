import { ValironSDK } from "@valiron/sdk";
import type { SupportedChain } from "@valiron/sdk";
import { getChain, getMode } from "./config";
import type {
  AgentPassport,
  MoodysTier,
  RiskLevel,
  RouteDecision,
  TrustResult,
} from "./types";

/**
 * Trust layer for the TrustMCP gateway.
 *
 * It calls the real Valiron SDK to score incoming agents, but falls back to a
 * deterministic local profile registry when the API is unreachable or when
 * mode=mock. This keeps the live demo bulletproof on stage while still
 * exercising the real `@valiron/sdk` when a network + real agent IDs exist.
 */

let sdk: ValironSDK | null = null;
let sdkChain: string | null = null;
function getSdk(): ValironSDK {
  const chain = getChain();
  if (!sdk || sdkChain !== chain) {
    sdk = new ValironSDK({
      chain: chain as SupportedChain,
      timeout: 4000,
      telemetry: { enabled: false },
    });
    sdkChain = chain;
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
  "hijacked-agent": 92,
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
  const mode = getMode();

  if (mode === "mock") {
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
    if (mode === "live") {
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

/**
 * Full trust "passport" for an agent — the richer profile behind the gate
 * decision. Uses the real `getAgentProfile()` (on-chain identity, ERC-8004
 * reputation, behavioral tier, World ID, Icebreaker) when live, else a
 * synthesized mock so the inspector always renders.
 */
export async function inspectAgent(agentId: string): Promise<AgentPassport> {
  const mode = getMode();

  if (mode !== "mock") {
    try {
      const p = await getSdk().getAgentProfile(agentId);
      const onchain = p.onchainReputation;
      const local = p.localReputation;
      const score = local?.score ?? onchain?.averageScore ?? 0;
      return {
        agentId,
        source: "live",
        name: p.identity?.name ?? null,
        wallet: p.identity?.wallet ?? null,
        chain: p.chain?.network ?? getChain(),
        score: Math.round(score),
        tier: (local?.tier ?? tierFromScore(score)) as MoodysTier,
        riskLevel: (local?.riskLevel ?? riskFromScore(score)) as RiskLevel,
        route: (p.routing?.finalRoute ?? routeFromScore(score)) as RouteDecision,
        reasons: p.routing?.reasons ?? [],
        signals: {
          onchain: {
            present: !!onchain && onchain.totalFeedback > 0,
            feedbackCount: onchain?.totalFeedback ?? 0,
            averageScore: Math.round(onchain?.averageScore ?? 0),
          },
          sandbox: {
            present: !!local?.exists,
            tier: (local?.tier as MoodysTier) ?? null,
            graduated: local?.graduated ?? null,
          },
          worldId: {
            verified: !!p.worldId?.verified,
            level: p.worldId?.verificationLevel ?? null,
          },
          icebreaker: { present: false, handles: [] },
        },
      };
    } catch {
      if (mode === "live") {
        return mockPassport(agentId, true);
      }
    }
  }

  return mockPassport(agentId, false);
}

function mockPassport(agentId: string, unreachable: boolean): AgentPassport {
  const t = mockProfile(agentId);
  return {
    agentId,
    source: "mock",
    name: agentId.replace(/-/g, " "),
    wallet: "0x" + Math.abs(hash(agentId)).toString(16).padStart(40, "0").slice(0, 40),
    chain: getChain(),
    score: t.score,
    tier: t.tier,
    riskLevel: t.riskLevel,
    route: t.route,
    reasons: unreachable
      ? ["Live API unreachable — showing synthesized profile"]
      : t.reasons,
    signals: {
      onchain: {
        present: t.score > 40,
        feedbackCount: t.score > 40 ? 3 + (Math.abs(hash(agentId)) % 12) : 0,
        averageScore: t.score,
      },
      sandbox: { present: true, tier: t.tier, graduated: t.score >= 65 },
      worldId: {
        verified: t.score >= 80,
        level: t.score >= 80 ? "orb" : null,
      },
      icebreaker: { present: false, handles: [] },
    },
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export { tierFromScore, riskFromScore, routeFromScore };
