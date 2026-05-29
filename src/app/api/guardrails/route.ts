import { guardrailsSnapshot, resetGuardrails } from "@/lib/guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(guardrailsSnapshot());
}

export async function POST() {
  resetGuardrails();
  return Response.json({ ok: true });
}
