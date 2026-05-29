import { NextRequest } from "next/server";
import { inspectAgent } from "@/lib/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { agentId } -> full Valiron trust passport for that agent. */
export async function POST(req: NextRequest) {
  let agentId: string | undefined;
  try {
    agentId = (await req.json())?.agentId;
  } catch {
    // ignore
  }
  if (!agentId || typeof agentId !== "string") {
    return Response.json({ error: "agentId required" }, { status: 400 });
  }
  const passport = await inspectAgent(agentId.trim());
  return Response.json(passport);
}
