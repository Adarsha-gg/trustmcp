import type { Decision } from "./types";

/**
 * In-memory decision log + pub/sub for the live dashboard. Uses a globalThis
 * singleton so it survives Next.js HMR / route-handler module reloads in dev.
 */
type Listener = (d: Decision) => void;

interface Bus {
  decisions: Decision[];
  listeners: Set<Listener>;
}

const g = globalThis as unknown as { __trustmcpBus?: Bus };

function bus(): Bus {
  if (!g.__trustmcpBus) {
    g.__trustmcpBus = { decisions: [], listeners: new Set() };
  }
  return g.__trustmcpBus;
}

const MAX = 200;

export function recordDecision(d: Decision): void {
  const b = bus();
  b.decisions.unshift(d);
  if (b.decisions.length > MAX) b.decisions.length = MAX;
  for (const l of b.listeners) {
    try {
      l(d);
    } catch {
      // ignore listener errors
    }
  }
}

export function recentDecisions(limit = 100): Decision[] {
  return bus().decisions.slice(0, limit);
}

export function subscribe(l: Listener): () => void {
  const b = bus();
  b.listeners.add(l);
  return () => b.listeners.delete(l);
}
