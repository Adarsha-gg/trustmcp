import type { RiskLevel } from "./types";

/**
 * Guardrails engine — behavioral policing layered on top of Valiron trust.
 *
 * Trust answers "who is this agent?". Guardrails answer "is this *specific call*
 * safe right now?" — catching trusted agents that get prompt-injected, loop, or
 * try to drain budgets/wallets/data. State is per-agent and in-memory (session),
 * stored on a globalThis singleton so it survives HMR.
 */

export type ViolationType =
  | "injection"
  | "budget"
  | "velocity"
  | "burst"
  | "quarantine";

export interface Violation {
  id: string;
  ts: number;
  agentId: string;
  tool: string;
  type: ViolationType;
  message: string;
}

interface AgentState {
  spend: number;
  callTimes: number[];
  spendWindow: { ts: number; amount: number }[];
  dangerTimes: number[];
  violations: number;
  quarantinedUntil: number;
}

interface GuardStore {
  agents: Map<string, AgentState>;
  alerts: Violation[];
}

const g = globalThis as unknown as { __trustmcpGuard?: GuardStore };
function store(): GuardStore {
  if (!g.__trustmcpGuard) g.__trustmcpGuard = { agents: new Map(), alerts: [] };
  return g.__trustmcpGuard;
}

export const POLICY = {
  /** Cumulative spend cap per agent (USD) before hard-block. */
  budgetUsd: 1.0,
  /** Max spend within the rolling window (USD). */
  velocityUsd: 0.4,
  velocityWindowMs: 60_000,
  /** Max RED-risk calls within the burst window before quarantine. */
  burstMax: 4,
  burstWindowMs: 60_000,
  /** How long a misbehaving agent stays quarantined. */
  quarantineMs: 5 * 60_000,
};

/** Patterns that indicate prompt injection / exfiltration / destructive intent. */
const INJECTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ignore (all |the )?(previous|prior|above) (instructions|prompts)/i, label: "prompt-injection" },
  { re: /disregard .{0,20}(instructions|rules|policy)/i, label: "prompt-injection" },
  { re: /drop\s+table|;\s*delete\s+from|truncate\s+table/i, label: "sql-injection" },
  { re: /rm\s+-rf|sudo\s+|\/etc\/passwd/i, label: "shell-injection" },
  { re: /(private|secret)\s*key|seed\s*phrase|mnemonic|BEGIN (RSA|PRIVATE)/i, label: "secret-exfil" },
  { re: /exfiltrat|send .{0,30}(to|webhook).{0,30}https?:\/\//i, label: "exfiltration" },
  { re: /\.\.\/\.\.\/|\.\.\\\.\.\\/, label: "path-traversal" },
  { re: /<script|javascript:|onerror=/i, label: "xss" },
];

function getAgent(agentId: string): AgentState {
  const s = store();
  let a = s.agents.get(agentId);
  if (!a) {
    a = { spend: 0, callTimes: [], spendWindow: [], dangerTimes: [], violations: 0, quarantinedUntil: 0 };
    s.agents.set(agentId, a);
  }
  return a;
}

function recordViolation(agentId: string, tool: string, type: ViolationType, message: string): Violation {
  const v: Violation = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    agentId,
    tool,
    type,
    message,
  };
  const s = store();
  s.alerts.unshift(v);
  if (s.alerts.length > 100) s.alerts.length = 100;
  const a = getAgent(agentId);
  a.violations += 1;
  return v;
}

export function screenArguments(args: Record<string, unknown>): { flagged: boolean; label?: string } {
  const blob = JSON.stringify(args ?? {});
  for (const p of INJECTION_PATTERNS) {
    if (p.re.test(blob)) return { flagged: true, label: p.label };
  }
  return { flagged: false };
}

export interface GuardResult {
  allow: boolean;
  type?: ViolationType;
  message?: string;
}

/**
 * Pre-execution guardrail check. Runs AFTER the trust gate, so it can stop a
 * trusted-but-rogue agent. Mutates burst/quarantine state on violation.
 */
export function checkGuardrails(
  agentId: string,
  tool: string,
  price: number,
  risk: RiskLevel,
  args: Record<string, unknown>,
): GuardResult {
  const now = Date.now();
  const a = getAgent(agentId);

  // 0. Already quarantined?
  if (a.quarantinedUntil > now) {
    const v = recordViolation(agentId, tool, "quarantine", "Agent quarantined after prior violations — call blocked");
    return { allow: false, type: "quarantine", message: v.message };
  }

  // 1. Injection / exfiltration screening (applies to every agent, every tier).
  const scan = screenArguments(args);
  if (scan.flagged) {
    a.quarantinedUntil = now + POLICY.quarantineMs;
    const v = recordViolation(agentId, tool, "injection", `Blocked ${scan.label} payload; agent quarantined`);
    return { allow: false, type: "injection", message: v.message };
  }

  // 2. Cumulative budget cap.
  if (a.spend + price > POLICY.budgetUsd) {
    const v = recordViolation(
      agentId,
      tool,
      "budget",
      `Budget cap $${POLICY.budgetUsd.toFixed(2)} would be exceeded (spent $${a.spend.toFixed(3)})`,
    );
    return { allow: false, type: "budget", message: v.message };
  }

  // 3. Spend velocity within rolling window.
  a.spendWindow = a.spendWindow.filter((e) => now - e.ts < POLICY.velocityWindowMs);
  const windowSpend = a.spendWindow.reduce((s, e) => s + e.amount, 0);
  if (windowSpend + price > POLICY.velocityUsd) {
    const v = recordViolation(
      agentId,
      tool,
      "velocity",
      `Spend velocity > $${POLICY.velocityUsd.toFixed(2)}/min — throttled`,
    );
    return { allow: false, type: "velocity", message: v.message };
  }

  // 4. Burst of dangerous calls -> quarantine.
  if (risk === "RED") {
    a.dangerTimes = a.dangerTimes.filter((t) => now - t < POLICY.burstWindowMs);
    if (a.dangerTimes.length + 1 > POLICY.burstMax) {
      a.quarantinedUntil = now + POLICY.quarantineMs;
      const v = recordViolation(
        agentId,
        tool,
        "burst",
        `Burst of ${a.dangerTimes.length + 1} high-risk calls/min — agent quarantined`,
      );
      return { allow: false, type: "burst", message: v.message };
    }
    a.dangerTimes.push(now);
  }

  return { allow: true };
}

/** Record a successful, billed call so budgets/velocity track reality. */
export function recordSpend(agentId: string, price: number): void {
  const a = getAgent(agentId);
  a.spend += price;
  a.callTimes.push(Date.now());
  if (price > 0) a.spendWindow.push({ ts: Date.now(), amount: price });
}

export interface GuardrailsSnapshot {
  policy: typeof POLICY;
  agents: {
    agentId: string;
    spend: number;
    budgetPct: number;
    violations: number;
    quarantined: boolean;
  }[];
  alerts: Violation[];
}

export function guardrailsSnapshot(): GuardrailsSnapshot {
  const s = store();
  const now = Date.now();
  const agents = [...s.agents.entries()]
    .map(([agentId, a]) => ({
      agentId,
      spend: Math.round(a.spend * 1000) / 1000,
      budgetPct: Math.min(100, Math.round((a.spend / POLICY.budgetUsd) * 100)),
      violations: a.violations,
      quarantined: a.quarantinedUntil > now,
    }))
    .sort((x, y) => y.spend - x.spend)
    .slice(0, 20);
  return { policy: POLICY, agents, alerts: s.alerts.slice(0, 40) };
}

export function resetGuardrails(): void {
  const s = store();
  s.agents.clear();
  s.alerts.length = 0;
}
