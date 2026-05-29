import { NextRequest } from "next/server";
import { handleToolCall } from "@/lib/gateway";
import { TOOLS } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP-compatible Streamable HTTP endpoint (JSON-RPC 2.0).
 *
 * Implements `initialize`, `tools/list`, and `tools/call`. Every `tools/call`
 * is run through the Valiron trust gate before the downstream tool executes,
 * so a real MCP client can point at this URL and inherit trust gating for free.
 *
 * Agent identity is read from the `x-agent-id` header (ERC-8004 id) or
 * `x-agent-address` (key-based wallet), falling back to params._meta.agentId.
 */

interface JsonRpcReq {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function ok(id: JsonRpcReq["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function err(id: JsonRpcReq["id"], code: number, message: string, data?: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, data } });
}

function agentFromRequest(req: NextRequest, params?: Record<string, unknown>): string | null {
  const header = req.headers.get("x-agent-id") || req.headers.get("x-agent-address");
  if (header) return header;
  const meta = params?._meta as Record<string, unknown> | undefined;
  if (meta && typeof meta.agentId === "string") return meta.agentId;
  return null;
}

export async function POST(req: NextRequest) {
  let body: JsonRpcReq;
  try {
    body = (await req.json()) as JsonRpcReq;
  } catch {
    return err(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "trustmcp-gateway", version: "0.1.0" },
        instructions:
          "Trust-gated MCP gateway. Tool calls are scored by Valiron; low-trust agents are throttled or blocked.",
      });

    case "notifications/initialized":
      return new Response(null, { status: 202 });

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: `${t.description} [trust≥${t.minScore}, risk=${t.risk}${
            t.basePrice ? `, $${t.basePrice}/call` : ""
          }]`,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const agentId = agentFromRequest(req, params);
      const name = params?.name as string | undefined;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      if (!name) return err(id, -32602, "Missing tool name");

      const outcome = await handleToolCall(agentId, name, args);

      if (outcome.error) {
        // Surface as a tool result with isError so MCP clients see the denial.
        return ok(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { denied: true, ...outcome.error, decision: outcome.decision },
                null,
                2,
              ),
            },
          ],
        });
      }

      return ok(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                allowed: true,
                tier: outcome.decision.tier,
                price: outcome.decision.price,
                result: outcome.result,
              },
              null,
              2,
            ),
          },
        ],
      });
    }

    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export async function GET() {
  return Response.json({
    name: "trustmcp-gateway",
    transport: "streamable-http (json-rpc)",
    endpoint: "/api/mcp",
    methods: ["initialize", "tools/list", "tools/call"],
  });
}
