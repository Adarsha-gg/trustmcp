import { ValironOperator } from "@valiron/sdk";
import { getChain } from "./config";
import type { MoodysTier, RiskLevel, RouteDecision } from "./types";

/**
 * Real Valiron Operator integration.
 *
 * `ValironOperator` only ships Express/Fastify middleware (`paywall`), but our
 * gateway lives in Next.js route handlers. This adapter drives the paywall
 * middleware with a minimal Express-shaped req/res shim so that, when a
 * `val_op_` key is configured, every gated tool call is (a) scored by the real
 * Valiron trust gate and (b) logged as billable usage to the operator's Valiron
 * dashboard (revenue, agents, call logs, analytics).
 *
 * With no key set, `isOperatorEnabled()` is false and the gateway transparently
 * falls back to the local trust layer — so the project runs out of the box.
 */

const KEY = process.env.VALIRON_OPERATOR_KEY;

let operator: ValironOperator | null = null;
function getOperator(): ValironOperator | null {
  if (!KEY) return null;
  if (!operator) {
    operator = new ValironOperator({
      apiKey: KEY,
      chain: getChain() as never,
      timeout: 6000,
    });
  }
  return operator;
}

export function isOperatorEnabled(): boolean {
  return !!KEY;
}

export interface OperatorGateResult {
  allow: boolean;
  score: number;
  tier: MoodysTier;
  riskLevel: RiskLevel;
  route: RouteDecision;
  pending: boolean;
  reasons: string[];
}

/** Minimal Express-shaped request shim the paywall middleware understands. */
function makeReq(agentId: string, path: string, method: string) {
  const headers: Record<string, string> = {
    "x-agent-id": agentId,
    "x-chain": getChain(),
  };
  return {
    headers,
    method,
    url: path,
    originalUrl: path,
    path,
    ip: "127.0.0.1",
    valiron: undefined as unknown,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function normalize(result: Record<string, unknown> | undefined, allow: boolean): OperatorGateResult {
  const r = result ?? {};
  const score = Number(r.score ?? 0);
  const pending =
    !allow &&
    typeof r.error === "string" &&
    r.error.toLowerCase().includes("pending");
  return {
    allow,
    score,
    tier: (r.tier as MoodysTier) ?? "C",
    riskLevel: (r.riskLevel as RiskLevel) ?? "RED",
    route: (r.route as RouteDecision) ?? "sandbox_only",
    pending,
    reasons: Array.isArray(r.reasons)
      ? (r.reasons as string[])
      : pending
        ? ["Agent pending evaluation (operator sandbox)"]
        : [allow ? "Allowed by Valiron operator gate" : "Denied by Valiron operator gate"],
  };
}

/**
 * Run a single tool call through the real operator paywall and record usage.
 * Resolves with a normalized gate result. Falls closed on error/timeout.
 */
export function operatorGate(
  agentId: string,
  opts: { pricePerCall: number; minTrustScore: number; tool: string },
): Promise<OperatorGateResult> {
  const op = getOperator();
  if (!op) {
    return Promise.resolve(normalize({ reasons: ["operator disabled"] }, false));
  }

  return new Promise<OperatorGateResult>((resolve) => {
    let settled = false;
    const finish = (res: OperatorGateResult) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };

    const req = makeReq(agentId, `/api/mcp/${opts.tool}`, "POST");

    const res = {
      statusCode: 200,
      headersSent: false,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      json(body: Record<string, unknown>) {
        this.headersSent = true;
        finish(normalize(body, false));
        return this;
      },
      end() {
        finish(normalize(undefined, this.statusCode < 400));
        return this;
      },
    };

    const middleware = op.paywall({
      pricePerCall: opts.pricePerCall,
      minTrustScore: opts.minTrustScore,
      onAllow: (_req, result) => finish(normalize(result, true)),
      onDeny: (_req, _res, result) => finish(normalize(result, false)),
    });

    const next = () => finish(normalize(req.valiron as Record<string, unknown>, true));

    try {
      Promise.resolve(middleware(req, res, next)).catch(() =>
        finish(normalize({ reasons: ["operator gate error"] }, false)),
      );
    } catch {
      finish(normalize({ reasons: ["operator gate threw"] }, false));
    }

    setTimeout(() => finish(normalize({ reasons: ["operator gate timeout"] }, false)), 8000);
  });
}
