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

type Tool = {
  name: string;
  description: string;
  risk: "GREEN" | "YELLOW" | "RED";
  minScore: number;
  basePrice: number;
};

type Agent = { id: string; label: string; blurb: string; expected: string };

type Passport = {
  agentId: string;
  source: "live" | "mock";
  name: string | null;
  wallet: string | null;
  chain: string;
  score: number;
  tier: string;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  route: string;
  reasons: string[];
  signals: {
    onchain: { present: boolean; feedbackCount: number; averageScore: number };
    sandbox: { present: boolean; tier: string | null; graduated: boolean | null };
    worldId: { verified: boolean; level: string | null };
    icebreaker: { present: boolean; handles: string[] };
  };
};

type Mode = "auto" | "live" | "mock";

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
  const [tab, setTab] = useState<"console" | "inspect" | "connect">("console");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mode, setModeState] = useState<Mode>("auto");

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        setTools(d.tools);
        setAgents(d.agents);
      })
      .catch(() => {});
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setModeState(d.mode))
      .catch(() => {});

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("snapshot", (e) => setDecisions(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("decision", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions((prev) => [d, ...prev].slice(0, 150));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: m }),
    }).catch(() => {});
  }, []);

  const post = useCallback(async (url: string, body?: unknown, key?: string) => {
    setBusy(key ?? url);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
    } finally {
      setBusy(null);
    }
  }, []);

  const allowed = decisions.filter((d) => d.allow).length;
  const blocked = decisions.length - allowed;
  const revenue = decisions.filter((d) => d.allow).reduce((s, d) => s + d.price, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Trust<span className="text-sky-400">MCP</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">
            The identity &amp; reputation layer for MCP · every tool call scored by{" "}
            <span className="text-sky-300">Valiron</span> before it runs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
              connected
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/15 bg-white/5 text-white/50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-white/40"}`} />
            {connected ? "live" : "…"}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1 text-sm">
        {(["console", "inspect", "connect"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 font-medium capitalize transition ${
              tab === t ? "bg-sky-500 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {t === "console" ? "Live console" : t === "inspect" ? "Inspect agent" : "Connect"}
          </button>
        ))}
      </nav>

      {tab === "console" && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tool calls" value={String(decisions.length)} />
            <StatCard label="Allowed" value={String(allowed)} accent="text-emerald-400" />
            <StatCard label="Blocked" value={String(blocked)} accent="text-rose-400" />
            <StatCard label="Revenue (risk-priced)" value={`$${revenue.toFixed(3)}`} accent="text-sky-300" />
          </section>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => post("/api/simulate", {}, "demo")}
              disabled={busy !== null}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-50"
            >
              {busy === "demo" ? "Running…" : "▶ Run full demo"}
            </button>
            <button
              onClick={() => post("/api/attack", {}, "attack")}
              disabled={busy !== null}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy === "attack" ? "Under attack…" : "☠ Simulate attack wave"}
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="space-y-6">
              <Panel title="Demo agents">
                <div className="space-y-2">
                  {agents.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{a.label}</span>
                        <button
                          onClick={() => post("/api/simulate", { agentId: a.id }, a.id)}
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
              </Panel>

              <Panel title="Gated tools">
                <div className="space-y-2">
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
              </Panel>
            </div>

            <Panel title="Live decision feed">
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {decisions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
                    No calls yet. Hit <span className="text-sky-300">Run full demo</span> or{" "}
                    <span className="text-rose-300">Simulate attack wave</span> to watch the gateway
                    allow, throttle, and block agents in real time.
                  </div>
                )}
                {decisions.map((d) => (
                  <DecisionRow key={d.id} d={d} />
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      {tab === "inspect" && <Inspector mode={mode} />}
      {tab === "connect" && <Connect />}

      <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-white/30">
        MCP endpoint: <span className="font-mono text-white/50">POST /api/mcp</span> · powered by{" "}
        <span className="text-sky-300">@valiron/sdk</span>
      </footer>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h2>
      {children}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
      {(["auto", "live", "mock"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          title={
            m === "live"
              ? "Strict: real Valiron API only"
              : m === "mock"
                ? "Offline: deterministic local profiles"
                : "Real API with offline fallback"
          }
          className={`rounded-full px-3 py-1 font-medium uppercase transition ${
            mode === m ? "bg-white text-black" : "text-white/50 hover:text-white"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function DecisionRow({ d }: { d: Decision }) {
  return (
    <div
      className={`flash-in rounded-xl border p-3 ${
        d.allow ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-rose-500/25 bg-rose-500/[0.05]"
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
      {d.reasons?.[0] && <p className="mt-1 text-xs text-white/40">{d.reasons[0]}</p>}
    </div>
  );
}

function Inspector({ mode }: { mode: Mode }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [p, setP] = useState<Passport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const lookup = useCallback(async (agentId: string) => {
    if (!agentId.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("lookup failed");
      setP(await res.json());
    } catch {
      setErr("Could not fetch passport.");
    } finally {
      setLoading(false);
    }
  }, []);

  const samples = ["25459", "aaa-trusted-agent", "low-trust-scraper", "malicious-drainer"];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Panel title="Agent passport lookup">
        <p className="mb-3 text-xs text-white/45">
          Resolve any agent into its full Valiron trust profile — on-chain reputation, behavioral
          tier, World ID, and routing. In <span className="font-mono">live</span>/
          <span className="font-mono">auto</span> mode, real ERC-8004 IDs (e.g.{" "}
          <span className="font-mono text-sky-300">25459</span>) hit the real API.
        </p>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(q)}
            placeholder="agent id or wallet…"
            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          />
          <button
            onClick={() => lookup(q)}
            disabled={loading}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? "…" : "Inspect"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {samples.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                lookup(s);
              }}
              className="rounded-full border border-white/15 px-3 py-1 font-mono text-xs text-white/60 transition hover:border-sky-400/50 hover:text-sky-300"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-white/30">current mode: {mode}</p>
      </Panel>

      <Panel title="Trust profile">
        {!p && !err && (
          <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
            Look up an agent to see its credit-style trust passport.
          </div>
        )}
        {err && <div className="text-sm text-rose-300">{err}</div>}
        {p && <PassportCard p={p} />}
      </Panel>
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
          <div className="mt-1 text-xs text-white/40">
            chain: {p.chain} · <span className="text-white/30">{p.source}</span>
          </div>
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
        <SignalCard
          label="On-chain (ERC-8004)"
          ok={p.signals.onchain.present}
          detail={
            p.signals.onchain.present
              ? `${p.signals.onchain.feedbackCount} reviews · avg ${p.signals.onchain.averageScore}`
              : "no on-chain reputation"
          }
        />
        <SignalCard
          label="Behavioral sandbox"
          ok={p.signals.sandbox.present}
          detail={
            p.signals.sandbox.present
              ? `tier ${p.signals.sandbox.tier}${p.signals.sandbox.graduated ? " · graduated" : ""}`
              : "not evaluated"
          }
        />
        <SignalCard
          label="World ID"
          ok={p.signals.worldId.verified}
          detail={p.signals.worldId.verified ? `verified (${p.signals.worldId.level})` : "unverified"}
        />
        <SignalCard
          label="Icebreaker"
          ok={p.signals.icebreaker.present}
          detail={p.signals.icebreaker.present ? p.signals.icebreaker.handles.join(", ") : "no attestation"}
        />
      </div>

      {p.reasons?.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
          {p.reasons.map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
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
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const mcpJson = `{
  "mcpServers": {
    "trustmcp": {
      "url": "${origin}/api/mcp",
      "headers": { "x-agent-id": "YOUR_AGENT_ID" }
    }
  }
}`;

  const curl = `curl -X POST ${origin}/api/mcp \\
  -H 'content-type: application/json' \\
  -H 'x-agent-id: aaa-trusted-agent' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"send_payment",
       "arguments":{"to":"0xabc","amountUsd":25}}}'`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Panel title="Connect an MCP client">
        <p className="mb-3 text-xs text-white/45">
          TrustMCP speaks the MCP wire protocol. Point Claude Desktop, Cursor, or any MCP client at
          the gateway — the <span className="font-mono">x-agent-id</span> header is all you need.
        </p>
        <CodeBlock code={mcpJson} />
      </Panel>
      <Panel title="Call it directly (curl)">
        <p className="mb-3 text-xs text-white/45">
          Every <span className="font-mono">tools/call</span> is gated by Valiron before it runs.
          Swap the agent id to watch allow vs deny.
        </p>
        <CodeBlock code={curl} />
        <p className="mt-3 text-xs text-white/45">
          List tools:{" "}
          <span className="font-mono text-white/60">{"{ method: 'tools/list' }"}</span>
        </p>
      </Panel>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-white/80">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[11px] text-white/60 transition hover:text-white"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
