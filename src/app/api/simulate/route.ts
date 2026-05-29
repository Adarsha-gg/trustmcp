import { NextRequest } from "next/server";
import { DEMO_AGENTS } from "@/lib/agents";
import { handleToolCall } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drives the canned demo agents through the gateway so the dashboard lights up.
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

  const agents = agentId
    ? DEMO_AGENTS.filter((a) => a.id === agentId)
    : DEMO_AGENTS;

  let count = 0;
  for (const agent of agents) {
    for (const call of agent.calls) {
      await handleToolCall(agent.id, call.tool, call.args);
      count += 1;
      // small stagger so the live feed animates nicely
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return Response.json({ ok: true, agents: agents.length, calls: count });
}
