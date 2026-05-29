/**
 * Minimal MCP client to demo the gateway from a terminal.
 *
 * Usage:
 *   npx tsx scripts/agent.ts <agentId> <toolName> '<jsonArgs>'
 *
 * Examples:
 *   npx tsx scripts/agent.ts aaa-trusted-agent send_payment '{"to":"0xabc","amountUsd":25}'
 *   npx tsx scripts/agent.ts low-trust-scraper delete_records '{"table":"users"}'
 */

const BASE = process.env.TRUSTMCP_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE}/api/mcp`;

async function rpc(method: string, params: unknown, agentId?: string) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(agentId ? { "x-agent-id": agentId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

async function main() {
  const [agentId, tool, argsRaw] = process.argv.slice(2);

  if (!agentId) {
    const list = await rpc("tools/list", {});
    console.log("Available tools:\n", JSON.stringify(list.result?.tools, null, 2));
    console.log("\nUsage: npx tsx scripts/agent.ts <agentId> <tool> '<jsonArgs>'");
    return;
  }

  const args = argsRaw ? JSON.parse(argsRaw) : {};
  console.log(`\n→ agent "${agentId}" calling "${tool}"...`);
  const out = await rpc("tools/call", { name: tool, arguments: args }, agentId);
  const text = out.result?.content?.[0]?.text ?? JSON.stringify(out);
  console.log(text);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
