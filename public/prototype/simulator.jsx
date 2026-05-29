/* ============================================================
   TrustMCP — interactive simulator (fire call → animate gate)
   ============================================================ */

const PIPE_STEPS = [
  { n: "01", name: "Identity",      desc: "who is this agent?" },
  { n: "02", name: "Valiron Trust", desc: "score ≥ minScore?" },
  { n: "03", name: "Guardrails",    desc: "injection / budget / velocity" },
  { n: "04", name: "x402 Payment",  desc: "paid? settle, trust-priced" },
  { n: "05", name: "Run / Forward", desc: "execute or proxy" },
];

function Simulator() {
  const g = window.useGateway();
  const T = window.TMCP;

  const [agentId, setAgentId] = React.useState("aaa-trusted-agent");
  const [targetName, setTargetName] = React.useState("get_market_data");
  const [phase, setPhase] = React.useState(-1);   // active step index while animating; -1 idle
  const [result, setResult] = React.useState(null);
  const [running, setRunning] = React.useState(false);
  const timers = React.useRef([]);

  const agent = T.AGENTS.find((a) => a.id === agentId);
  const allTargets = [...T.TOOLS, ...g.upstreams.map(T.upstreamTarget)];
  const target = allTargets.find((t) => t.name === targetName) || T.TOOLS[0];
  const aTier = T.tierFromScore(agent.score);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  React.useEffect(() => () => clearTimers(), []);

  function fire() {
    clearTimers();
    setRunning(true);
    setResult(null);
    setPhase(-1);
    const d = T.decide(agent, target, { source: "manual" });
    const stop = T.stopStep(d);
    // animate through steps up to the stop point
    let delay = 220;
    for (let i = 0; i <= stop; i++) {
      timers.current.push(setTimeout(() => setPhase(i), delay));
      delay += 520;
    }
    timers.current.push(setTimeout(() => {
      setResult(d);
      setPhase(99);
      setRunning(false);
      g.push(d);
    }, delay + 180));
  }

  // step state for rendering
  function stepState(i) {
    if (phase === -1 && !result) return "idle";
    const stop = result ? T.stopStep(result) : 99;
    if (phase === 99 && result) {
      if (i < stop) return "pass";
      if (i === stop) return result.allow ? "pass" : "fail";
      return "skip";
    }
    // animating
    if (i === phase) return "active";
    if (i < phase) return "pass";
    return "idle";
  }

  return (
    <section className="section" id="sim">
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> THE GATE · INTERACTIVE</span>
        <h2 className="h-sec">Watch the gate decide.</h2>
        <p className="sub">Pick an agent, point it at an endpoint, and fire. Every call flows through the same five checks — and is rejected at the first one it fails.</p>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginTop: 28 }}>
          {/* ---- control rail ---- */}
          <div className="col gap-16">
            <div className="panel" style={{ padding: 16 }}>
              <span className="label">Calling agent</span>
              <div className="col gap-8" style={{ maxHeight: 280, overflowY: "auto", marginTop: 4 }}>
                {T.AGENTS.map((a) => {
                  const ti = T.tierFromScore(a.score);
                  const tag = a.pending ? "PENDING" : a.hijacked ? "HIJACKED" : a.broke ? "NO FUNDS" : null;
                  return (
                    <button key={a.id} className={"chip" + (a.id === agentId ? " sel" : "")} onClick={() => { setAgentId(a.id); setResult(null); setPhase(-1); }}>
                      <div className="between">
                        <span className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{a.id}</span>
                        <window.TierBadge tier={a.pending ? "—" : ti.t} score={a.pending ? null : a.score} showScore={!a.pending} />
                      </div>
                      <div className="dim" style={{ fontSize: 11.5 }}>{a.note}</div>
                      {tag && <span className="tier-badge tier-red" style={{ fontSize: 9, padding: "1px 5px", alignSelf: "flex-start" }}>{tag}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- stage ---- */}
          <div className="col gap-16">
            {/* target picker + fire */}
            <div className="panel" style={{ padding: 16 }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <span className="label" style={{ margin: 0 }}>Target endpoint</span>
                <span className="mono dimmer" style={{ fontSize: 11 }}>min score · price</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {allTargets.map((t) => (
                  <div key={t.name} className={"tool-row" + (t.name === targetName ? " sel" : "")} onClick={() => { setTargetName(t.name); setResult(null); setPhase(-1); }}>
                    <div className="row gap-8" style={{ minWidth: 0 }}>
                      <window.RiskDot level={t.risk} />
                      <span className="mono tcell" style={{ fontSize: 12.5 }}>{t.name}{t.kind === "api" ? "" : ""}</span>
                    </div>
                    <div className="row gap-8" style={{ flex: "none" }}>
                      <span className="mono dimmer" style={{ fontSize: 11 }}>≥{t.minScore}</span>
                      <span className="mono" style={{ fontSize: 11, color: t.price > 0 ? "var(--amber)" : "var(--text-3)" }}>{t.price > 0 ? T.fmt(t.price) : "free"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="between mt-16">
                <div className="mono dim" style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--text-1)" }}>{agentId}</span>
                  <span className="dimmer"> → </span>
                  <span style={{ color: "var(--text)" }}>{targetName}</span>
                </div>
                <button className="btn btn-primary" onClick={fire} disabled={running}>
                  {running ? "Gating…" : "▸ Send request"}
                </button>
              </div>
            </div>

            {/* pipeline */}
            <div className="panel" style={{ padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
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

              {/* verdict / receipt */}
              <Verdict result={result} target={target} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepMark({ state }) {
  if (state === "pass") return <span style={{ color: "var(--green)", fontSize: 13 }}>✓</span>;
  if (state === "fail") return <span style={{ color: "var(--red)", fontSize: 13 }}>✕</span>;
  if (state === "active") return <span className="live-dot" style={{ background: "var(--accent)", width: 6, height: 6 }} />;
  return <span style={{ color: "var(--text-3)", fontSize: 13 }}>·</span>;
}

/* verdict panel + x402 receipt */
function Verdict({ result, target }) {
  const T = window.TMCP;
  if (!result) {
    return (
      <div className="center dim mono fade-in" style={{ minHeight: 92, marginTop: 16, fontSize: 13, border: "1px dashed var(--line-soft)", borderRadius: 8 }}>
        awaiting request — pick an agent + endpoint, then ▸ Send
      </div>
    );
  }
  const blk = result.blockedBy ? T.BLOCK_LABELS[result.blockedBy] : null;
  const ok = result.allow;
  const pay = result.payment;

  return (
    <div className="fade-in mt-16" style={{ display: "grid", gridTemplateColumns: pay ? "1fr 320px" : "1fr", gap: 14 }}>
      {/* verdict card */}
      <div style={{
        borderRadius: 10, padding: "16px 18px",
        border: "1px solid " + (ok ? "var(--green-line)" : "var(--red-line)"),
        background: ok ? "var(--green-bg)" : "var(--red-bg)",
      }}>
        <div className="between">
          <span className={"verdict " + (ok ? "allow" : "deny")} style={{ fontSize: 15 }}>
            {ok ? "▸ ALLOWED" : "■ DENIED"}
          </span>
          <div className="row gap-8">
            <window.RoutePill route={result.route} />
            <window.TierBadge tier={result.tier} score={result.score} showScore />
          </div>
        </div>
        {blk && (
          <div className="mt-12">
            <span className="tier-badge tier-red" style={{ fontSize: 10 }}>BLOCKED BY · {blk.label}</span>
            <span className="dimmer mono" style={{ fontSize: 11, marginLeft: 8 }}>at step {blk.step}</span>
          </div>
        )}
        <ul className="mono" style={{ margin: "12px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--text-1)", lineHeight: 1.7 }}>
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div className="mono dimmer mt-12" style={{ fontSize: 10.5 }}>
          application/problem+json · {ok ? "200 OK" : (result.blockedBy === "payment-required" ? "402 Payment Required" : "403 Forbidden")}
          {!ok && " · Retry-After: 30"}
        </div>
      </div>

      {/* x402 receipt / challenge */}
      {pay && <X402Receipt pay={pay} basePrice={result.basePrice} score={result.score} />}
    </div>
  );
}

function X402Receipt({ pay, basePrice, score }) {
  const T = window.TMCP;
  const settled = pay.state === "settled";
  const mult = basePrice > 0 ? (pay.amount / basePrice) : 1;
  return (
    <div className="receipt" style={{ borderColor: settled ? "var(--amber-line)" : "var(--red-line)" }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.04em", color: settled ? "var(--amber)" : "var(--red)" }}>
          {settled ? "◇ x402 RECEIPT" : "✕ 402 CHALLENGE"}
        </span>
        <span className="dimmer">{pay.asset}</span>
      </div>
      <Line k="list price" v={T.fmt(basePrice)} />
      {mult > 1.05 && <Line k="trust surcharge" v={"×" + mult.toFixed(1)} c="var(--amber)" />}
      <Line k="charged" v={T.fmt(pay.amount)} c={settled ? "var(--text)" : "var(--red)"} strong />
      <div style={{ borderTop: "1px dashed var(--line)", margin: "10px 0" }} />
      {settled ? (
        <>
          <Line k="status" v="SETTLED" c="var(--green)" />
          <Line k="tx" v={T.shortHash(pay.txHash)} c="var(--text-1)" />
        </>
      ) : (
        <Line k="status" v="WALLET UNFUNDED" c="var(--red)" />
      )}
    </div>
  );
}
function Line({ k, v, c, strong }) {
  return (
    <div className="between" style={{ fontSize: 12, padding: "2px 0" }}>
      <span className="dimmer">{k}</span>
      <span style={{ color: c || "var(--text-1)", fontWeight: strong ? 700 : 500 }}>{v}</span>
    </div>
  );
}

Object.assign(window, { Simulator });
