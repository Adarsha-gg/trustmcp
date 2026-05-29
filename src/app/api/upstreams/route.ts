import { addUpstream, listUpstreams, removeUpstream, UnsafeUrlError } from "@/lib/upstreams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List registered upstream APIs (the sellers' protected endpoints). */
export async function GET() {
  return Response.json({ upstreams: listUpstreams() });
}

/** Register a real API by URL — it becomes trust-gated + x402-monetized. */
export async function POST(req: Request) {
  let body: { name?: string; baseUrl?: string; pricePerCall?: number; minScore?: number; description?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || !body.baseUrl) {
    return Response.json({ error: "name and baseUrl are required" }, { status: 400 });
  }
  try {
    const upstream = addUpstream({
      name: body.name,
      baseUrl: body.baseUrl,
      pricePerCall: body.pricePerCall,
      minScore: body.minScore,
      description: body.description,
    });
    return Response.json({ upstream }, { status: 201 });
  } catch (e) {
    const msg = e instanceof UnsafeUrlError ? e.message : "Could not register upstream";
    return Response.json({ error: msg }, { status: 400 });
  }
}

/** Remove a (non-builtin) upstream. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const ok = removeUpstream(id);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
