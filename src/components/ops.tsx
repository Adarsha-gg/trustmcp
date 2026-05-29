"use client";

import { useGateway, type IncidentMode } from "./store";

const INCIDENT_OPTS: { id: IncidentMode; label: string; desc: string }[] = [
  { id: "normal", label: "Normal", desc: "Full pipeline — trust, guardrails, x402, execute." },
  { id: "read_only", label: "Read-only", desc: "Only public GREEN tools (search, market, weather)." },
  { id: "fail_closed", label: "Kill switch", desc: "Fail-closed — deny every call immediately." },
];

export function OpsPanel() {
  const g = useGateway();

  return (
    <section className="section" id="ops" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> OPERATOR · INCIDENT</span>
        <h2 className="h-sec" style={{ fontSize: 26 }}>Gateway controls.</h2>

        <div className="ops-grid mt-24">
          <div className="panel" style={{ padding: 18 }}>
            <span className="label">Runtime</span>
            <div className="col gap-12 mt-12">
              <Row k="Trust mode" v={g.mode} />
              <Row k="Chain" v={g.chain} />
              <Row
                k="Valiron operator"
                v={g.operator ? "ENABLED · billing active" : "disabled · local trust layer"}
                c={g.operator ? "var(--green)" : "var(--text-2)"}
              />
              {!g.operator && (
                <p className="dimmer mono" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                  Set <code style={{ color: "var(--accent-bright)" }}>VALIRON_OPERATOR_KEY</code> to log billable usage to your Valiron dashboard.
                </p>
              )}
            </div>
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <span className="label">Incident mode</span>
            <div className="col gap-10 mt-12">
              {INCIDENT_OPTS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={"chip" + (g.incident === o.id ? " sel" : "")}
                  onClick={() => g.setIncident(o.id)}
                  style={{ textAlign: "left" }}
                >
                  <div className="between">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{o.label}</span>
                    {g.incident === o.id && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                  </div>
                  <span className="dim" style={{ fontSize: 12 }}>{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <span className="label">Red team</span>
            <p className="dim mt-8" style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 16 }}>
              Unleash 16 hostile agents hammering dangerous tools plus a few trusted callers — watch the gate hold the line and the guardrails feed light up.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => g.runAttackWave()}
              disabled={g.attackBusy}
              type="button"
            >
              {g.attackBusy ? "Attack wave running…" : "▸ Launch attack wave"}
            </button>
            {g.lastAttack && (
              <p className="mono mt-12" style={{ fontSize: 12, color: "var(--text-1)" }}>
                last wave · {g.lastAttack.total} calls ·{" "}
                <span style={{ color: "var(--green)" }}>{g.lastAttack.allowed} allowed</span>
                {" · "}
                <span style={{ color: "var(--red)" }}>{g.lastAttack.blocked} blocked</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="between">
      <span className="mono dimmer" style={{ fontSize: 11 }}>{k}</span>
      <span className="mono" style={{ fontSize: 12, color: c ?? "var(--text)" }}>{v}</span>
    </div>
  );
}
