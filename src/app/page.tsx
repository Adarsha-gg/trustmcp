"use client";

import { useCallback, useEffect, useState } from "react";

type Decision = {
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
  const settled = decisions.filter((d) => d.payment?.state === "settled");
  const paidTotal = settled.reduce((s, d) => s + (d.payment?.amount ?? 0), 0);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#04060c]/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldGlyph />
            <span className="text-[15px] font-bold tracking-tight">
              Trust<span className="text-sky-400">MCP</span>
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40 sm:inline">
              trust layer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${connected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"}`}>
              <span className={`relative h-1.5 w-1.5 rounded-full ${connected ? "live-ping bg-emerald-400 text-emerald-400" : "bg-white/30"}`} />
              {connected ? "live" : "connecting"}
            </span>
            <a
              href="https://github.com/Adarsha-gg/trustmcp"
              target="_blank" rel="noreferrer"
              className="hidden rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:text-white sm:block"
              aria-label="GitHub repository"
            >
              <GithubGlyph />
            </a>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        {/* HERO */}
        <section className="rise pt-16 sm:pt-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Identity &amp; reputation for the agent economy
          </div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Trust, guardrails &amp; payments
            <br />
            for every agent call.{" "}
            <span className="gradient-text">One line.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55">
            Front your MCP tools — or <span className="text-white/85">any HTTPS API</span> — with
            TrustMCP. Each request is scored by Valiron, policed by guardrails, and settled via{" "}
            <span className="text-white/85">x402</span> <span className="text-white/85">before it runs</span>.
            Trusted agents flow through and pay less; rogue, hijacked, or unpaid ones are blocked
            automatically.
          </p>

          <PipelineStrip />

          <div className="mt-8">
            <Connect />
          </div>
        </section>

        {/* BRING YOUR OWN API */}
        <section className="mt-20">
          <SectionHeader
            n="01"
            title="Bring your own API"
            desc="Point TrustMCP at any existing HTTPS API. It becomes a trust-gated, x402-monetized endpoint — agents are scored and charged before your origin is ever hit. Zero code changes."
          />
          <div className="mt-6">
            <Upstreams />
          </div>
        </section>

        {/* OBSERVABILITY */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader n="02" title="Live activity" desc="Read-only — every gated call your tools and APIs received, as it happens." />
            <button onClick={runDemo} disabled={demoRunning} className="btn-primary px-4 py-2 text-sm">
              {demoRunning ? "Running…" : "▶  Run sample traffic"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Calls" value={String(decisions.length)} />
            <Stat label="Allowed" value={String(allowed)} accent="text-emerald-400" />
            <Stat label="Blocked" value={String(blocked)} accent="text-rose-400" />
            <Stat label={`Paid · x402 (${settled.length})`} value={`$${paidTotal.toFixed(3)}`} accent="text-sky-300" />
          </div>

          <div className="mt-4 space-y-2">
            {decisions.length === 0 && (
              <div className="card flex flex-col items-center gap-2 border-dashed py-12 text-center">
                <div className="text-sm text-white/45">No traffic yet.</div>
                <div className="text-xs text-white/30">
                  Press <span className="text-sky-300">Run sample traffic</span> or test an API above to
                  watch the gateway allow and block agents in real time.
                </div>
              </div>
            )}
            {decisions.map((d) => <Row key={d.id} d={d} />)}
          </div>
        </section>

        <footer className="mt-20 flex flex-col items-center gap-4 border-t border-white/[0.06] pt-8 text-center">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/Adarsha-gg/trustmcp"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            <svg viewBox="0 0 76 65" className="h-3.5 w-3.5 fill-white" aria-hidden><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>
            Deploy your own gateway
          </a>
          <div className="text-xs text-white/30">
            <span className="font-mono text-white/50">POST /api/mcp</span> ·{" "}
            <span className="font-mono text-white/50">/api/gateway/&lt;id&gt;</span> · trust by{" "}
            <span className="text-sky-300">@valiron/sdk</span> · guardrails by TrustMCP
          </div>
        </footer>
      </main>
    </>
  );
}

function PipelineStrip() {
  const steps = ["Identity", "Valiron trust", "Guardrails", "x402 pay", "Run / forward"];
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-medium text-white/70">{s}</span>
          {i < steps.length - 1 && <span className="px-0.5 text-white/25">→</span>}
        </span>
      ))}
      <span className="ml-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 font-medium text-emerald-300">
        allow · throttle · block
      </span>
    </div>
  );
}

function SectionHeader({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-sky-400/70">{n}</span>
        <span className="h-px w-6 bg-white/15" />
        <h2 className="eyebrow">{title}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{desc}</p>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
      {(["auto", "live", "mock"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)} className={`rounded-full px-2.5 py-1 font-medium uppercase tracking-wide transition ${mode === m ? "bg-white text-black shadow-sm" : "text-white/45 hover:text-white"}`}>{m}</button>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card card-hover px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}

function Row({ d }: { d: Decision }) {
  const settled = d.payment?.state === "settled";
  const need402 = d.blockedBy === "payment-required";
  return (
    <div className={`flash-in flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${d.allow ? "border-emerald-400/20 bg-emerald-400/[0.04] hover:border-emerald-400/35" : "border-rose-500/25 bg-rose-500/[0.05] hover:border-rose-500/40"}`}>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${d.allow ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{d.allow ? "ALLOW" : "DENY"}</span>
      {d.kind === "api" && (
        <span className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300" title="Bring-Your-Own-API reverse proxy call">API</span>
      )}
      <span className="font-mono text-white/80">{d.agentId}</span>
      <span className="text-white/30">→</span>
      <span className="truncate font-mono text-sky-300">{d.tool}</span>
      <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tierColor(d.tier)}`}>{d.tier} · {d.score}</span>
      {settled && (
        <span title={d.payment?.txHash} className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sky-300">
          PAID ${d.payment!.amount.toFixed(3)}
        </span>
      )}
      {need402 && (
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300">
          402 ${d.payment?.amount.toFixed(3)}
        </span>
      )}
      {!settled && !need402 && d.price > 0 && (
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] tabular-nums text-white/60">${d.price.toFixed(3)}</span>
      )}
      {settled && d.payment?.txHash && (
        <span className="w-full truncate font-mono text-[11px] text-white/35">
          x402 settled · {d.payment.network}/{d.payment.asset} · {d.payment.txHash}
        </span>
      )}
      {!d.allow && d.reasons?.[0] && (
        <p className="w-full text-xs text-white/45">
          {d.blockedBy === "guardrail" && <span className="mr-1 font-semibold text-fuchsia-300">guardrail:</span>}
          {d.blockedBy === "payment-required" && <span className="mr-1 font-semibold text-amber-300">x402:</span>}
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
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-white/45">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          </span>
          <span className="ml-1 font-mono text-white/60">mcp.json</span>
          <span className="hidden sm:inline">· drop into Claude, Cursor, or any MCP client</span>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="rounded-md border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white/60 transition hover:text-white"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-black/30 p-4 font-mono text-[13px] leading-relaxed text-white/85">{code}</pre>
    </div>
  );
}

type Upstream = {
  id: string;
  name: string;
  baseUrl: string;
  pricePerCall: number;
  minScore: number;
  description: string;
  builtin?: boolean;
};

function encodeTestPayment(amount: number): string {
  const payload = { scheme: "exact", network: "ethereum", amount, asset: "USDC", payer: "test-wallet", ts: Date.now() };
  return typeof btoa !== "undefined" ? btoa(JSON.stringify(payload)) : "";
}

function Upstreams() {
  const [items, setItems] = useState<Upstream[]>([]);
  const [origin, setOrigin] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", baseUrl: "", pricePerCall: "0.01", minScore: "50" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/upstreams").then((r) => r.json()).then((d) => setItems(d.upstreams ?? [])).catch(() => {});
  }, []);
  useEffect(() => { setOrigin(window.location.origin); load(); }, [load]);

  const add = useCallback(async () => {
    setErr(null);
    setAdding(true);
    try {
      const res = await fetch("/api/upstreams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, baseUrl: form.baseUrl,
          pricePerCall: Number(form.pricePerCall), minScore: Number(form.minScore),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Failed to register"); return; }
      setForm({ name: "", baseUrl: "", pricePerCall: "0.01", minScore: "50" });
      load();
    } finally {
      setAdding(false);
    }
  }, [form, load]);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/upstreams?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    load();
  }, [load]);

  return (
    <div>
      <div className="space-y-3">
        {items.map((u) => (
          <UpstreamCard key={u.id} u={u} origin={origin} onRemove={remove} />
        ))}
      </div>

      <div className="card mt-3 p-4">
        <div className="flex items-center gap-2">
          <PlusGlyph />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/55">Register an API</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My API" className="input px-3 py-2 text-sm placeholder:text-white/25" />
          <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com" className="input px-3 py-2 font-mono text-sm placeholder:text-white/25" />
          <input value={form.pricePerCall} onChange={(e) => setForm({ ...form, pricePerCall: e.target.value })} placeholder="$/call" title="USD per call (0 = free)" className="input w-20 px-3 py-2 text-sm" />
          <input value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })} placeholder="minScore" title="Minimum Valiron score" className="input w-24 px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={add} disabled={adding || !form.name || !form.baseUrl} className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50">
            {adding ? "Registering…" : "Protect this API"}
          </button>
          {err && <span className="text-xs text-rose-300">{err}</span>}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/30">
            <LockGlyph /> HTTPS public hosts only · SSRF-guarded
          </span>
        </div>
      </div>
    </div>
  );
}

function UpstreamCard({ u, origin, onRemove }: { u: Upstream; origin: string; onRemove: (id: string) => void }) {
  const gateway = `${origin}/api/gateway/${u.id}`;
  const samplePath = u.id === "weather"
    ? "/v1/forecast?latitude=37.77&longitude=-122.42&current=temperature_2m"
    : "/";
  const [path, setPath] = useState(samplePath);
  const [copied, setCopied] = useState(false);
  const [out, setOut] = useState<{ agent: string; status: number; body: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const test = useCallback(async (agent: string, pay: boolean) => {
    setBusy(agent);
    setOut(null);
    try {
      const headers: Record<string, string> = { "x-agent-id": agent };
      if (pay && u.pricePerCall > 0) headers["x-payment"] = encodeTestPayment(1.0);
      const res = await fetch(gateway + path, { headers });
      const body = await res.text();
      setOut({ agent, status: res.status, body });
    } catch {
      setOut({ agent, status: 0, body: "request failed" });
    } finally {
      setBusy(null);
    }
  }, [gateway, path, u.pricePerCall]);

  const ok = out && out.status >= 200 && out.status < 300;

  return (
    <div className="card card-hover p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{u.name}</span>
        <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
          {u.pricePerCall > 0 ? `$${u.pricePerCall.toFixed(2)}/call` : "free"}
        </span>
        <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/55">
          min score {u.minScore}
        </span>
        {u.builtin && <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[11px] text-emerald-300/80">live demo</span>}
        {!u.builtin && (
          <button onClick={() => onRemove(u.id)} className="ml-auto text-xs text-white/30 transition hover:text-rose-300">remove</button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/45">{u.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white/75">
          {gateway}<span className="text-white/35">{"/<path>"}</span>
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(gateway); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="shrink-0 rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white/60 transition hover:text-white"
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={path} onChange={(e) => setPath(e.target.value)} className="input min-w-[200px] flex-1 px-3 py-1.5 font-mono text-xs" />
        <button onClick={() => test("aaa-trusted-agent", true)} disabled={!!busy} className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50">
          {busy === "aaa-trusted-agent" ? "…" : "test as AAA agent"}
        </button>
        <button onClick={() => test("low-trust-scraper", false)} disabled={!!busy} className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50">
          {busy === "low-trust-scraper" ? "…" : "test as scraper"}
        </button>
      </div>

      {out && (
        <div className="mt-3 rise">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-white/50">{out.agent}</span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
              HTTP {out.status || "ERR"}
            </span>
            <span className="text-white/30">{ok ? "→ real upstream response" : "→ blocked before your origin"}</span>
          </div>
          <pre className="mt-1.5 max-h-44 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-white/70">
            {pretty(out.body)}
          </pre>
        </div>
      )}
    </div>
  );
}

function pretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2).slice(0, 1400);
  } catch {
    return s.slice(0, 1400);
  }
}

/* ── Inline glyphs ───────────────────────────────────────────────── */

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M12 2.5 4.5 5.5v6c0 4.5 3.2 7.8 7.5 9.5 4.3-1.7 7.5-5 7.5-9.5v-6L12 2.5Z" stroke="url(#sg)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs><linearGradient id="sg" x1="4" y1="2" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#7dd3fc" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sky-400" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
