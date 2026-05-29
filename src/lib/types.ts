export type MoodysTier =
  | "AAA"
  | "AA"
  | "A"
  | "BAA"
  | "BA"
  | "B"
  | "CAA"
  | "CA"
  | "C";

export type RiskLevel = "GREEN" | "YELLOW" | "RED";

export type RouteDecision =
  | "prod"
  | "prod_throttled"
  | "sandbox"
  | "sandbox_only";

export interface TrustResult {
  agentId: string;
  allow: boolean;
  score: number;
  tier: MoodysTier;
  riskLevel: RiskLevel;
  route: RouteDecision;
  reasons: string[];
  /** "live" = scored by Valiron API, "mock" = local fallback profile. */
  source: "live" | "mock";
  pending?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  /** Higher = more dangerous; drives the minimum trust score required. */
  risk: RiskLevel;
  /** Minimum Valiron score (0-100) required to call this tool. */
  minScore: number;
  /** Base price in USD per call (0 = free). Bad agents pay a multiple. */
  basePrice: number;
  /** JSON schema-ish input description for tools/list. */
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentPassport {
  agentId: string;
  source: "live" | "mock";
  name: string | null;
  wallet: string | null;
  chain: string;
  score: number;
  tier: MoodysTier;
  riskLevel: RiskLevel;
  route: RouteDecision;
  reasons: string[];
  signals: {
    onchain: { present: boolean; feedbackCount: number; averageScore: number };
    sandbox: { present: boolean; tier: MoodysTier | null; graduated: boolean | null };
    worldId: { verified: boolean; level: string | null };
    icebreaker: { present: boolean; handles: string[] };
  };
}

export interface Decision {
  id: string;
  ts: number;
  agentId: string;
  tool: string;
  allow: boolean;
  blockedBy?: "trust-gate" | "tool-policy" | "pending-eval" | "guardrail" | "payment-required";
  payment?: {
    state: "required" | "settled";
    amount: number;
    network: string;
    asset: string;
    txHash?: string;
  };
  score: number;
  tier: MoodysTier;
  riskLevel: RiskLevel;
  route: RouteDecision;
  price: number;
  reasons: string[];
  source: "live" | "mock";
}
