/**
 * Runtime config singleton (survives HMR). Lets the dashboard flip the trust
 * mode live on stage without restarting — "auto" tries the real Valiron API and
 * falls back to local profiles, "live" is strict real-only, "mock" never hits
 * the network.
 */
export type TrustMode = "auto" | "live" | "mock";

interface RuntimeConfig {
  mode: TrustMode;
  chain: string;
}

const g = globalThis as unknown as { __trustmcpConfig?: RuntimeConfig };

function cfg(): RuntimeConfig {
  if (!g.__trustmcpConfig) {
    g.__trustmcpConfig = {
      mode: (process.env.VALIRON_MODE as TrustMode) ?? "auto",
      chain: process.env.VALIRON_CHAIN ?? "ethereum",
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
