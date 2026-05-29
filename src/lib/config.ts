/**
 * Runtime config singleton (survives HMR). Lets the dashboard flip the trust
 * mode live on stage without restarting — "auto" tries the real Valiron API and
 * falls back to local profiles, "live" is strict real-only, "mock" never hits
 * the network.
 */
export type TrustMode = "auto" | "live" | "mock";

export type IncidentMode = "normal" | "fail_closed" | "read_only";

interface RuntimeConfig {
  mode: TrustMode;
  chain: string;
  /** Fail-closed: deny every call immediately (incident response). */
  incident: IncidentMode;
}

const g = globalThis as unknown as { __trustmcpConfig?: RuntimeConfig };

function cfg(): RuntimeConfig {
  if (!g.__trustmcpConfig) {
    g.__trustmcpConfig = {
      mode: (process.env.VALIRON_MODE as TrustMode) ?? "auto",
      chain: process.env.VALIRON_CHAIN ?? "ethereum",
      incident: "normal",
    };
  }
  return g.__trustmcpConfig;
}

export function getMode(): TrustMode {
  return cfg().mode;
}

export function setMode(mode: TrustMode): void {
  cfg().mode = mode;
}

export function getChain(): string {
  return cfg().chain;
}

export function setChain(chain: string): void {
  cfg().chain = chain;
}

export function getIncident(): IncidentMode {
  return cfg().incident;
}

export function setIncident(incident: IncidentMode): void {
  cfg().incident = incident;
}
