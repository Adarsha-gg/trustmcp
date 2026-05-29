import type { RiskLevel } from "./types";

/** Whether this tool/upstream call is allowed under read-only incident mode. */
export function isReadOnlyAllowed(risk: RiskLevel, toolLabel: string): boolean {
  if (risk !== "GREEN") return false;
  const allow = new Set(["search_web", "get_market_data"]);
  return allow.has(toolLabel) || toolLabel.includes("weather");
}
