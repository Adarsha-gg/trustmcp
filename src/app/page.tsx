"use client";

import { useCallback, useEffect, useState } from "react";

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
type Mode = "auto" | "live" | "mock";

const tierColor = (t: string) =>
  ["AAA", "AA", "A"].includes(t)
    ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
    : ["BAA", "BA"].includes(t)
      ? "text-yellow-300 border-yellow-300/40 bg-yellow-300/10"
      : ["B"].includes(t)
        ? "text-orange-300 border-orange-300/40 bg-orange-300/10"
        : "text-rose-400 border-rose-400/40 bg-rose-400/10";

export default function App() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [mode, setModeState] = useState<Mode>("auto");
  const [connected, setConnected] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((d) => setModeState(d.mode)).catch(() => {});
    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("snapshot", (e) => setDecisions(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("decision", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions((prev) => [d, ...prev].slice(0, 100));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) }).catch(() => {});
  }, []);

  const runDemo = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    try {
      await fetch("/api/guardrails", { method: "POST" }).catch(() => {});
      await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    } finally {
      setDemoRunning(false);
    }
  }, [demoRunning]);

  const allowed = decisions.filter((d) => d.allow).length;
  const blocked = decisions.length - allowed;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="text-xl font-bold tracking-tight">
          Trust<span className="text-sky-400">MCP</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${connected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-white/30"}`} />
            {connected ? "live" : "…"}
          </span>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      {/* HERO — the product is one line of integration */}
      <section className="mt-12">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Trust &amp; guardrails for agent tool calls.<br />
          <span className="text-sky-400">One line. No dashboard required.</span>
        </h1>
        <p className="mt-3 text-white/55">
          Point your MCP client at TrustMCP. Every tool call is scored by Valiron and policed by
          guardrails <span className="text-white/80">before it runs</span> — trusted agents flow
          through, rogue or hijacked ones get blocked automatically.
        </p>

        <div className="mt-6">
          <Connect />
        </div>

        <p className="mt-3 text-xs text-white/40">
          That&apos;s it. Your agents call tools like normal — TrustMCP gates them transparently.
          The activity log below is just to <span className="text-white/70">see what happened</span>.
        </p>
      </section>

      {/* OBSERVABILITY — read-only "what happened" */}
      <section className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">Activity</h2>
            <p className="text-xs text-white/40">read-only — every gated call your tools received</p>
          </div>
          <button
            onClick={runDemo}
            disabled={demoRunning}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-60"
          >
            {demoRunning ? "Running…" : "▶ Run sample traffic"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Calls" value={String(decisions.length)} />
          <Stat label="Allowed" value={String(allowed)} accent="text-emerald-400" />
          <Stat label="Blocked" value={String(blocked)} accent="text-rose-400" />
        </div>

        <div className="mt-4 space-y-2">
          {decisions.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
              Nothing yet. Press <span className="text-sky-300">Run sample traffic</span> to see the
              gateway allow and block agents.
            </div>
          )}
          {decisions.map((d) => <Row key={d.id} d={d} />)}
        </div>
      </section>

      <footer className="mt-12 border-t border-white/10 pt-5 text-center text-xs text-white/30">
        <span className="font-mono text-white/50">POST /api/mcp</span> · trust by{" "}
        <span className="text-sky-300">@valiron/sdk</span> · guardrails by TrustMCP
      </footer>
    </div>
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

function Row({ d }: { d: Decision }) {
  return (
    <div className={`flash-in flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${d.allow ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-rose-500/25 bg-rose-500/[0.05]"}`}>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${d.allow ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{d.allow ? "ALLOW" : "DENY"}</span>
      <span className="font-mono text-white/80">{d.agentId}</span>
      <span className="text-white/30">→</span>
      <span className="font-mono text-sky-300">{d.tool}</span>
      <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tierColor(d.tier)}`}>{d.tier} · {d.score}</span>
      {d.price > 0 && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/60">${d.price.toFixed(3)}</span>}
      {!d.allow && d.reasons?.[0] && (
        <p className="w-full text-xs text-white/45">
          {d.blockedBy === "guardrail" && <span className="mr-1 font-semibold text-fuchsia-300">guardrail:</span>}
          {d.reasons[0]}
        </p>
      )}
    </div>
  );
}

function Connect() {
  const [origin, setOrigin] = useState("https://your-trustmcp.app");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const code = `{
  "mcpServers": {
    "trustmcp": {
      "url": "${origin}/api/mcp",
      "headers": { "x-agent-id": "YOUR_AGENT_ID" }
    }
  }
}`;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono">mcp.json</span>
        <span>drop into Claude, Cursor, or any MCP client</span>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm leading-relaxed text-white/85">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute right-2.5 top-9 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white/60 transition hover:text-white"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
