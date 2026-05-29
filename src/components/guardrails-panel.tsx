"use client";

import { useEffect } from "react";
import { useGateway } from "./store";
const TYPE_COLOR: Record<string, string> = {
  injection: "var(--red)",
  budget: "var(--amber)",
  velocity: "var(--amber)",
  burst: "var(--red)",
  quarantine: "var(--red)",
};

export function GuardrailsPanel() {
  const g = useGateway();

  useEffect(() => {
    g.refreshGuardrails();
    const id = setInterval(() => g.refreshGuardrails(), 2500);
    return () => clearInterval(id);
  }, [g.refreshGuardrails]);

  const snap = g.guardrails;
  const policy = snap?.policy;

  return (
    <section className="section" id="guardrails">
      <div className="shell">
        <div className="between wrap" style={{ gap: 16 }}>
          <div>
            <span className="eyebrow"><span className="dot" /> BEHAVIORAL POLICING</span>
            <h2 className="h-sec">Guardrails & live alerts.</h2>
            <p className="sub" style={{ maxWidth: "52ch" }}>
              Trusted agents that go rogue mid-session — prompt injection, budget drain, velocity spikes — are caught here before the upstream ever runs.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => g.resetGuardrails()} type="button">
            Reset state
          </button>
        </div>

        {policy && (
          <div className="row wrap gap-10 mt-24">
            <PolicyChip label="Budget cap" value={`$${policy.budgetUsd}`} />
            <PolicyChip label="Velocity" value={`$${policy.velocityUsd} / min`} />
            <PolicyChip label="Burst" value={`${policy.burstMax} RED / min`} />
            <PolicyChip label="Quarantine" value={`${Math.round(policy.quarantineMs / 60000)} min`} />
          </div>
        )}

        <div className="guardrails-grid mt-24">
          <div className="panel" style={{ padding: 16, overflow: "hidden" }}>
            <span className="label">Per-agent spend meters</span>
            <div className="mt-12 col gap-10">
              {(snap?.agents ?? []).length === 0 && (
                <span className="dim mono" style={{ fontSize: 12 }}>no tracked agents yet — run traffic</span>
              )}
              {(snap?.agents ?? []).map((a) => (
                <div key={a.agentId}>
                  <div className="between mono" style={{ fontSize: 11.5, marginBottom: 4 }}>
                    <span className="tcell" style={{ maxWidth: "55%" }}>{a.agentId}</span>
                    <span style={{ color: a.quarantined ? "var(--red)" : "var(--text-2)" }}>
                      {a.quarantined ? "QUARANTINED" : `$${a.spend.toFixed(3)} · ${a.budgetPct}%`}
                    </span>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${a.budgetPct}%`,
                        background: a.budgetPct >= 90 ? "var(--red)" : a.budgetPct >= 70 ? "var(--amber)" : "var(--green)",
                      }}
                    />
                  </div>
                  {a.violations > 0 && (
                    <span className="mono dimmer" style={{ fontSize: 10 }}>{a.violations} violation{a.violations !== 1 ? "s" : ""}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 0, overflow: "hidden", maxHeight: 420 }}>
            <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
              <span className="label" style={{ margin: 0 }}>Live violation alerts</span>
              <span className="live-dot" />
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {(snap?.alerts ?? []).length === 0 && (
                <div className="center dim mono" style={{ height: 120, fontSize: 12 }}>no violations yet</div>
              )}
              {(snap?.alerts ?? []).map((v) => (
                <div key={v.id} className="alert-row">
                  <span className="mono" style={{ fontSize: 10, color: TYPE_COLOR[v.type] ?? "var(--text-2)" }}>
                    {v.type.toUpperCase()}
                  </span>
                  <span className="mono tcell" style={{ fontSize: 11, color: "var(--text-1)" }}>{v.agentId}</span>
                  <span className="mono dim tcell" style={{ fontSize: 11 }}>{v.tool}</span>
                  <span className="dim" style={{ fontSize: 11, lineHeight: 1.35 }}>{v.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicyChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="pill" style={{ padding: "6px 12px" }}>
      <span className="dimmer mono" style={{ fontSize: 10, marginRight: 6 }}>{label}</span>
      <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{value}</span>
    </span>
  );
}
