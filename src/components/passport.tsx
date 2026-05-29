"use client";

import { useState } from "react";
import { useGateway, type AgentPassport } from "./store";
import { RoutePill, TierBadge } from "./ui";

export function PassportPanel() {
  const g = useGateway();
  const [agentId, setAgentId] = useState("aaa-trusted-agent");
  const [passport, setPassport] = useState<AgentPassport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setErr(null);
    setPassport(null);
    const p = await g.inspect(agentId.trim());
    setBusy(false);
    if (!p) setErr("Could not load passport");
    else setPassport(p);
  }

  return (
    <section className="section" id="passport">
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> VALIRON · AGENT PASSPORT</span>
        <h2 className="h-sec">Inspect any agent&apos;s reputation.</h2>
        <p className="sub">
          Full ERC-8004 on-chain history, behavioral sandbox tier, World ID proof-of-personhood, and Icebreaker handles — the same signals the gate uses before every call.
        </p>

        <div className="passport-grid mt-24">
          <div className="panel" style={{ padding: 18 }}>
            <span className="label">Agent ID</span>
            <div className="row gap-10 mt-8">
              <input
                className="input grow"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                list="agent-ids"
              />
              <datalist id="agent-ids">
                {g.agents.map((a) => (
                  <option key={a.id} value={a.id} />
                ))}
              </datalist>
              <button className="btn btn-primary" onClick={lookup} disabled={busy || !agentId.trim()}>
                {busy ? "Loading…" : "Inspect"}
              </button>
            </div>
            <div className="col gap-8 mt-16">
              {g.agents.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="btn btn-quiet btn-sm"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => { setAgentId(a.id); }}
                >
                  {a.id}
                </button>
              ))}
            </div>
            {err && <p className="mono mt-12" style={{ color: "var(--red)", fontSize: 12 }}>{err}</p>}
          </div>

          <div className="panel" style={{ padding: 18, minHeight: 280 }}>
            {!passport && !busy && (
              <div className="center dim mono" style={{ height: 240, fontSize: 13 }}>
                enter an agent id and inspect →
              </div>
            )}
            {busy && <div className="center dim mono" style={{ height: 240, fontSize: 13 }}>fetching from Valiron…</div>}
            {passport && <PassportCard p={passport} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function PassportCard({ p }: { p: AgentPassport }) {
  return (
    <div className="fade-in">
      <div className="between wrap" style={{ gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 14, color: "var(--text)" }}>{p.agentId}</div>
          {p.name && <div className="dim mt-4" style={{ fontSize: 13 }}>{p.name}</div>}
        </div>
        <div className="row gap-8">
          <span className="pill" style={{ color: p.source === "live" ? "var(--green)" : "var(--text-2)" }}>
            {p.source === "live" ? "LIVE API" : "MOCK PROFILE"}
          </span>
          <TierBadge tier={p.tier} score={p.score} showScore />
          <RoutePill route={p.route} />
        </div>
      </div>

      <div className="signal-grid mt-24">
        <Signal title="On-chain (ERC-8004)" ok={p.signals.onchain.present}>
          {p.signals.onchain.present
            ? `${p.signals.onchain.feedbackCount} feedback · avg ${p.signals.onchain.averageScore}`
            : "no on-chain reputation"}
        </Signal>
        <Signal title="Behavioral sandbox" ok={p.signals.sandbox.present}>
          {p.signals.sandbox.present
            ? `tier ${p.signals.sandbox.tier ?? "—"} · graduated ${String(p.signals.sandbox.graduated)}`
            : "not sandboxed"}
        </Signal>
        <Signal title="World ID" ok={p.signals.worldId.verified}>
          {p.signals.worldId.verified
            ? `verified · ${p.signals.worldId.level ?? "—"}`
            : "not verified"}
        </Signal>
        <Signal title="Icebreaker" ok={p.signals.icebreaker.present}>
          {p.signals.icebreaker.handles.length
            ? p.signals.icebreaker.handles.join(", ")
            : "no linked handles"}
        </Signal>
      </div>

      {p.wallet && (
        <div className="mono dim mt-16" style={{ fontSize: 11 }}>
          wallet · {p.wallet} · {p.chain}
        </div>
      )}

      <ul className="mono mt-16" style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--text-1)", lineHeight: 1.65 }}>
        {p.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

function Signal({ title, ok, children }: { title: string; ok: boolean; children: React.ReactNode }) {
  return (
    <div
      className="panel"
      style={{
        padding: 12,
        borderColor: ok ? "var(--green-line)" : "var(--line-soft)",
        background: ok ? "var(--green-bg)" : "var(--bg-1)",
      }}
    >
      <div className="mono dimmer" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      <div className="mt-8" style={{ fontSize: 12.5, color: "var(--text-1)" }}>{children}</div>
    </div>
  );
}
