"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGateway, type Decision } from "./store";
import { RiskDot, RoutePill, TierBadge, fmt, shortHash } from "./ui";

const PIPE_STEPS = [
  { n: "01", name: "Identity", desc: "who is this agent?" },
  { n: "02", name: "Valiron Trust", desc: "score ≥ minScore?" },
  { n: "03", name: "Guardrails", desc: "injection / budget / velocity" },
  { n: "04", name: "x402 Payment", desc: "paid? settle, trust-priced" },
  { n: "05", name: "Run / Forward", desc: "execute or proxy" },
];

// Display-only score hints for the canned personas (mirror the backend mock).
const SCORE_HINT: Record<string, number> = {
  "aaa-trusted-agent": 96, "a-tier-research-bot": 82, "hijacked-agent": 92, "broke-agent": 74,
  "b-tier-bot": 54, "low-trust-scraper": 38, "malicious-drainer": 9,
};
const TAG: Record<string, string> = {
  "unknown-newcomer": "PENDING", "hijacked-agent": "HIJACKED", "broke-agent": "NO FUNDS", "malicious-drainer": "FLAGGED",
};

function tierFromScore(s: number): string {
  if (s >= 95) return "AAA"; if (s >= 88) return "AA"; if (s >= 80) return "A"; if (s >= 70) return "BAA";
  if (s >= 60) return "BA"; if (s >= 50) return "B"; if (s >= 35) return "CAA"; if (s >= 20) return "CA"; return "C";
}
function stopStep(d: Decision): number {
  switch (d.blockedBy) {
    case "pending-eval": return 0;
    case "trust-gate": return 1;
    case "tool-policy": return 1;
    case "guardrail": return 2;
    case "payment-required": return 3;
    default: return 4;
  }
}

type Target = { id: string; name: string; kind: "tool" | "api"; minScore: number; price: number; risk: string };

export function Simulator() {
  const g = useGateway();
  const [agentId, setAgentId] = useState("aaa-trusted-agent");
  const [targetKey, setTargetKey] = useState<string>("");
  const [phase, setPhase] = useState(-1);
  const [result, setResult] = useState<Decision | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const targets = useMemo<Target[]>(() => {
    const tools: Target[] = g.tools.map((t) => ({ id: t.name, name: t.name, kind: "tool", minScore: t.minScore, price: t.basePrice, risk: t.risk }));
    const apis: Target[] = g.upstreams.map((u) => ({ id: u.id, name: u.name, kind: "api", minScore: u.minScore, price: u.pricePerCall, risk: u.minScore >= 70 ? "YELLOW" : "GREEN" }));
    return [...tools, ...apis];
  }, [g.tools, g.upstreams]);

  useEffect(() => {
    if (!targetKey && targets.length) setTargetKey(targets[0].kind + ":" + targets[0].id);
  }, [targets, targetKey]);

  const target = targets.find((t) => t.kind + ":" + t.id === targetKey) ?? targets[0];

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  function reset() { setResult(null); setPhase(-1); clearTimers(); }

  async function fire() {
    if (!target) return;
    clearTimers();
    setRunning(true);
    setResult(null);
    setPhase(0);
    const resp = await g.gate(agentId, target.kind, target.id);
    if (!resp) { setRunning(false); setPhase(-1); return; }
    const d = resp.decision;
    const stop = stopStep(d);
    let delay = 0;
    for (let i = 0; i <= stop; i++) {
      timers.current.push(setTimeout(() => setPhase(i), delay));
      delay += 480;
    }
    timers.current.push(setTimeout(() => {
      setResult(d);
      setPhase(99);
      setRunning(false);
    }, delay + 160));
  }

  function stepState(i: number) {
    if (phase === -1 && !result) return "idle";
    const stop = result ? stopStep(result) : 99;
    if (phase === 99 && result) {
      if (i < stop) return "pass";
      if (i === stop) return result.allow ? "pass" : "fail";
      return "skip";
    }
    if (i === phase) return "active";
    if (i < phase) return "pass";
    return "idle";
  }

  return (
    <section className="section" id="sim">
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> THE GATE · INTERACTIVE</span>
        <h2 className="h-sec">Watch the gate decide.</h2>
        <p className="sub">Pick an agent, point it at a tool or your API, and fire a real request. Every call runs the same five checks — and is rejected at the first one it fails.</p>

        <div className="sim-grid">
          <div className="col gap-16">
            <div className="panel" style={{ padding: 16 }}>
              <span className="label">Calling agent</span>
              <div className="col gap-8" style={{ maxHeight: 320, overflowY: "auto", marginTop: 4 }}>
                {g.agents.map((a) => {
                  const score = SCORE_HINT[a.id];
                  const pending = a.id === "unknown-newcomer";
                  const tag = TAG[a.id];
                  return (
                    <button key={a.id} className={"chip" + (a.id === agentId ? " sel" : "")} onClick={() => { setAgentId(a.id); reset(); }}>
                      <div className="between">
                        <span className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{a.id}</span>
                        {pending ? <TierBadge tier="—" /> : score != null ? <TierBadge tier={tierFromScore(score)} score={score} showScore /> : null}
                      </div>
                      <div className="dim" style={{ fontSize: 11.5 }}>{a.blurb}</div>
                      {tag && <span className="tier-badge tier-red" style={{ fontSize: 9, padding: "1px 5px", alignSelf: "flex-start" }}>{tag}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col gap-16">
            <div className="panel" style={{ padding: 16 }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <span className="label" style={{ margin: 0 }}>Target endpoint</span>
                <span className="mono dimmer" style={{ fontSize: 11 }}>min score · price</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {targets.map((t) => {
                  const key = t.kind + ":" + t.id;
                  return (
                    <div key={key} className={"tool-row" + (key === targetKey ? " sel" : "")} onClick={() => { setTargetKey(key); reset(); }}>
                      <div className="row gap-8" style={{ minWidth: 0 }}>
                        <RiskDot level={t.risk} />
                        <span className="mono tcell" style={{ fontSize: 12.5 }}>{t.name}</span>
                        {t.kind === "api" && <span className="tier-badge" style={{ borderColor: "var(--accent-line)", color: "var(--accent-bright)", background: "var(--accent-bg)", fontSize: 8.5, padding: "1px 4px" }}>API</span>}
                      </div>
                      <div className="row gap-8" style={{ flex: "none" }}>
                        <span className="mono dimmer" style={{ fontSize: 11 }}>≥{t.minScore}</span>
                        <span className="mono" style={{ fontSize: 11, color: t.price > 0 ? "var(--amber)" : "var(--text-3)" }}>{t.price > 0 ? fmt(t.price) : "free"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="between mt-16">
                <div className="mono dim" style={{ fontSize: 12, minWidth: 0 }}>
                  <span style={{ color: "var(--text-1)" }}>{agentId}</span>
                  <span className="dimmer"> → </span>
                  <span style={{ color: "var(--text)" }}>{target?.name}</span>
                </div>
                <button className="btn btn-primary" onClick={fire} disabled={running || !target}>
                  {running ? "Gating…" : "▸ Send request"}
                </button>
              </div>
            </div>

            <div className="panel" style={{ padding: 18 }}>
              <div className="pipe-grid">
                {PIPE_STEPS.map((s, i) => {
                  const st = stepState(i);
                  return (
                    <div key={s.n} className={"pipe-step " + st}>
                      <div className="between">
                        <span className="step-num">{s.n}</span>
                        <StepMark state={st} />
                      </div>
                      <div className="step-name">{s.name}</div>
                      <div className="step-desc">{s.desc}</div>
                    </div>
                  );
                })}
              </div>
              <Verdict result={result} basePrice={target?.price ?? 0} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepMark({ state }: { state: string }) {
  if (state === "pass") return <span style={{ color: "var(--green)", fontSize: 13 }}>✓</span>;
  if (state === "fail") return <span style={{ color: "var(--red)", fontSize: 13 }}>✕</span>;
  if (state === "active") return <span className="live-dot" style={{ background: "var(--accent)", width: 6, height: 6 }} />;
  return <span style={{ color: "var(--text-3)", fontSize: 13 }}>·</span>;
}

const BLOCK_STEP: Record<string, string> = {
  "trust-gate": "Valiron Trust", "tool-policy": "Policy", "guardrail": "Guardrails",
  "payment-required": "x402 Payment", "pending-eval": "Identity",
};
const BLOCK_LABEL: Record<string, string> = {
  "trust-gate": "TRUST GATE", "tool-policy": "TOOL POLICY", "guardrail": "GUARDRAIL",
  "payment-required": "402 UNPAID", "pending-eval": "SANDBOX",
};

function Verdict({ result, basePrice }: { result: Decision | null; basePrice: number }) {
  if (!result) {
    return (
      <div className="center dim mono" style={{ minHeight: 92, marginTop: 16, fontSize: 13, border: "1px dashed var(--line-soft)", borderRadius: 8 }}>
        awaiting request — pick an agent + endpoint, then ▸ Send
      </div>
    );
  }
  const ok = result.allow;
  const pay = result.payment;
  return (
    <div className="fade-in mt-16" style={{ display: "grid", gridTemplateColumns: pay ? "1fr 320px" : "1fr", gap: 14 }}>
      <div style={{ borderRadius: 10, padding: "16px 18px", border: "1px solid " + (ok ? "var(--green-line)" : "var(--red-line)"), background: ok ? "var(--green-bg)" : "var(--red-bg)" }}>
        <div className="between">
          <span className={"verdict " + (ok ? "allow" : "deny")} style={{ fontSize: 15 }}>{ok ? "▸ ALLOWED" : "■ DENIED"}</span>
          <div className="row gap-8">
            <RoutePill route={result.route} />
            <TierBadge tier={result.tier} score={result.score} showScore />
          </div>
        </div>
        {result.blockedBy && (
          <div className="mt-12">
            <span className="tier-badge tier-red" style={{ fontSize: 10 }}>BLOCKED BY · {BLOCK_LABEL[result.blockedBy] ?? result.blockedBy}</span>
            <span className="dimmer mono" style={{ fontSize: 11, marginLeft: 8 }}>at step {BLOCK_STEP[result.blockedBy] ?? "—"}</span>
          </div>
        )}
        <ul className="mono" style={{ margin: "12px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--text-1)", lineHeight: 1.7 }}>
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div className="mono dimmer mt-12" style={{ fontSize: 10.5 }}>
          {ok ? "application/json · 200 OK" : "application/problem+json · " + (result.blockedBy === "payment-required" ? "402 Payment Required" : "403 Forbidden")}
          {!ok && " · Retry-After: 30"}
        </div>
      </div>
      {pay && <X402Receipt amount={pay.amount} settled={pay.state === "settled"} txHash={pay.txHash} basePrice={basePrice} />}
    </div>
  );
}

function X402Receipt({ amount, settled, txHash, basePrice }: { amount: number; settled: boolean; txHash?: string; basePrice: number }) {
  const mult = basePrice > 0 ? amount / basePrice : 1;
  return (
    <div className="receipt" style={{ borderColor: settled ? "var(--amber-line)" : "var(--red-line)" }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.04em", color: settled ? "var(--amber)" : "var(--red)" }}>{settled ? "◇ x402 RECEIPT" : "✕ 402 CHALLENGE"}</span>
        <span className="dimmer">USDC</span>
      </div>
      <Line k="list price" v={fmt(basePrice)} />
      {mult > 1.05 && <Line k="trust surcharge" v={"×" + mult.toFixed(1)} c="var(--amber)" />}
      <Line k="charged" v={fmt(amount)} c={settled ? "var(--text)" : "var(--red)"} strong />
      <div style={{ borderTop: "1px dashed var(--line)", margin: "10px 0" }} />
      {settled ? (
        <>
          <Line k="status" v="SETTLED" c="var(--green)" />
          <Line k="tx" v={shortHash(txHash)} c="var(--text-1)" />
        </>
      ) : (
        <Line k="status" v="WALLET UNFUNDED" c="var(--red)" />
      )}
    </div>
  );
}

function Line({ k, v, c, strong }: { k: string; v: string; c?: string; strong?: boolean }) {
  return (
    <div className="between" style={{ fontSize: 12, padding: "2px 0" }}>
      <span className="dimmer">{k}</span>
      <span style={{ color: c ?? "var(--text-1)", fontWeight: strong ? 700 : 500 }}>{v}</span>
    </div>
  );
}
