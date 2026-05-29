import { getIncident } from "./config";
import { recordDecision } from "./events";
import { checkGuardrails, recordSpend } from "./guardrails";
import { isReadOnlyAllowed } from "./incident";
import { isOperatorEnabled, operatorGate } from "./operator";
import { dynamicPrice } from "./tools";
import { evaluateAgent } from "./trust";
import type { Decision, TrustResult } from "./types";
import { assertSafeUrl, UnsafeUrlError, type Upstream } from "./upstreams";
import { PAYMENT_ASSET, PAYMENT_NETWORK, verifyAndSettle, type X402Requirements } from "./x402";

/**
 * Trust-gated reverse proxy for a real upstream API.
 *
 * This is the productized use case: a seller registers their existing API and
 * TrustMCP fronts it. Every request runs the full pipeline BEFORE the upstream
 * is ever touched:
 *   identity → Valiron trust → guardrails → x402 payment → forward
 *
 * Denials use RFC 9457 (application/problem+json) so the *calling agent* can
 * act on them programmatically (typed code + Retry-After), which is exactly
 * what agent traffic needs instead of human-readable 400s.
 */

const PROBLEM_BASE = "https://trustmcp.dev/problems";

export interface ProxyResponse {
  status: number;
  bodyText: string;
  headers: Record<string, string>;
}

export interface ProxyResult {
  decision: Decision;
  response: ProxyResponse;
}

let counter = 0;
function decisionId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-px${counter}`;
}

function problem(
  status: number,
  type: string,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): ProxyResponse {
  return {
    status,
    bodyText: JSON.stringify({ type: `${PROBLEM_BASE}/${type}`, title, status, detail, ...extra }),
    headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
  };
}

function proxyPaymentRequirements(upstream: Upstream, path: string, price: number): X402Requirements {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: PAYMENT_NETWORK(),
        maxAmountRequired: price.toFixed(3),
        resource: `/api/gateway/${upstream.id}${path}`,
        description: `Trust-priced access to ${upstream.name}`,
        payTo: process.env.X402_PAY_TO ?? "0x000000000000000000000000000000000000d3aD",
        asset: PAYMENT_ASSET,
        maxTimeoutSeconds: 120,
      },
    ],
  };
}

// Headers we never forward upstream (hop-by-hop + our own control headers).
const STRIP_REQ_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding", "upgrade",
  "x-agent-id", "x-agent-address", "x-payment", "content-length",
]);
const STRIP_RES_HEADERS = new Set([
  "transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length",
]);

export interface ProxyCallInput {
  agentId: string | null;
  upstream: Upstream;
  method: string;
  /** Path after the upstream id, beginning with "/". */
  path: string;
  /** Raw query string (without leading "?"), or "". */
  query: string;
  reqHeaders: Headers;
  bodyText: string | null;
  payment: string | null;
}

export async function handleProxyCall(input: ProxyCallInput): Promise<ProxyResult> {
  const { agentId, upstream, method, path, query, reqHeaders, bodyText, payment } = input;
  const label = `${upstream.id} ${method} ${path || "/"}`;

  if (!agentId) {
    const decision: Decision = {
      id: decisionId(), ts: Date.now(), agentId: "anonymous", tool: label,
      kind: "api", upstream: upstream.id,
      allow: false, blockedBy: "trust-gate", score: 0, tier: "C", riskLevel: "RED",
      route: "sandbox_only", price: 0, source: "mock",
      reasons: ["Missing agent identity (x-agent-id header)"],
    };
    recordDecision(decision);
    return {
      decision,
      response: problem(401, "missing-identity", "Missing agent identity",
        "Send an x-agent-id (or x-agent-address) header so TrustMCP can score you."),
    };
  }

  if (getIncident() === "fail_closed") {
    const decision: Decision = {
      id: decisionId(), ts: Date.now(), agentId, tool: label, kind: "api", upstream: upstream.id,
      allow: false, blockedBy: "kill-switch", score: 0, tier: "C", riskLevel: "RED",
      route: "sandbox_only", price: 0, source: "mock",
      reasons: ["Kill switch active — gateway is fail-closed until disabled"],
    };
    recordDecision(decision);
    return {
      decision,
      response: problem(503, "kill-switch", "Gateway fail-closed",
        "Incident kill switch is active. All proxy traffic is denied."),
    };
  }

  // 1. Trust — real Valiron operator gate when configured, else SDK/mock.
  let trust: TrustResult;
  if (isOperatorEnabled()) {
    const og = await operatorGate(agentId, {
      pricePerCall: upstream.pricePerCall, minTrustScore: upstream.minScore, tool: upstream.id,
    });
    trust = {
      agentId, allow: og.allow, score: og.score, tier: og.tier, riskLevel: og.riskLevel,
      route: og.route, reasons: og.reasons, source: "live", pending: og.pending,
    };
  } else {
    trust = await evaluateAgent(agentId, { minScore: upstream.minScore });
  }

  const price = dynamicPrice(upstream.pricePerCall, trust.tier);
  const base: Omit<Decision, "allow" | "blockedBy"> = {
    id: decisionId(), ts: Date.now(), agentId, tool: label, kind: "api",
    upstream: upstream.id, score: trust.score,
    tier: trust.tier, riskLevel: trust.riskLevel, route: trust.route, price,
    reasons: trust.reasons, source: trust.source,
  };

  if (trust.pending) {
    const decision: Decision = { ...base, allow: false, blockedBy: "pending-eval",
      reasons: ["Agent pending evaluation — retry shortly"] };
    recordDecision(decision);
    return {
      decision,
      response: problem(429, "pending-evaluation", "Agent pending evaluation",
        "Your reputation is still being established. Retry after the cooldown.",
        { "retry-after": 30 }),
    };
  }

  if (getIncident() === "read_only" && !isReadOnlyAllowed(trust.riskLevel, upstream.id)) {
    const decision: Decision = {
      ...base, allow: false, blockedBy: "read-only",
      reasons: [`Read-only mode — upstream "${upstream.id}" blocked`],
    };
    recordDecision(decision);
    return {
      decision,
      response: problem(403, "read-only", "Read-only incident mode",
        "Only public GREEN tools/APIs are allowed while read-only mode is active."),
    };
  }

  if (trust.score < upstream.minScore) {
    const decision: Decision = { ...base, allow: false, blockedBy: "tool-policy",
      reasons: [`Requires score ≥ ${upstream.minScore}; agent has ${trust.score} (${trust.tier})`] };
    recordDecision(decision);
    const r = problem(403, "insufficient-trust", "Insufficient trust",
      `This API requires a Valiron score of ${upstream.minScore}. You scored ${trust.score} (${trust.tier}).`,
      { requiredScore: upstream.minScore, yourScore: trust.score, tier: trust.tier });
    return { decision, response: r };
  }

  // 2. Guardrails — police this specific call (injection / budget / velocity / burst).
  const guard = checkGuardrails(agentId, upstream.id, price, trust.riskLevel, {
    method, path, query,
  });
  if (!guard.allow) {
    const decision: Decision = { ...base, allow: false, blockedBy: "guardrail",
      reasons: [`Guardrail (${guard.type}): ${guard.message}`] };
    recordDecision(decision);
    const retry = guard.type === "velocity" ? { "retry-after": 60 } : {};
    return {
      decision,
      response: problem(429, `guardrail-${guard.type}`, "Blocked by guardrail",
        guard.message ?? "Request blocked by behavioral guardrail", retry),
    };
  }

  // 3. x402 — paid APIs require a settled, trust-priced payment.
  let settlement: { amount: number; txHash: string } | undefined;
  if (price > 0) {
    const settled = verifyAndSettle(payment ?? null, price);
    if (!settled.ok) {
      const decision: Decision = { ...base, allow: false, blockedBy: "payment-required",
        reasons: [`402 Payment Required — $${price.toFixed(3)} ${PAYMENT_ASSET} (${settled.reason ?? "payment needed"})`],
        payment: { state: "required", amount: price, network: PAYMENT_NETWORK(), asset: PAYMENT_ASSET } };
      recordDecision(decision);
      return {
        decision,
        response: {
          status: 402,
          bodyText: JSON.stringify(proxyPaymentRequirements(upstream, path, price)),
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        },
      };
    }
    settlement = { amount: settled.amount, txHash: settled.txHash! };
  }

  // 4. Forward to the real upstream API.
  let target: URL;
  try {
    target = assertSafeUrl(upstream.baseUrl + path + (query ? `?${query}` : ""));
  } catch (e) {
    const msg = e instanceof UnsafeUrlError ? e.message : "Bad upstream URL";
    const decision: Decision = { ...base, allow: false, blockedBy: "guardrail",
      reasons: [`SSRF guard: ${msg}`] };
    recordDecision(decision);
    return { decision, response: problem(502, "unsafe-upstream", "Unsafe upstream", msg) };
  }

  const fwdHeaders = new Headers();
  reqHeaders.forEach((v, k) => {
    if (!STRIP_REQ_HEADERS.has(k.toLowerCase())) fwdHeaders.set(k, v);
  });
  fwdHeaders.set("x-forwarded-by", "trustmcp");
  fwdHeaders.set("x-trust-tier", trust.tier);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(target.toString(), {
      method,
      headers: fwdHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : bodyText ?? undefined,
      signal: ac.signal,
      redirect: "manual",
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const decision: Decision = { ...base, allow: false, blockedBy: "guardrail",
      reasons: [aborted ? "Upstream timed out" : "Upstream unreachable"] };
    recordDecision(decision);
    return {
      decision,
      response: problem(504, "upstream-unreachable", aborted ? "Upstream timeout" : "Upstream error",
        aborted ? "The upstream API did not respond in time." : "Could not reach the upstream API."),
    };
  } finally {
    clearTimeout(timer);
  }

  const upstreamBody = await upstreamRes.text();

  // Only count spend once the upstream actually served the request.
  recordSpend(agentId, price);

  const outHeaders: Record<string, string> = {};
  upstreamRes.headers.forEach((v, k) => {
    if (!STRIP_RES_HEADERS.has(k.toLowerCase())) outHeaders[k] = v;
  });
  outHeaders["x-trustmcp-tier"] = trust.tier;
  outHeaders["x-trustmcp-score"] = String(trust.score);

  const decision: Decision = settlement
    ? { ...base, allow: true, payment: { state: "settled", amount: settlement.amount,
        network: PAYMENT_NETWORK(), asset: PAYMENT_ASSET, txHash: settlement.txHash } }
    : { ...base, allow: true };
  if (settlement) {
    outHeaders["x-payment-response"] = Buffer.from(
      JSON.stringify({ success: true, txHash: settlement.txHash, amount: settlement.amount,
        network: PAYMENT_NETWORK(), asset: PAYMENT_ASSET }),
    ).toString("base64");
  }
  recordDecision(decision);

  return {
    decision,
    response: { status: upstreamRes.status, bodyText: upstreamBody, headers: outHeaders },
  };
}
