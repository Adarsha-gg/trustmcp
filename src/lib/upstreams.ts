/**
 * Upstream registry — the "Bring Your Own API" layer.
 *
 * A TrustMCP customer is an API/data/compute seller in the agent economy. Their
 * real pain (per market research): AI agents are >50% of traffic, they can't
 * tell a paying agent from an abusive scraper, and bot load spikes their costs.
 * Everyone ships x402 *payments*, but payment ≠ trust.
 *
 * This registry lets a seller register an existing HTTP API by URL. TrustMCP
 * then fronts it as a reverse proxy that (1) scores every caller with Valiron,
 * (2) polices it with guardrails, (3) charges trust-adjusted x402 — with zero
 * changes to their code. State is a globalThis singleton so it survives HMR.
 */

export interface Upstream {
  /** URL slug used in the gateway path: /api/gateway/<id>/... */
  id: string;
  name: string;
  /** Upstream origin (+ optional base path), e.g. https://api.open-meteo.com */
  baseUrl: string;
  /** Base price per call in USD (0 = free). Trust-adjusted at request time. */
  pricePerCall: number;
  /** Minimum Valiron score (0-100) required to reach this API. */
  minScore: number;
  description: string;
  /** Seeded, undeletable demo upstreams. */
  builtin?: boolean;
  createdAt: number;
}

interface UpstreamStore {
  map: Map<string, Upstream>;
}

const g = globalThis as unknown as { __trustmcpUpstreams?: UpstreamStore };

const SEED: Upstream[] = [
  {
    id: "weather",
    name: "Weather API (Open-Meteo)",
    baseUrl: "https://api.open-meteo.com",
    pricePerCall: 0.01,
    minScore: 50,
    description:
      "Live global weather forecasts — a real upstream API (no key) fronted by TrustMCP. Try /v1/forecast.",
    builtin: true,
    createdAt: 0,
  },
];

function store(): UpstreamStore {
  if (!g.__trustmcpUpstreams) {
    g.__trustmcpUpstreams = { map: new Map(SEED.map((u) => [u.id, u])) };
  }
  return g.__trustmcpUpstreams;
}

export function listUpstreams(): Upstream[] {
  return [...store().map.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function getUpstream(id: string): Upstream | undefined {
  return store().map.get(id);
}

const PRIVATE_HOST = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local incl. cloud metadata 169.254.169.254
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "metadata.google.internal" || h === "0.0.0.0") return true;
  return PRIVATE_HOST.some((re) => re.test(h));
}

export class UnsafeUrlError extends Error {}

/**
 * SSRF guard. Rejects anything that isn't a public https origin, so a seller
 * can't (accidentally or maliciously) point the proxy at internal services or
 * cloud metadata endpoints. Mirrors Valiron's proxy hardening.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Upstream must be HTTPS");
  }
  if (isPrivateHost(url.hostname)) {
    throw new UnsafeUrlError("Refusing to proxy to a private / internal host");
  }
  return url;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export interface AddUpstreamInput {
  name: string;
  baseUrl: string;
  pricePerCall?: number;
  minScore?: number;
  description?: string;
}

export function addUpstream(input: AddUpstreamInput): Upstream {
  const url = assertSafeUrl(input.baseUrl);
  const base = slugify(input.name) || slugify(url.hostname) || "api";
  let id = base;
  let n = 2;
  while (store().map.has(id)) id = `${base}-${n++}`;

  const up: Upstream = {
    id,
    name: input.name.trim() || url.hostname,
    // Normalize: keep origin + path, strip trailing slash + query.
    baseUrl: (url.origin + url.pathname).replace(/\/$/, ""),
    pricePerCall: clampNum(input.pricePerCall, 0, 0, 100),
    minScore: Math.round(clampNum(input.minScore, 50, 0, 100)),
    description: (input.description ?? "").slice(0, 280),
    createdAt: Date.now(),
  };
  store().map.set(id, up);
  return up;
}

export function removeUpstream(id: string): boolean {
  const u = store().map.get(id);
  if (!u || u.builtin) return false;
  return store().map.delete(id);
}

function clampNum(v: unknown, dflt: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
