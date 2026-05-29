import { NextRequest } from "next/server";
import { getChain, getMode, setChain, setMode, type TrustMode } from "@/lib/config";
import { isOperatorEnabled } from "@/lib/operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ mode: getMode(), chain: getChain(), operator: isOperatorEnabled() });
}

export async function POST(req: NextRequest) {
  let body: { mode?: TrustMode; chain?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (body.mode && ["auto", "live", "mock"].includes(body.mode)) {
    setMode(body.mode);
  }
  if (body.chain) setChain(body.chain);
  return Response.json({ mode: getMode(), chain: getChain() });
}
