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

type Tool = {
  name: string;
  description: string;
  risk: "GREEN" | "YELLOW" | "RED";
  minScore: number;
  basePrice: number;
};

type Agent = {
  id: string;
  label: string;
  blurb: string;
  expected: string;
};

const tierColor = (tier: string) => {
  if (["AAA", "AA", "A"].includes(tier)) return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (["BAA", "BA"].includes(tier)) return "text-yellow-300 border-yellow-300/40 bg-yellow-300/10";
  if (["B"].includes(tier)) return "text-orange-300 border-orange-300/40 bg-orange-300/10";
  return "text-rose-400 border-rose-400/40 bg-rose-400/10";
};

const riskDot = (risk: string) =>
  risk === "GREEN" ? "bg-emerald-400" : risk === "YELLOW" ? "bg-yellow-300" : "bg-rose-500";

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        setTools(d.tools);
        setAgents(d.agents);
      })
      .catch(() => {});

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("snapshot", (e) => {
      setDecisions(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("decision", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions((prev) => [d, ...prev].slice(0, 150));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const simulate = useCallback(async (agentId?: string) => {
    setBusy(agentId ?? "all");
    try {
      await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentId ? { agentId } : {}),
      });
    } finally {
      setBusy(null);
    }
  }, []);

  const allowed = decisions.filter((d) => d.allow).length;
  const blocked = decisions.length - allowed;
  const revenue = decisions
    .filter((d) => d.allow)
    .reduce((s, d) => s + d.price, 0);
  const liveCount = decisions.filter((d) => d.source === "live").length;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Trust<span className="text-sky-400">MCP</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Trust-gated MCP gateway · every tool call scored by{" "}
            <span className="text-sky-300">Valiron</span> before it runs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
              connected
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/15 bg-white/5 text-white/50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-white/40"}`} />
            {connected ? "live feed" : "connecting…"}
          </span>
          <button
            onClick={() => simulate()}
            disabled={busy !== null}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-50"
          >
            {busy === "all" ? "Running…" : "▶ Run full demo"}
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tool calls" value={String(decisions.length)} />
        <StatCard label="Allowed" value={String(allowed)} accent="text-emerald-400" />
        <StatCard label="Blocked" value={String(blocked)} accent="text-rose-400" />
        <StatCard label="Revenue (risk-priced)" value={`$${revenue.toFixed(3)}`} accent="text-sky-300" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left column: agents + tools */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Demo agents
            </h2>
            <div className="mt-3 space-y-2">
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.label}</span>
                    <button
                      onClick={() => simulate(a.id)}
                      disabled={busy !== null}
                      className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-sky-400/50 hover:text-sky-300 disabled:opacity-50"
                    >
                      {busy === a.id ? "…" : "run"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">{a.blurb}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Gated tools
            </h2>
            <div className="mt-3 space-y-2">
              {tools.map((t) => (
                <div key={t.name} className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono text-sm">
                      <span className={`h-2 w-2 rounded-full ${riskDot(t.risk)}`} />
                      {t.name}
                    </span>
                    <span className="text-xs text-white/40">
                      ≥{t.minScore}
                      {t.basePrice ? ` · $${t.basePrice}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: live decision feed */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Live decision feed
            </h2>
            <span className="text-xs text-white/40">
              {liveCount > 0 ? `${liveCount} live · ` : ""}
              {decisions.length - liveCount} mock
            </span>
          </div>

          <div ref={feedRef} className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {decisions.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
                No calls yet. Hit <span className="text-sky-300">Run full demo</span> to watch the
                gateway allow, throttle, and block agents in real time.
              </div>
            )}
            {decisions.map((d) => (
              <div
                key={d.id}
                className={`flash-in rounded-xl border p-3 ${
                  d.allow
                    ? "border-emerald-400/20 bg-emerald-400/[0.04]"
                    : "border-rose-500/25 bg-rose-500/[0.05]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      d.allow ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {d.allow ? "ALLOW" : "DENY"}
                  </span>
                  <span className="font-mono text-white/80">{d.agentId}</span>
                  <span className="text-white/30">→</span>
                  <span className="font-mono text-sky-300">{d.tool}</span>
                  <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tierColor(d.tier)}`}>
                    {d.tier} · {d.score}
                  </span>
                  {d.price > 0 && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/60">
                      ${d.price.toFixed(3)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                  <span className={`h-1.5 w-1.5 rounded-full ${riskDot(d.riskLevel)}`} />
                  <span>{d.route}</span>
                  {d.blockedBy && <span className="text-rose-300/70">· {d.blockedBy}</span>}
                  <span className="ml-auto text-white/25">{d.source}</span>
                </div>
                {d.reasons?.[0] && (
                  <p className="mt-1 text-xs text-white/40">{d.reasons[0]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-white/30">
        MCP endpoint: <span className="font-mono text-white/50">POST /api/mcp</span> · powered by{" "}
        <span className="text-sky-300">@valiron/sdk</span>
      </footer>
    </main>
  );
}
