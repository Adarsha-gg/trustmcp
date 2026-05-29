"use client";

import { useEffect, useState } from "react";
import { useGateway, type GateResponse, type Upstream } from "./store";
import { CopyBtn, RiskDot, fmt, shortHash } from "./ui";

export function ByoApi() {
  const g = useGateway();
  return (
    <section className="section" id="byo">
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> REVERSE PROXY · ZERO CODE</span>
        <h2 className="h-sec">Bring your own API.</h2>
        <p className="sub">Register any HTTPS API by URL. TrustMCP becomes an SSRF-guarded reverse proxy in front of it — agents hit your gateway URL, we trust-check, charge, and forward to your origin. Instant monetization and protection.</p>

        <div className="byo-grid">
          <div className="col gap-12">
            {g.upstreams.map((u) => <UpstreamCard key={u.id} u={u} />)}
            {g.upstreams.length === 0 && (
              <div className="panel center dim mono" style={{ height: 120, fontSize: 13 }}>no APIs registered yet — add one →</div>
            )}
          </div>
          <RegisterForm />
        </div>
      </div>
    </section>
  );
}

function UpstreamCard({ u }: { u: Upstream }) {
  const g = useGateway();
  const [test, setTest] = useState<{ agent: string; resp: GateResponse } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://gate.trustmcp.io");
  useEffect(() => setOrigin(window.location.origin), []);
  const gwUrl = origin + "/api/gateway/" + u.id;

  async function runTest(agent: string) {
    setBusy(agent);
    setTest(null);
    const resp = await g.gate(agent, "api", u.id);
    if (resp) setTest({ agent, resp });
    setBusy(null);
  }

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="between wrap" style={{ gap: 10 }}>
        <div className="row gap-10" style={{ flex: 1, minWidth: 0 }}>
          <RiskDot level={u.minScore >= 70 ? "YELLOW" : "GREEN"} />
          <div style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</span>
              {u.builtin && <span className="pill" style={{ fontSize: 10 }}>built-in</span>}
            </div>
            <div className="mono dim tcell" style={{ fontSize: 12, marginTop: 2 }}>{u.baseUrl}</div>
          </div>
        </div>
        <div className="row gap-16" style={{ flex: "none" }}>
          <Meta k="PRICE/CALL" v={u.pricePerCall > 0 ? fmt(u.pricePerCall) : "free"} />
          <Meta k="MIN SCORE" v={"≥ " + u.minScore} />
          {!u.builtin && (
            <button className="btn btn-quiet btn-sm" onClick={() => g.removeUpstream(u.id)}>Remove</button>
          )}
        </div>
      </div>

      <div className="between mt-12" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 8, padding: "8px 12px" }}>
        <span className="mono tcell" style={{ fontSize: 12, color: "var(--accent-bright)" }}>{gwUrl}/&lt;path&gt;</span>
        <CopyBtn text={gwUrl} label="Copy URL" />
      </div>

      <div className="row gap-8 mt-12 wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => runTest("aaa-trusted-agent")} disabled={!!busy}>
          {busy === "aaa-trusted-agent" ? "Testing…" : "Test as AAA agent"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => runTest("low-trust-scraper")} disabled={!!busy}>
          {busy === "low-trust-scraper" ? "Testing…" : "Test as scraper"}
        </button>
      </div>

      {test && <TestResponse agent={test.agent} resp={test.resp} />}
    </div>
  );
}

function TestResponse({ agent, resp }: { agent: string; resp: GateResponse }) {
  const d = resp.decision;
  const ok = d.allow;
  const status = resp.http?.status ?? (ok ? 200 : d.blockedBy === "payment-required" ? 402 : 403);
  const body = ok
    ? { status, route: d.route, forwarded: true, tier: d.tier, ...(d.payment ? { paid: fmt(d.payment.amount), tx: shortHash(d.payment.txHash) } : {}), upstream: tryPreview(resp.http?.bodyPreview) }
    : { status, type: "trustmcp/" + d.blockedBy, title: d.reasons[0], score: d.score, tier: d.tier, retryAfter: 30 };
  return (
    <pre className="code fade-in mt-12" style={{ margin: 0, fontSize: 11.5, borderColor: ok ? "var(--green-line)" : "var(--red-line)", background: ok ? "oklch(0.20 0.03 150 / 0.4)" : "oklch(0.21 0.04 25 / 0.4)" }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <span className={"verdict " + (ok ? "allow" : "deny")}>{ok ? "▸ 200 ALLOW" : status === 402 ? "◇ 402 PAY" : "■ 403 DENY"} · {agent}</span>
        <span className="dimmer">{ok ? "application/json" : "application/problem+json"}</span>
      </div>
      <code>{JSON.stringify(body, null, 2)}</code>
    </pre>
  );
}

function tryPreview(s?: string): unknown {
  if (!s) return undefined;
  try { return JSON.parse(s); } catch { return s.slice(0, 200); }
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="mono dimmer" style={{ fontSize: 10, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{k}</div>
      <div className="mono" style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

function RegisterForm() {
  const g = useGateway();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("0.02");
  const [minScore, setMinScore] = useState(60);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && /^https?:\/\/.+/.test(url.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setErr(null);
    setBusy(true);
    const res = await g.addUpstream({ name: name.trim(), baseUrl: url.trim(), pricePerCall: parseFloat(price) || 0, minScore: Number(minScore) });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed"); return; }
    setName(""); setUrl("");
  }

  return (
    <form className="panel" style={{ padding: 18, position: "sticky", top: 76 }} onSubmit={submit}>
      <span className="eyebrow" style={{ fontSize: 11 }}><span className="dot" /> REGISTER AN API</span>
      <div className="col gap-12 mt-16">
        <div>
          <label className="label">Name</label>
          <input className="input" placeholder="Acme Inventory API" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Base URL</label>
          <input className="input" placeholder="https://api.acme.io/v1" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="row gap-12">
          <div className="grow">
            <label className="label">Price / call</label>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grow">
            <label className="label">Min score · {minScore}</label>
            <input type="range" min="0" max="95" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)", marginTop: 10 }} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={!valid || busy} style={{ justifyContent: "center" }}>
          {busy ? "Registering…" : "+ Register & proxy"}
        </button>
        {err && <span className="mono" style={{ fontSize: 11, color: "var(--red)" }}>{err}</span>}
        <p className="dimmer mono" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
          SSRF-guarded · HTTPS only · no code changes · live the moment you submit.
        </p>
      </div>
    </form>
  );
}
