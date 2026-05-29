import { recordDecision } from "./events";
import { checkGuardrails, recordSpend } from "./guardrails";
import { isOperatorEnabled, operatorGate } from "./operator";
import { dynamicPrice, TOOLS_BY_NAME } from "./tools";
import { evaluateAgent } from "./trust";
import type { Decision, TrustResult } from "./types";

export interface GateOutcome {
  decision: Decision;
  result?: unknown;
  error?: { code: number; message: string };
}

let counter = 0;
function decisionId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

/**
 * Core trust-gated tool execution. Every tool call flows through here:
 *   1. Resolve the tool + its trust policy
 *   2. Score the calling agent with Valiron
 *   3. Enforce min-score / pending policy
 *   4. Compute risk-adjusted price
 *   5. Execute the downstream tool (or deny) and log the decision
 */
export async function handleToolCall(
  agentId: string | null,
  toolName: string,
  args: Record<string, unknown>,
): Promise<GateOutcome> {
  const tool = TOOLS_BY_NAME.get(toolName);

  if (!tool) {
    return { error: { code: -32601, message: `Unknown tool: ${toolName}` } } as GateOutcome;
  }

  if (!agentId) {
    const decision: Decision = {
      id: decisionId(),
      ts: Date.now(),
      agentId: "anonymous",
      tool: toolName,
      allow: false,
      blockedBy: "trust-gate",
      score: 0,
      tier: "C",
      riskLevel: "RED",
      route: "sandbox_only",
      price: 0,
      reasons: ["Missing agent identity (x-agent-id header)"],
      source: "mock",
    };
    recordDecision(decision);
    return { decision, error: { code: 401, message: "Missing agent identity" } };
  }

  let trust: TrustResult;
  if (isOperatorEnabled()) {
    // Real Valiron operator gate — also logs billable usage to the dashboard.
    const og = await operatorGate(agentId, {
      pricePerCall: tool.basePrice,
      minTrustScore: tool.minScore,
      tool: toolName,
    });
    trust = {
      agentId,
      allow: og.allow,
      score: og.score,
      tier: og.tier,
      riskLevel: og.riskLevel,
      route: og.route,
      reasons: og.reasons,
      source: "live",
      pending: og.pending,
    };
  } else {
    trust = await evaluateAgent(agentId, { minScore: tool.minScore });
  }
  const price = dynamicPrice(tool.basePrice, trust.tier);

  const base: Omit<Decision, "allow" | "blockedBy"> = {
    id: decisionId(),
    ts: Date.now(),
    agentId,
    tool: toolName,
    score: trust.score,
    tier: trust.tier,
    riskLevel: trust.riskLevel,
    route: trust.route,
    price,
    reasons: trust.reasons,
    source: trust.source,
  };

  if (trust.pending) {
    const decision: Decision = {
      ...base,
      allow: false,
      blockedBy: "pending-eval",
      reasons: ["Agent pending evaluation — retry in 30s"],
    };
    recordDecision(decision);
    return { decision, error: { code: 403, message: "Agent pending evaluation" } };
  }

  if (trust.score < tool.minScore) {
    const decision: Decision = {
      ...base,
      allow: false,
      blockedBy: "tool-policy",
      reasons: [
        `Tool "${toolName}" requires score ≥ ${tool.minScore}; agent has ${trust.score} (${trust.tier})`,
      ],
    };
    recordDecision(decision);
    return {
      decision,
      error: {
        code: 403,
        message: `Insufficient trust: need ${tool.minScore}, have ${trust.score} (${trust.tier})`,
      },
    };
  }

  // Guardrails: police the actual call even for trusted agents (injection,
  // budget, velocity, burst, quarantine). This is what stops a hijacked AAA.
  const guard = checkGuardrails(agentId, toolName, price, trust.riskLevel, args);
  if (!guard.allow) {
    const decision: Decision = {
      ...base,
      allow: false,
      blockedBy: "guardrail",
      reasons: [`Guardrail (${guard.type}): ${guard.message}`],
    };
    recordDecision(decision);
    return {
      decision,
      error: { code: 403, message: `Guardrail blocked: ${guard.message}` },
    };
  }

  const result = await tool.run(args);
  recordSpend(agentId, price);
  const decision: Decision = { ...base, allow: true };
  recordDecision(decision);
  return { decision, result };
}
