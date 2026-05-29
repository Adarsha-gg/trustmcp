import { NextRequest } from "next/server";
import { handleProxyCall } from "@/lib/proxy";
import { getUpstream } from "@/lib/upstreams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trust-gated reverse proxy. Any registered upstream API is reachable at:
 *   /api/gateway/<upstream-id>/<path...>
 *
 * The full pipeline (identity → Valiron trust → guardrails → x402) runs before
 * the upstream is touched. Sellers get monetization + protection with zero
 * changes to their existing API.
 */
async function run(req: NextRequest, slug: string[]) {
  const [id, ...rest] = slug;
  const upstream = id ? getUpstream(id) : undefined;
  if (!upstream) {
    return Response.json(
      { type: "https://trustmcp.dev/problems/no-such-upstream", title: "Unknown upstream", status: 404,
        detail: `No registered API with id "${id ?? ""}".` },
      { status: 404, headers: { "content-type": "application/problem+json" } },
    );
  }

  const path = rest.length ? "/" + rest.join("/") : "";
  const query = req.nextUrl.search.replace(/^\?/, "");
  const bodyText =
    req.method === "GET" || req.method === "HEAD" ? null : await req.text().catch(() => null);

  const { response } = await handleProxyCall({
    agentId: req.headers.get("x-agent-id") || req.headers.get("x-agent-address"),
    upstream,
    method: req.method,
    path,
    query,
    reqHeaders: req.headers,
    bodyText,
    payment: req.headers.get("x-payment"),
  });

  return new Response(response.bodyText, { status: response.status, headers: response.headers });
}

type Ctx = { params: Promise<{ slug: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) { return run(req, (await ctx.params).slug); }
export async function POST(req: NextRequest, ctx: Ctx) { return run(req, (await ctx.params).slug); }
export async function PUT(req: NextRequest, ctx: Ctx) { return run(req, (await ctx.params).slug); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return run(req, (await ctx.params).slug); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return run(req, (await ctx.params).slug); }
