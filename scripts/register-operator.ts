/**
 * One-shot Valiron operator setup.
 *
 * Registers (or logs in) an operator account, prints your `val_op_` API key,
 * and registers TrustMCP's paid tool endpoints so usage shows up in the Valiron
 * dashboard (revenue, agents, call logs).
 *
 * Usage:
 *   VALIRON_EMAIL=you@example.com VALIRON_PASSWORD=secret VALIRON_NAME="You" \
 *     npx tsx scripts/register-operator.ts
 *
 * Then put the printed key in .env.local as VALIRON_OPERATOR_KEY and restart.
 */

export {};

const API = process.env.VALIRON_API ?? "https://valiron-edge-proxy.onrender.com";

const email = process.env.VALIRON_EMAIL;
const password = process.env.VALIRON_PASSWORD;
const name = process.env.VALIRON_NAME ?? "TrustMCP Operator";

// Paid endpoints (free plan allows 3) — mirrors src/lib/tools.ts.
const ENDPOINTS = [
  { path: "/api/mcp/get_market_data", method: "POST", pricePerCall: 0.02, description: "Premium market data (gated by TrustMCP)" },
  { path: "/api/mcp/read_customer_records", method: "POST", pricePerCall: 0.05, description: "Customer records (gated by TrustMCP)" },
  { path: "/api/mcp/send_payment", method: "POST", pricePerCall: 0.1, description: "x402 payments (gated by TrustMCP)" },
];

async function api(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  if (!email || !password) {
    console.error("Set VALIRON_EMAIL and VALIRON_PASSWORD env vars first.");
    process.exit(1);
  }

  console.log(`→ Registering operator at ${API} ...`);
  let { status, json } = await api("/operator/register", { email, password, name });

  let key: string | undefined =
    (json.apiKey as string) || (json.key as string) || ((json.operator as Record<string, unknown>)?.apiKey as string);

  if (status >= 400 && !key) {
    console.log(`  register returned ${status} (${JSON.stringify(json)}) — trying login ...`);
    ({ status, json } = await api("/operator/login", { email, password }));
    key = (json.apiKey as string) || (json.key as string) || (json.token as string);
  }

  if (!key) {
    console.error("Could not obtain an API key. Response:", JSON.stringify(json, null, 2));
    console.error("If you already registered, grab your key from https://valiron.co/dashboard");
    process.exit(1);
  }

  console.log("\n✅ Operator key (add to .env.local as VALIRON_OPERATOR_KEY):\n");
  console.log("   " + key + "\n");

  const token = key;
  for (const ep of ENDPOINTS) {
    const r = await api("/operator/endpoints", ep, token);
    console.log(`  endpoint ${ep.path} -> ${r.status}`);
  }

  console.log("\nDone. Set VALIRON_OPERATOR_KEY in .env.local and restart `npm run dev`.");
  console.log("Tool calls will now be gated by the real Valiron operator gate and logged to your dashboard.");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
