/** Block reason labels + pipeline step names (matches design prototype). */

export const BLOCK_LABELS: Record<string, { label: string; step: string }> = {
  "trust-gate": { label: "TRUST GATE", step: "Valiron Trust" },
  "tool-policy": { label: "TOOL POLICY", step: "Policy" },
  "guardrail": { label: "GUARDRAIL", step: "Guardrails" },
  "payment-required": { label: "402 UNPAID", step: "x402 Payment" },
  "pending-eval": { label: "SANDBOX", step: "Identity" },
  "kill-switch": { label: "KILL SWITCH", step: "Identity" },
  "read-only": { label: "READ ONLY", step: "Valiron Trust" },
};
