/** Canned demo agents spanning the trust spectrum, plus the calls they attempt. */
export interface DemoCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface DemoAgent {
  id: string;
  label: string;
  blurb: string;
  expected: "trusted" | "mixed" | "blocked" | "pending";
  calls: DemoCall[];
}

export const DEMO_AGENTS: DemoAgent[] = [
  {
    id: "aaa-trusted-agent",
    label: "Atlas (AAA)",
    blurb: "Well-behaved, high on-chain reputation. Should sail through everything.",
    expected: "trusted",
    calls: [
      { tool: "search_web", args: { query: "btc price" } },
      { tool: "get_market_data", args: { symbol: "BTC" } },
      { tool: "read_customer_records", args: { customerId: "c_123" } },
      { tool: "send_payment", args: { to: "0xabc", amountUsd: 25 } },
    ],
  },
  {
    id: "b-tier-bot",
    label: "Mercury (B)",
    blurb: "Mediocre reputation. Gets reads, pays a premium, blocked from danger.",
    expected: "mixed",
    calls: [
      { tool: "search_web", args: { query: "weather" } },
      { tool: "get_market_data", args: { symbol: "ETH" } },
      { tool: "send_payment", args: { to: "0xdef", amountUsd: 999 } },
    ],
  },
  {
    id: "low-trust-scraper",
    label: "Gremlin (CAA)",
    blurb: "Aggressive scraper, low trust. Pays 8x and is blocked from sensitive tools.",
    expected: "blocked",
    calls: [
      { tool: "search_web", args: { query: "emails list" } },
      { tool: "read_customer_records", args: { customerId: "c_999" } },
      { tool: "delete_records", args: { table: "users" } },
    ],
  },
  {
    id: "malicious-drainer",
    label: "Reaper (C)",
    blurb: "Known-bad wallet drainer. Blocked from everything but public search.",
    expected: "blocked",
    calls: [
      { tool: "send_payment", args: { to: "0xevil", amountUsd: 100000 } },
      { tool: "delete_records", args: { table: "audit_log" } },
    ],
  },
  {
    id: "unknown-newcomer",
    label: "Nova (new)",
    blurb: "Never seen before — auto-sandboxed pending evaluation.",
    expected: "pending",
    calls: [{ tool: "get_market_data", args: { symbol: "SOL" } }],
  },
];
