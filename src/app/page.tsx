"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Decision = {
  id: string;
  ts: number;
  agentId: string;
  tool: string;
  allow: boolean;
  blockedBy?: string;
  score: number;
  tier: string;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  route: string;
  price: number;
  reasons: string[];
  source: "live" | "mock";
};

type Tool = { name: string; description: string; risk: "GREEN" | "YELLOW" | "RED"; minScore: number; basePrice: number };
type Agent = { id: string; label: string; blurb: string; expected: string };
type Mode = "auto" | "live" | "mock";
type GuardSnap = {
  policy: { budgetUsd: number; velocityUsd: number; burstMax: number };
  agents: { agentId: string; spend: number; budgetPct: number; violations: number; quarantined: boolean }[];
  alerts: { id: string; ts: number; agentId: string; tool: string; type: string; message: string }[];
};

const tierColor = (t: string) =>
  ["AAA", "AA", "A"].includes(t)
    ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
    : ["BAA", "BA"].includes(t)
      ? "text-yellow-300 border-yellow-300/40 bg-yellow-300/10"
      : ["B"].includes(t)
        ? "text-orange-300 border-orange-300/40 bg-orange-300/10"
        : "text-rose-400 border-rose-400/40 bg-rose-400/10";

const riskDot = (r: string) => (r === "GREEN" ? "bg-emerald-400" : r === "YELLOW" ? "bg-yellow-300" : "bg-rose-500");

const violColor: Record<string, string> = {
  injection: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  budget: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  velocity: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  burst: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  quarantine: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10",
};

const DEMO_STEPS: { agentId: string; caption: string; focus: "pipeline" | "guardrails"; ms: number }[] = [
  { agentId: "aaa-trusted-agent", caption: "Atlas — a AAA on-chain reputation. The trust gate passes it instantly. Full access, lowest price.", focus: "pipeline", ms: 3200 },
  { agentId: "low-trust-scraper", caption: "Gremlin — low trust. Reads cost 8× and sensitive tools are blocked right at the gate.", focus: "pipeline", ms: 3200 },
  { agentId: "unknown-newcomer", caption: "Nova — never seen before. Auto-sandboxed and held pending evaluation. Never allowed through blind.", focus: "pipeline", ms: 2600 },
  { agentId: "hijacked-agent", caption: "Atlas again — but prompt-injected. Trust says TRUSTED… then Guardrails catch the malicious payload and quarantine it. This is the part identity alone can't solve.", focus: "guardrails", ms: 5200 },
];

export default function App() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [guard, setGuard] = useState<GuardSnap | null>(null);
  const [mode, setModeState] = useState<Mode>("auto");
  const [operator, setOperator] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [demoCaption, setDemoCaption] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  const pipelineRef = useRef<HTMLDivElement>(null);
  const guardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => { setTools(d.tools); setAgents(d.agents); }).catch(() => {});
    fetch("/api/config").then((r) => r.json()).then((d) => { setModeState(d.mode); setOperator(!!d.operator); }).catch(() => {});

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("snapshot", (e) => setDecisions(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("decision", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions((prev) => [d, ...prev].slice(0, 150));
    });
    es.onerror = () => setConnected(false);

    const poll = setInterval(() => {
      fetch("/api/guardrails").then((r) => r.json()).then(setGuard).catch(() => {});
    }, 1500);
    return () => { es.close(); clearInterval(poll); };
  }, []);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) }).catch(() => {});
  }, []);

  const post = useCallback(async (url: string, body?: unknown, key?: string) => {
    setBusy(key ?? url);
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    } finally {
      setBusy(null);
    }
  }, []);

  const runGuidedDemo = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    await fetch("/api/guardrails", { method: "POST" }).catch(() => {}); // reset budgets
    for (const step of DEMO_STEPS) {
      setDemoCaption(step.caption);
      (step.focus === "guardrails" ? guardRef : pipelineRef).current?.scrollIntoView({ behavior: "smooth", block: "center" });
      await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: step.agentId }) }).catch(() => {});
      await new Promise((r) => setTimeout(r, step.ms));
    }
    setDemoCaption(null);
    setDemoRunning(false);
  }, [demoRunning]);

  const latest = decisions[0];
  const allowed = decisions.filter((d) => d.allow).length;
  const blocked = decisions.length - allowed;
  const revenue = decisions.filter((d) => d.allow).reduce((s, d) => s + d.price, 0);

  return (
    <div className="relative">
      {/* sticky header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05070d]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold tracking-tight">
              Trust<span className="text-sky-400">MCP</span>
            </div>
            <span className="hidden text-xs text-white/40 sm:inline">trust + guardrails for every agent tool call</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill on={operator} onLabel="live billing" offLabel="local" />
            <StatusPill on={connected} onLabel="live" offLabel="…" />
            <ModeToggle mode={mode} onChange={setMode} />
            <button
              onClick={runGuidedDemo}
              disabled={demoRunning}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-60"
            >
              {demoRunning ? "Playing…" : "▶ Play guided demo"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-12 px-6 py-10">
        {/* HERO + PIPELINE */}
        <section ref={pipelineRef} className="scroll-mt-24">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            The identity &amp; reputation layer<br />
            <span className="text-sky-400">for agent tool calls.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/55">
            Every MCP tool call is scored by Valiron and policed by guardrails before it runs. Trusted
            agents flow through. Rogue, hijacked, or over-spending agents get blocked — automatically.
          </p>

          <Pipeline latest={latest} />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => post("/api/simulate", {}, "demo")}
              disabled={busy !== null || demoRunning}
              className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-50"
            >
              {busy === "demo" ? "Running…" : "Run all agents"}
            </button>
            <button
              onClick={() => post("/api/attack", {}, "attack")}
              disabled={busy !== null || demoRunning}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy === "attack" ? "Under attack…" : "☠ Attack wave"}
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  title={a.blurb}
                  onClick={() => post("/api/simulate", { agentId: a.id }, a.id)}
                  disabled={busy !== null || demoRunning}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-sky-400/50 hover:text-sky-300 disabled:opacity-50"
                >
                  {busy === a.id ? "…" : a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tool calls" value={String(decisions.length)} />
            <Stat label="Allowed" value={String(allowed)} accent="text-emerald-400" />
            <Stat label="Blocked" value={String(blocked)} accent="text-rose-400" />
            <Stat label="Revenue (risk-priced)" value={`$${revenue.toFixed(3)}`} accent="text-sky-300" />
          </div>
        </section>

        {/* LIVE FEED + GUARDRAILS side by side, always visible */}
        <section ref={guardRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card title="Live decision feed" subtitle="every gated call, in real time">
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {decisions.length === 0 && <Empty>Press ▶ Play guided demo to watch it work.</Empty>}
              {decisions.map((d) => <DecisionRow key={d.id} d={d} />)}
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="Guardrails" subtitle="behavioral policing — catches rogue trusted agents">
              <div className="grid grid-cols-3 gap-2">
                <Policy label="Budget / agent" value={guard ? `$${guard.policy.budgetUsd.toFixed(2)}` : "—"} />
                <Policy label="Velocity" value={guard ? `$${guard.policy.velocityUsd.toFixed(2)}/m` : "—"} />
                <Policy label="Burst" value={guard ? `${guard.policy.burstMax}/m` : "—"} />
              </div>
              <div className="mt-3 space-y-2">
                {!guard?.agents.length && <Empty>No agent activity yet.</Empty>}
                {guard?.agents.slice(0, 6).map((a) => (
                  <div key={a.agentId} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-white/75">{a.agentId}</span>
                      <span className="flex items-center gap-1.5">
                        {a.quarantined && <span className="rounded bg-fuchsia-400/15 px-1.5 py-0.5 font-semibold text-fuchsia-300">quarantined</span>}
                        {a.violations > 0 && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">{a.violations}⚠</span>}
                        <span className="text-white/50">${a.spend.toFixed(3)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full ${a.budgetPct >= 100 ? "bg-rose-500" : a.budgetPct > 70 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${a.budgetPct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Guardrail alerts" subtitle="injection, budget, burst & quarantine events">
              <div className="max-h-[28vh] space-y-2 overflow-y-auto pr-1">
                {!guard?.alerts.length && <Empty>No violations yet.</Empty>}
                {guard?.alerts.map((v) => (
                  <div key={v.id} className="flash-in rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`rounded border px-1.5 py-0.5 font-semibold uppercase ${violColor[v.type] ?? "text-white/60"}`}>{v.type}</span>
                      <span className="font-mono text-white/70">{v.agentId}</span>
                      <span className="text-white/30">→</span>
                      <span className="font-mono text-sky-300">{v.tool}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/45">{v.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* INSPECTOR */}
        <section className="scroll-mt-24">
          <SectionHead title="Inspect any agent" sub="Resolve an agent into its full Valiron trust passport — on-chain reputation, sandbox tier, World ID, routing." />
          <Inspector />
        </section>

        {/* TOOLS + CONNECT */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="Gated tools" subtitle="each declares a min trust score + price">
            <div className="space-y-2">
              {tools.map((t) => (
                <div key={t.name} className="rounded-lg border border-white/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono text-sm">
                      <span className={`h-2 w-2 rounded-full ${riskDot(t.risk)}`} />
                      {t.name}
                    </span>
                    <span className="text-xs text-white/40">≥{t.minScore}{t.basePrice ? ` · $${t.basePrice}` : ""}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">{t.description}</p>
                </div>
              ))}
            </div>
          </Card>
          <Connect />
        </section>

        <footer className="border-t border-white/10 pt-5 text-center text-xs text-white/30">
          MCP endpoint <span className="font-mono text-white/50">POST /api/mcp</span> · trust by{" "}
          <span className="text-sky-300">@valiron/sdk</span> · guardrails by TrustMCP
        </footer>
      </main>

      {/* GUIDED DEMO CAPTION OVERLAY */}
      {demoCaption && (
        <div className="fixed bottom-8 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2">
          <div className="caption-up rounded-2xl border border-sky-400/30 bg-[#0a0f1c]/95 px-6 py-4 shadow-2xl shadow-sky-500/10 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" /> guided demo
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">{demoCaption}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Pipeline({ latest }: { latest?: Decision }) {
  const stageState = (stage: "agent" | "trust" | "guard" | "tool") => {
    if (!latest) return "idle";
    const blockedAtTrust = latest.blockedBy === "trust-gate" || latest.blockedBy === "tool-policy" || latest.blockedBy === "pending-eval";
    const blockedAtGuard = latest.blockedBy === "guardrail";
    if (stage === "agent") return "ok";
    if (stage === "trust") return blockedAtTrust ? "block" : "ok";
    if (stage === "guard") return blockedAtTrust ? "idle" : blockedAtGuard ? "block" : "ok";
    if (stage === "tool") return latest.allow ? "ok" : "idle";
    return "idle";
  };

  const nodes: { key: "agent" | "trust" | "guard" | "tool"; label: string; sub: string }[] = [
    { key: "agent", label: "Agent", sub: latest ? latest.agentId : "—" },
    { key: "trust", label: "Valiron Trust", sub: latest ? `${latest.tier} · ${latest.score}` : "score" },
    { key: "guard", label: "Guardrails", sub: latest?.blockedBy === "guardrail" ? "violation" : "policy" },
    { key: "tool", label: latest ? latest.tool : "Tool", sub: latest ? latest.route : "execute" },
  ];

  return (
    <div className="mt-8 flex items-stretch gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:gap-2">
      {nodes.map((n, i) => {
        const st = stageState(n.key);
        const color =
          st === "ok" ? "border-emerald-400/50 bg-emerald-400/[0.06]" :
          st === "block" ? "border-rose-500/60 bg-rose-500/[0.08] pulse-danger" :
          "border-white/10 bg-white/[0.02]";
        const lineColor = st === "block" ? "text-rose-500/40" : st === "ok" ? "text-emerald-400/60" : "text-white/15";
        return (
          <div key={n.key} className="flex flex-1 items-center gap-1 sm:gap-2">
            <div className={`flash-in flex-1 rounded-xl border px-3 py-3 text-center transition-colors ${color}`} key={`${n.key}-${latest?.id ?? "idle"}`}>
              <div className="text-sm font-semibold">{n.label}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-white/50">{n.sub}</div>
              {st === "block" && <div className="mt-1 text-[10px] font-bold uppercase text-rose-300">blocked here</div>}
              {st === "ok" && n.key === "tool" && <div className="mt-1 text-[10px] font-bold uppercase text-emerald-300">executed</div>}
            </div>
            {i < nodes.length - 1 && <div className={`h-0.5 w-4 flex-shrink-0 sm:w-8 ${lineColor} ${st === "ok" ? "flow-line" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:inline-flex ${on ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"}`}>
      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-white/30"}`} />
      {on ? onLabel : offLabel}
    </span>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
      {(["auto", "live", "mock"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)} className={`rounded-full px-2.5 py-1 font-medium uppercase transition ${mode === m ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>{m}</button>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">{title}</h2>
        {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/50">{sub}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">{children}</div>;
}

function DecisionRow({ d }: { d: Decision }) {
  return (
    <div className={`flash-in rounded-xl border p-3 ${d.allow ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-rose-500/25 bg-rose-500/[0.05]"}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${d.allow ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{d.allow ? "ALLOW" : "DENY"}</span>
        <span className="font-mono text-white/80">{d.agentId}</span>
        <span className="text-white/30">→</span>
        <span className="font-mono text-sky-300">{d.tool}</span>
        <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tierColor(d.tier)}`}>{d.tier} · {d.score}</span>
        {d.price > 0 && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/60">${d.price.toFixed(3)}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
        <span className={`h-1.5 w-1.5 rounded-full ${riskDot(d.riskLevel)}`} />
        <span>{d.route}</span>
        {d.blockedBy && <span className="text-rose-300/70">· {d.blockedBy}</span>}
        <span className="ml-auto text-white/25">{d.source}</span>
      </div>
      {d.reasons?.[0] && <p className="mt-1 text-xs text-white/40">{d.reasons[0]}</p>}
    </div>
  );
}

type Passport = {
  agentId: string; source: "live" | "mock"; name: string | null; wallet: string | null; chain: string;
  score: number; tier: string; riskLevel: "GREEN" | "YELLOW" | "RED"; route: string; reasons: string[];
  signals: {
    onchain: { present: boolean; feedbackCount: number; averageScore: number };
    sandbox: { present: boolean; tier: string | null; graduated: boolean | null };
    worldId: { verified: boolean; level: string | null };
    icebreaker: { present: boolean; handles: string[] };
  };
};

function Inspector() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [p, setP] = useState<Passport | null>(null);

  const lookup = useCallback(async (agentId: string) => {
    if (!agentId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) });
      setP(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const samples = ["25459", "aaa-trusted-agent", "low-trust-scraper", "malicious-drainer"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Card title="Passport lookup">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(q)} placeholder="agent id or wallet…" className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/60" />
          <button onClick={() => lookup(q)} disabled={loading} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-50">{loading ? "…" : "Inspect"}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {samples.map((s) => (
            <button key={s} onClick={() => { setQ(s); lookup(s); }} className="rounded-full border border-white/15 px-3 py-1 font-mono text-xs text-white/60 transition hover:border-sky-400/50 hover:text-sky-300">{s}</button>
          ))}
        </div>
      </Card>
      <Card title="Trust profile">
        {!p && <Empty>Look up an agent to see its credit-style trust passport.</Empty>}
        {p && <PassportCard p={p} />}
      </Card>
    </div>
  );
}

function PassportCard({ p }: { p: Passport }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{p.name || p.agentId}</div>
          <div className="font-mono text-xs text-white/40">{p.wallet}</div>
          <div className="mt-1 text-xs text-white/40">chain: {p.chain} · {p.source}</div>
        </div>
        <div className={`rounded-xl border px-4 py-2 text-center ${tierColor(p.tier)}`}>
          <div className="text-2xl font-bold">{p.tier}</div>
          <div className="text-xs opacity-80">score {p.score}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${riskDot(p.riskLevel)}`} />
        <span className="text-white/70">{p.riskLevel}</span>
        <span className="text-white/30">·</span>
        <span className="font-mono text-white/70">{p.route}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Signal label="On-chain (ERC-8004)" ok={p.signals.onchain.present} detail={p.signals.onchain.present ? `${p.signals.onchain.feedbackCount} reviews · avg ${p.signals.onchain.averageScore}` : "no on-chain reputation"} />
        <Signal label="Behavioral sandbox" ok={p.signals.sandbox.present} detail={p.signals.sandbox.present ? `tier ${p.signals.sandbox.tier}${p.signals.sandbox.graduated ? " · graduated" : ""}` : "not evaluated"} />
        <Signal label="World ID" ok={p.signals.worldId.verified} detail={p.signals.worldId.verified ? `verified (${p.signals.worldId.level})` : "unverified"} />
        <Signal label="Icebreaker" ok={p.signals.icebreaker.present} detail={p.signals.icebreaker.present ? p.signals.icebreaker.handles.join(", ") : "no attestation"} />
      </div>
      {p.reasons?.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
          {p.reasons.map((r, i) => <div key={i}>• {r}</div>)}
        </div>
      )}
    </div>
  );
}

function Signal({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-white/70">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-white/25"}`} />
        {label}
      </div>
      <div className="mt-1 text-xs text-white/45">{detail}</div>
    </div>
  );
}

function Connect() {
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => setOrigin(window.location.origin), []);
  const mcpJson = `{
  "mcpServers": {
    "trustmcp": {
      "url": "${origin}/api/mcp",
      "headers": { "x-agent-id": "YOUR_AGENT_ID" }
    }
  }
}`;
  return (
    <Card title="Connect an MCP client" subtitle="drop into Claude / Cursor — x-agent-id is all you need">
      <CodeBlock code={mcpJson} />
      <p className="mt-3 text-xs text-white/45">Every <span className="font-mono">tools/call</span> is gated by Valiron + Guardrails before it runs.</p>
    </Card>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-white/80">{code}</pre>
      <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="absolute right-2 top-2 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[11px] text-white/60 transition hover:text-white">{copied ? "copied" : "copy"}</button>
    </div>
  );
}
