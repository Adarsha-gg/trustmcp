import { NextRequest } from "next/server";
import {
  getChain,
  getIncident,
  getMode,
  setChain,
  setIncident,
  setMode,
  type IncidentMode,
  type TrustMode,
} from "@/lib/config";
import { isOperatorEnabled } from "@/lib/operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    mode: getMode(),
    chain: getChain(),
    operator: isOperatorEnabled(),
    incident: getIncident(),
  });
}

export async function POST(req: NextRequest) {
  let body: { mode?: TrustMode; chain?: string; incident?: IncidentMode } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (body.mode && ["auto", "live", "mock"].includes(body.mode)) {
    setMode(body.mode);
  }
  if (body.chain) setChain(body.chain);
  if (body.incident && ["normal", "fail_closed", "read_only"].includes(body.incident)) {
    setIncident(body.incident);
  }
  return Response.json({
    mode: getMode(),
    chain: getChain(),
    operator: isOperatorEnabled(),
    incident: getIncident(),
  });
}
