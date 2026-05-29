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
          Point your MCP client at TrustMCP. Every tool call is scored by Valiron, policed by
          guardrails, and paid via <span className="text-white/80">x402</span> —{" "}
          <span className="text-white/80">before it runs</span>. Trusted agents flow through and pay
          less; rogue, hijacked, or unpaid ones get blocked automatically.
        </p>

        <div className="mt-6">
          <Connect />
        </div>

        <p className="mt-3 text-xs text-white/40">
          That&apos;s it. Your agents call tools like normal — TrustMCP gates them transparently.
          The activity log below is just to <span className="text-white/70">see what happened</span>.
        </p>
      </section>

      {/* BRING YOUR OWN API — the real use case */}
      <section className="mt-14">
        <Upstreams />
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

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calls" value={String(decisions.length)} />
          <Stat label="Allowed" value={String(allowed)} accent="text-emerald-400" />
          <Stat label="Blocked" value={String(blocked)} accent="text-rose-400" />
          <Stat label={`Paid via x402 (${settled.length})`} value={`$${paidTotal.toFixed(3)}`} accent="text-sky-300" />
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
  const settled = d.payment?.state === "settled";
  const need402 = d.blockedBy === "payment-required";
  return (
    <div className={`flash-in flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${d.allow ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-rose-500/25 bg-rose-500/[0.05]"}`}>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${d.allow ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{d.allow ? "ALLOW" : "DENY"}</span>
      <span className="font-mono text-white/80">{d.agentId}</span>
      <span className="text-white/30">→</span>
      <span className="font-mono text-sky-300">{d.tool}</span>
      <span className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tierColor(d.tier)}`}>{d.tier} · {d.score}</span>
      {settled && (
        <span title={d.payment?.txHash} className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
          PAID ${d.payment!.amount.toFixed(3)}
        </span>
      )}
      {need402 && (
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
          402 ${d.payment?.amount.toFixed(3)}
        </span>
      )}
      {!settled && !need402 && d.price > 0 && (
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/60">${d.price.toFixed(3)}</span>
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
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">Bring your own API</h2>
      <p className="mt-1 text-sm text-white/45">
        Point TrustMCP at any existing HTTPS API. It becomes a{" "}
        <span className="text-white/75">trust-gated, x402-monetized</span> endpoint — agents are scored
        by Valiron and charged per call <span className="text-white/75">before</span> your origin is ever
        hit. Zero code changes.
      </p>

      <div className="mt-5 space-y-3">
        {items.map((u) => (
          <UpstreamCard key={u.id} u={u} origin={origin} onRemove={remove} />
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Register an API</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]">
          <input
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="My API" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-sky-400/50"
          />
          <input
            value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.example.com" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none placeholder:text-white/25 focus:border-sky-400/50"
          />
          <input
            value={form.pricePerCall} onChange={(e) => setForm({ ...form, pricePerCall: e.target.value })}
            placeholder="$/call" title="USD per call (0 = free)" className="w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/50"
          />
          <input
            value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })}
            placeholder="minScore" title="Minimum Valiron score" className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400/50"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add} disabled={adding || !form.name || !form.baseUrl}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
          >
            {adding ? "Registering…" : "Protect this API"}
          </button>
          {err && <span className="text-xs text-rose-300">{err}</span>}
          <span className="ml-auto text-xs text-white/30">HTTPS public hosts only — SSRF-guarded</span>
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

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{u.name}</span>
        <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
          {u.pricePerCall > 0 ? `$${u.pricePerCall.toFixed(2)}/call` : "free"}
        </span>
        <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/55">
          min score {u.minScore}
        </span>
        {u.builtin && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/35">live demo</span>}
        {!u.builtin && (
          <button onClick={() => onRemove(u.id)} className="ml-auto text-xs text-white/30 transition hover:text-rose-300">
            remove
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/45">{u.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white/75">
          {gateway}<span className="text-white/35">{"/<path>"}</span>
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(gateway); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="rounded-md border border-white/15 bg-black/50 px-2.5 py-2 text-xs text-white/60 transition hover:text-white"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={path} onChange={(e) => setPath(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs outline-none focus:border-sky-400/50"
        />
        <button
          onClick={() => test("aaa-trusted-agent", true)} disabled={!!busy}
          className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
        >
          {busy === "aaa-trusted-agent" ? "…" : "test as AAA agent"}
        </button>
        <button
          onClick={() => test("low-trust-scraper", false)} disabled={!!busy}
          className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
        >
          {busy === "low-trust-scraper" ? "…" : "test as scraper"}
        </button>
      </div>

      {out && (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-white/50">{out.agent}</span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${out.status >= 200 && out.status < 300 ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
              HTTP {out.status || "ERR"}
            </span>
          </div>
          <pre className="mt-1 max-h-44 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-white/70">
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
