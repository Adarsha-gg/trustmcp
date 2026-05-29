"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AgentPassport } from "@/lib/types";

export type Decision = {
  id: string;
  ts: number;
  agentId: string;
  tool: string;
  kind?: "tool" | "api";
  upstream?: string;
  allow: boolean;
  blockedBy?: string;
  score: number;
  tier: string;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  route: string;
  price: number;
  reasons: string[];
  source: "live" | "mock";
  payment?: { state: "required" | "settled"; amount: number; network: string; asset: string; txHash?: string };
};

export type { AgentPassport };

export type Upstream = {
  id: string;
  name: string;
  baseUrl: string;
  pricePerCall: number;
  minScore: number;
  description: string;
  builtin?: boolean;
};

export type Tool = { name: string; description: string; risk: "GREEN" | "YELLOW" | "RED"; minScore: number; basePrice: number };
export type Agent = { id: string; label: string; blurb: string; expected: string };
export type Mode = "auto" | "live" | "mock";
export type IncidentMode = "normal" | "fail_closed" | "read_only";

export type GuardrailsSnapshot = {
  policy: { budgetUsd: number; velocityUsd: number; velocityWindowMs: number; burstMax: number; burstWindowMs: number; quarantineMs: number };
  agents: { agentId: string; spend: number; budgetPct: number; violations: number; quarantined: boolean }[];
  alerts: { id: string; ts: number; agentId: string; tool: string; type: string; message: string }[];
};

type Stats = { calls: number; allowed: number; blocked: number; paid: number; revenue: number };

export type GateResponse = {
  decision: Decision;
  paymentRequired?: boolean | Record<string, unknown>;
  settlement?: { amount: number; txHash: string } | null;
  http?: { status: number; bodyPreview: string };
  result?: unknown;
};

export type NewUpstream = { name: string; baseUrl: string; pricePerCall: number; minScore: number };

export interface GatewayStore {
  decisions: Decision[];
  stats: Stats;
  upstreams: Upstream[];
  tools: Tool[];
  agents: Agent[];
  mode: Mode;
  chain: string;
  operator: boolean;
  incident: IncidentMode;
  connected: boolean;
  streaming: boolean;
  guardrails: GuardrailsSnapshot | null;
  attackBusy: boolean;
  lastAttack: { total: number; allowed: number; blocked: number } | null;
  setStreaming: (b: boolean) => void;
  setMode: (m: Mode) => void;
  setIncident: (m: IncidentMode) => void;
  gate: (agentId: string, kind: "tool" | "api", target: string) => Promise<GateResponse | null>;
  inspect: (agentId: string) => Promise<AgentPassport | null>;
  refreshGuardrails: () => Promise<void>;
  resetGuardrails: () => Promise<void>;
  addUpstream: (input: NewUpstream) => Promise<{ ok: boolean; error?: string }>;
  removeUpstream: (id: string) => Promise<void>;
  runSampleTraffic: () => Promise<void>;
  runAttackWave: () => Promise<void>;
}

const MAX_FEED = 60;
const Ctx = createContext<GatewayStore | null>(null);
export const useGateway = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGateway must be used within GatewayProvider");
  return c;
};

function statsFrom(list: Decision[]): Stats {
  return list.reduce<Stats>(
    (s, d) => ({
      calls: s.calls + 1,
      allowed: s.allowed + (d.allow ? 1 : 0),
      blocked: s.blocked + (d.allow ? 0 : 1),
      paid: s.paid + (d.payment?.state === "settled" ? 1 : 0),
      revenue: s.revenue + (d.payment?.state === "settled" ? d.payment.amount : 0),
    }),
    { calls: 0, allowed: 0, blocked: 0, paid: 0, revenue: 0 },
  );
}

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats>({ calls: 0, allowed: 0, blocked: 0, paid: 0, revenue: 0 });
  const [upstreams, setUpstreams] = useState<Upstream[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mode, setModeState] = useState<Mode>("auto");
  const [chain, setChain] = useState("ethereum");
  const [operator, setOperator] = useState(false);
  const [incident, setIncidentState] = useState<IncidentMode>("normal");
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [guardrails, setGuardrails] = useState<GuardrailsSnapshot | null>(null);
  const [attackBusy, setAttackBusy] = useState(false);
  const [lastAttack, setLastAttack] = useState<{ total: number; allowed: number; blocked: number } | null>(null);

  const bump = useCallback((d: Decision) => {
    setStats((s) => ({
      calls: s.calls + 1,
      allowed: s.allowed + (d.allow ? 1 : 0),
      blocked: s.blocked + (d.allow ? 0 : 1),
      paid: s.paid + (d.payment?.state === "settled" ? 1 : 0),
      revenue: s.revenue + (d.payment?.state === "settled" ? d.payment.amount : 0),
    }));
  }, []);

  const loadConfig = useCallback(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.mode) setModeState(d.mode);
        if (d.chain) setChain(d.chain);
        if (d.incident) setIncidentState(d.incident);
        setOperator(!!d.operator);
      })
      .catch(() => {});
  }, []);

  const refreshGuardrails = useCallback(async () => {
    try {
      const r = await fetch("/api/guardrails");
      if (r.ok) setGuardrails(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("snapshot", (e) => {
      const list = JSON.parse((e as MessageEvent).data) as Decision[];
      setDecisions(list);
      setStats(statsFrom(list));
    });
    es.addEventListener("decision", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions((prev) => [d, ...prev].slice(0, MAX_FEED));
      bump(d);
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [bump]);

  const loadUpstreams = useCallback(() => {
    fetch("/api/upstreams").then((r) => r.json()).then((d) => setUpstreams(d.upstreams ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadConfig();
    fetch("/api/catalog").then((r) => r.json()).then((d) => { setTools(d.tools ?? []); setAgents(d.agents ?? []); }).catch(() => {});
    loadUpstreams();
    refreshGuardrails();
  }, [loadConfig, loadUpstreams, refreshGuardrails]);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    await fetch("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }),
    }).catch(() => {});
  }, []);

  const setIncident = useCallback(async (m: IncidentMode) => {
    setIncidentState(m);
    await fetch("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incident: m }),
    }).catch(() => {});
  }, []);

  const gate = useCallback(async (agentId: string, kind: "tool" | "api", target: string): Promise<GateResponse | null> => {
    try {
      const res = await fetch("/api/gate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, kind, target }),
      });
      if (!res.ok) return null;
      return (await res.json()) as GateResponse;
    } catch {
      return null;
    }
  }, []);

  const inspect = useCallback(async (agentId: string): Promise<AgentPassport | null> => {
    try {
      const res = await fetch("/api/inspect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }),
      });
      if (!res.ok) return null;
      return (await res.json()) as AgentPassport;
    } catch {
      return null;
    }
  }, []);

  const resetGuardrails = useCallback(async () => {
    await fetch("/api/guardrails", { method: "POST" }).catch(() => {});
    await refreshGuardrails();
  }, [refreshGuardrails]);

  const addUpstream = useCallback(async (input: NewUpstream) => {
    const res = await fetch("/api/upstreams", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error ?? "Failed to register" };
    loadUpstreams();
    return { ok: true };
  }, [loadUpstreams]);

  const removeUpstream = useCallback(async (id: string) => {
    await fetch(`/api/upstreams?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    loadUpstreams();
  }, [loadUpstreams]);

  const runSampleTraffic = useCallback(async () => {
    await fetch("/api/guardrails", { method: "POST" }).catch(() => {});
    await fetch("/api/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).catch(() => {});
    await refreshGuardrails();
  }, [refreshGuardrails]);

  const runAttackWave = useCallback(async () => {
    setAttackBusy(true);
    try {
      const res = await fetch("/api/attack", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d.total === "number") {
        setLastAttack({ total: d.total, allowed: d.allowed, blocked: d.blocked });
      }
      await refreshGuardrails();
    } finally {
      setAttackBusy(false);
    }
  }, [refreshGuardrails]);

  const agentsRef = useRef(agents);
  const toolsRef = useRef(tools);
  const upstreamsRef = useRef(upstreams);
  const incidentRef = useRef(incident);
  agentsRef.current = agents;
  toolsRef.current = tools;
  upstreamsRef.current = upstreams;
  incidentRef.current = incident;

  useEffect(() => {
    if (!streaming || incidentRef.current !== "normal") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      const ags = agentsRef.current;
      const tls = toolsRef.current;
      const ups = upstreamsRef.current;
      if (ags.length && (tls.length || ups.length)) {
        const agent = ags[(Math.random() * ags.length) | 0];
        const useApi = ups.length > 0 && Math.random() < 0.3;
        if (useApi) {
          const u = ups[(Math.random() * ups.length) | 0];
          await gate(agent.id, "api", u.id);
        } else if (tls.length) {
          const t = tls[(Math.random() * tls.length) | 0];
          await gate(agent.id, "tool", t.name);
        }
      }
      if (alive) timer = setTimeout(tick, 1800 + Math.random() * 1600);
    };
    timer = setTimeout(tick, 1400);
    return () => { alive = false; clearTimeout(timer); };
  }, [streaming, gate, incident]);

  const store: GatewayStore = {
    decisions, stats, upstreams, tools, agents, mode, chain, operator, incident,
    connected, streaming, guardrails, attackBusy, lastAttack,
    setStreaming, setMode, setIncident, gate, inspect, refreshGuardrails, resetGuardrails,
    addUpstream, removeUpstream, runSampleTraffic, runAttackWave,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
