"use client";

import { useState } from "react";
import { useGateway } from "./store";
import { CountUp, FeedRow } from "./ui";

type Filter = "all" | "allow" | "deny" | "paid";

export function Activity() {
  const g = useGateway();
  const [filter, setFilter] = useState<Filter>("all");
  const [demoBusy, setDemoBusy] = useState(false);

  const filtered = g.decisions.filter((d) => {
    if (filter === "allow") return d.allow;
    if (filter === "deny") return !d.allow;
    if (filter === "paid") return d.payment?.state === "settled";
    return true;
  });

  const { calls, allowed, blocked, paid, revenue } = g.stats;
  const blockRate = calls ? Math.round((blocked / calls) * 100) : 0;

  async function runDemo() {
    if (demoBusy) return;
    setDemoBusy(true);
    try { await g.runSampleTraffic(); } finally { setDemoBusy(false); }
  }

  return (
    <section className="section" id="activity">
      <div className="shell">
        <div className="between wrap" style={{ gap: 16 }}>
          <div>
            <span className="eyebrow"><span className="dot" /> OBSERVABILITY</span>
            <h2 className="h-sec">Live activity.</h2>
          </div>
          <div className="row gap-12 wrap">
            <p className="sub hide-sm" style={{ fontSize: 14, maxWidth: "34ch" }}>
              Every allow / deny / paid decision, streamed in real time. The dashboard is the proof — the integration is one line.
            </p>
            <button className="btn btn-primary" onClick={runDemo} disabled={demoBusy}>
              {demoBusy ? "Running…" : "▸ Run sample traffic"}
            </button>
          </div>
        </div>

        <div className="stat-grid" style={{ marginTop: 24 }}>
          <Stat label="Calls gated" value={calls} color="var(--text)" />
          <Stat label="Allowed" value={allowed} color="var(--green)" />
          <Stat label="Blocked" value={blocked} color="var(--red)" sub={blockRate + "% block rate"} />
          <Stat label="Paid (x402)" value={paid} color="var(--amber)" />
          <Stat label="Revenue · USDC" value={revenue} color="var(--accent-bright)" money />
        </div>

        <div className="panel mt-24" style={{ overflow: "hidden" }}>
          <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="row gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
              <span className="live-dot" style={{ background: g.streaming ? "var(--green)" : "var(--text-3)" }} />
              Decision log
            </span>
            <div className="row gap-12">
              <div className="seg">
                {(["all", "allow", "deny", "paid"] as Filter[]).map((f) => (
                  <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => g.setStreaming(!g.streaming)}>
                {g.streaming ? "⏸ Pause" : "▸ Resume"}
              </button>
            </div>
          </div>

          <div className="feed-row dimmer mono hide-sm" style={{ gridTemplateColumns: "96px minmax(0,1.4fr) minmax(0,1.6fr) auto", fontSize: 10, letterSpacing: "0.08em", borderBottom: "1px solid var(--line)", animation: "none" }}>
            <span>VERDICT</span><span>AGENT → ENDPOINT</span><span>REASON</span><span style={{ textAlign: "right" }}>TIER · PAY</span>
          </div>

          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {filtered.slice(0, 40).map((d) => <FeedRow key={d.id} d={d} />)}
            {filtered.length === 0 && <div className="center dim mono" style={{ height: 120, fontSize: 13 }}>no {filter} decisions yet</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color, sub, money }: { label: string; value: number; color: string; sub?: string; money?: boolean }) {
  return (
    <div className="stat">
      <div className="num" style={{ color }}>
        {money && <span style={{ fontSize: 22, verticalAlign: "top", opacity: 0.7 }}>$</span>}
        <CountUp value={money ? Math.round(value * 100) / 100 : value} decimals={money ? 2 : 0} />
      </div>
      <div className="lbl">{label}</div>
      {sub && <div className="mono dimmer" style={{ fontSize: 10.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
