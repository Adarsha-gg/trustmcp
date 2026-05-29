import { TOOLS } from "@/lib/tools";
import { handleToolCall } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Red-team mode: unleash a wave of mostly-malicious agents hammering the most
 * dangerous tools, plus a couple of trusted agents, so the dashboard shows the
 * gateway holding the line under attack.
 */
const DANGEROUS = ["send_payment", "delete_records", "read_customer_records"];
const TRUSTED = ["aaa-trusted-agent", "a-tier-research-bot"];

export async function POST() {
  const wave: { agentId: string; tool: string; args: Record<string, unknown> }[] = [];

  // 16 hostile agents going for the crown jewels
  for (let i = 0; i < 16; i++) {
    const agentId = `attacker-${Math.random().toString(36).slice(2, 8)}`;
    const tool = DANGEROUS[i % DANGEROUS.length];
    wave.push({
      agentId,
      tool,
      args:
        tool === "send_payment"
          ? { to: "0xdrain", amountUsd: 50000 }
          : tool === "delete_records"
            ? { table: "users" }
            : { customerId: `c_${i}` },
    });
  }

  // a few legit agents mixed in to prove good actors still get through
  for (const agentId of TRUSTED) {
    wave.push({ agentId, tool: "get_market_data", args: { symbol: "BTC" } });
  }

  // shuffle for realism
  wave.sort(() => Math.random() - 0.5);

  let allowed = 0;
  let blocked = 0;
  for (const call of wave) {
    const outcome = await handleToolCall(call.agentId, call.tool, call.args);
    if (outcome.decision.allow) allowed++;
    else blocked++;
    await new Promise((r) => setTimeout(r, 70));
  }

  return Response.json({
    ok: true,
    total: wave.length,
    allowed,
    blocked,
    tools: TOOLS.length,
  });
}
