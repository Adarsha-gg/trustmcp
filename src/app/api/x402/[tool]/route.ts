import { NextRequest } from "next/server";
import { handleToolCall } from "@/lib/gateway";
import { settlementReceipt } from "@/lib/x402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Spec-shaped x402 endpoint. Call a paid tool over plain HTTP:
 *   1. POST without payment  -> 402 + { accepts: [...] }
 *   2. Read accepts, attach `x-payment` header, retry
 *   3. 200 + result, with an `x-payment-response` receipt header
 *
 * Trust + guardrails still run first, so untrusted agents are blocked before
 * they ever get a price.
 */
async function run(req: NextRequest, tool: string) {
  const agentId = req.headers.get("x-agent-id") || req.headers.get("x-agent-address");
  const payment = req.headers.get("x-payment");

  let args: Record<string, unknown> = {};
  try {
    args = (await req.json()) as Record<string, unknown>;
  } catch {
    // GET or empty body
  }

  const outcome = await handleToolCall(agentId, tool, args, payment);

  if (outcome.paymentRequired) {
    return Response.json(outcome.paymentRequired, {
      status: 402,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (outcome.error) {
    const code = outcome.error.code >= 400 && outcome.error.code < 600 ? outcome.error.code : 403;
    return Response.json(
      { error: outcome.error.message, decision: outcome.decision },
      { status: code },
    );
  }

  const headers: Record<string, string> = {};
  if (outcome.settlement) {
    headers["x-payment-response"] = settlementReceipt(outcome.settlement);
  }

  return Response.json(
    { result: outcome.result, tier: outcome.decision.tier, payment: outcome.decision.payment ?? null },
    { headers },
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  return run(req, tool);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  return run(req, tool);
}
