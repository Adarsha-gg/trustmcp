import { NextRequest } from "next/server";
import { DEMO_AGENTS } from "@/lib/agents";
import { handleToolCall } from "@/lib/gateway";
import { TOOLS_BY_NAME } from "@/lib/tools";
import { encodePayment } from "@/lib/x402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drives the canned demo agents through the gateway so the dashboard lights up.
 * Agents with funds attach an x-payment authorization for paid tools (so the
 * x402 handshake settles in one shot). The "broke-agent" deliberately doesn't,
 * to show the 402 challenge.
 * POST { agentId?: string } — run one agent, or all of them if omitted.
 */
export async function POST(req: NextRequest) {
  let agentId: string | undefined;
  try {
    const body = await req.json();
    agentId = body?.agentId;
  } catch {
    // no body -> run all
  }

  const agents = agentId ? DEMO_AGENTS.filter((a) => a.id === agentId) : DEMO_AGENTS;

  let count = 0;
  for (const agent of agents) {
    const hasFunds = agent.id !== "broke-agent";
    for (const call of agent.calls) {
      const tool = TOOLS_BY_NAME.get(call.tool);
      const isPaid = !!tool && tool.basePrice > 0;
      // Authorize up to $1.00 for paid tools; gateway settles the exact price.
      const payment = isPaid && hasFunds ? encodePayment(1.0, agent.id) : null;
      await handleToolCall(agent.id, call.tool, call.args, payment);
      count += 1;
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return Response.json({ ok: true, agents: agents.length, calls: count });
}
