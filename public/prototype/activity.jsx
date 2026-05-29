/* ============================================================
   TrustMCP — live activity: stats + full decision feed
   ============================================================ */

function Activity() {
  const g = window.useGateway();
  const T = window.TMCP;
  const [filter, setFilter] = React.useState("all"); // all | allow | deny | paid
  const [paused, setPaused] = React.useState(false);

  // pause streaming when user is inspecting
  React.useEffect(() => { g.setStreaming(!paused); }, [paused]);

  const filtered = g.decisions.filter((d) => {
    if (filter === "allow") return d.allow;
    if (filter === "deny") return !d.allow;
    if (filter === "paid") return d.payment && d.payment.state === "settled";
    return true;
  });

  const stats = g.stats;
  const blockRate = stats.calls ? Math.round((stats.blocked / stats.calls) * 100) : 0;
  const revenue = stats.revenue || 0;

  return (
    <section className="section" id="activity">
      <div className="shell">
        <div className="between wrap" style={{ gap: 16 }}>
          <div>
            <span className="eyebrow"><span className="dot" /> OBSERVABILITY</span>
            <h2 className="h-sec">Live activity.</h2>
          </div>
          <p className="sub" style={{ fontSize: 14, maxWidth: "40ch" }}>
            Every allow / deny / paid decision, streamed in real time. The dashboard is the proof — the integration is one line.
          </p>
        </div>

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 24 }}>
          <Stat label="Calls gated" value={stats.calls} color="var(--text)" />
          <Stat label="Allowed" value={stats.allowed} color="var(--green)" />
          <Stat label="Blocked" value={stats.blocked} color="var(--red)" sub={blockRate + "% block rate"} />
          <Stat label="Paid (402)" value={stats.paid} color="var(--amber)" />
          <Stat label="Revenue · USDC" value={revenue} color="var(--accent-bright)" money />
        </div>

        {/* feed */}
        <div className="panel mt-24" style={{ overflow: "hidden" }}>
          <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="row gap-8">
              <span className="row gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
                <span className="live-dot" style={{ background: paused ? "var(--text-3)" : "var(--green)" }} />
                Decision log
              </span>
            </div>
            <div className="row gap-12">
              <div className="seg">
                {["all", "allow", "deny", "paid"].map((f) => (
                  <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setPaused((p) => !p)}>
                {paused ? "▸ Resume" : "⏸ Pause"}
              </button>
            </div>
          </div>

          {/* column header */}
          <div className="feed-row dimmer mono" style={{ gridTemplateColumns: "96px minmax(0,1.4fr) minmax(0,1.6fr) auto", fontSize: 10, letterSpacing: "0.08em", borderBottom: "1px solid var(--line)", animation: "none" }}>
            <span>VERDICT</span><span>AGENT → ENDPOINT</span><span>REASON</span><span style={{ textAlign: "right" }}>TIER · PAY</span>
          </div>

          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {filtered.slice(0, 40).map((d) => <window.FeedRow key={d.id} d={d} />)}
            {filtered.length === 0 && <div className="center dim mono" style={{ height: 120, fontSize: 13 }}>no {filter} decisions yet</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color, sub, money }) {
  return (
    <div className="stat">
      <div className="num" style={{ color }}>
        {money && <span style={{ fontSize: 22, verticalAlign: "top", opacity: 0.7 }}>$</span>}
        <window.CountUp value={money ? Math.round(value * 100) / 100 : value} decimals={money ? 2 : 0} />
      </div>
      <div className="lbl">{label}</div>
      {sub && <div className="mono dimmer" style={{ fontSize: 10.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { Activity });
