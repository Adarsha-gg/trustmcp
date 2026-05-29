import { DEMO_AGENTS } from "@/lib/agents";
import { TOOLS } from "@/lib/tools";

export const runtime = "nodejs";

/** Static catalog for the dashboard: tools (no executors) + demo agents. */
export async function GET() {
  return Response.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      risk: t.risk,
      minScore: t.minScore,
      basePrice: t.basePrice,
    })),
    agents: DEMO_AGENTS.map((a) => ({
      id: a.id,
      label: a.label,
      blurb: a.blurb,
      expected: a.expected,
    })),
  });
}
