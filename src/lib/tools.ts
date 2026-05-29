import type { ToolDef } from "./types";

/**
 * The downstream tool catalog exposed by the gateway. Each tool declares the
 * minimum trust score required to call it and a base price. Low-risk read tools
 * are open to most agents; dangerous, state-changing tools demand high trust.
 *
 * In a real deployment these `run` functions would proxy to actual MCP tool
 * servers; here they return representative mock payloads so the demo is
 * self-contained.
 */
export const TOOLS: ToolDef[] = [
  {
    name: "search_web",
    description: "Search the public web. Low risk, open to most agents.",
    risk: "GREEN",
    minScore: 20,
    basePrice: 0,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    run: async (args) => ({
      query: args.query,
      results: [
        { title: "Result A", url: "https://example.com/a" },
        { title: "Result B", url: "https://example.com/b" },
      ],
    }),
  },
  {
    name: "get_market_data",
    description: "Premium financial market data. Paid per call (dynamic price).",
    risk: "YELLOW",
    minScore: 50,
    basePrice: 0.02,
    inputSchema: {
      type: "object",
      properties: { symbol: { type: "string" } },
      required: ["symbol"],
    },
    run: async (args) => ({
      symbol: args.symbol,
      price: 187.42,
      change: "+1.3%",
      ts: Date.now(),
    }),
  },
  {
    name: "read_customer_records",
    description: "Read PII-bearing customer records. Requires solid trust.",
    risk: "YELLOW",
    minScore: 70,
    basePrice: 0.05,
    inputSchema: {
      type: "object",
      properties: { customerId: { type: "string" } },
      required: ["customerId"],
    },
    run: async (args) => ({
      customerId: args.customerId,
      name: "Jane Doe",
      email: "j***@example.com",
      plan: "enterprise",
    }),
  },
  {
    name: "send_payment",
    description: "Move funds via x402. Dangerous — high trust only.",
    risk: "RED",
    minScore: 85,
    basePrice: 0.1,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        amountUsd: { type: "number" },
      },
      required: ["to", "amountUsd"],
    },
    run: async (args) => ({
      ok: true,
      txHash: "0x" + Math.random().toString(16).slice(2).padEnd(40, "0"),
      to: args.to,
      amountUsd: args.amountUsd,
    }),
  },
  {
    name: "delete_records",
    description: "Permanently delete records. Maximum trust required.",
    risk: "RED",
    minScore: 90,
    basePrice: 0,
    inputSchema: {
      type: "object",
      properties: { table: { type: "string" } },
      required: ["table"],
    },
    run: async (args) => ({ ok: true, deletedFrom: args.table, count: 0 }),
  },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Bad agents pay more — risk-adjusted pricing keyed off Moody's tier. */
const TIER_MULTIPLIER: Record<string, number> = {
  AAA: 1,
  AA: 1,
  A: 1.2,
  BAA: 1.6,
  BA: 2.5,
  B: 4,
  CAA: 8,
  CA: 8,
  C: 8,
};

export function dynamicPrice(basePrice: number, tier: string): number {
  if (basePrice === 0) return 0;
  const mult = TIER_MULTIPLIER[tier] ?? 4;
  return Math.round(basePrice * mult * 1000) / 1000;
}
