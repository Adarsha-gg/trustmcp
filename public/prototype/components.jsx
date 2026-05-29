/* ============================================================
   TrustMCP — shared components & context
   ============================================================ */

/* gateway store context (provided by App) */
const GatewayContext = React.createContext(null);
window.GatewayContext = GatewayContext;
window.useGateway = () => React.useContext(GatewayContext);

/* ---------- logo mark: a diamond "gate" checkpoint ---------- */
function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.82 0.145 292)" />
          <stop offset="1" stopColor="oklch(0.62 0.13 292)" />
        </linearGradient>
      </defs>
      {/* outer gate diamond */}
      <polygon points="16,2 30,16 16,30 2,16" stroke="url(#mk)" strokeWidth="2" fill="oklch(0.30 0.07 292 / 0.25)" />
      {/* inner diamond */}
      <polygon points="16,9 23,16 16,23 9,16" fill="url(#mk)" />
      {/* gate slit */}
      <rect x="15" y="11.5" width="2" height="9" rx="1" fill="oklch(0.16 0.02 292)" />
    </svg>
  );
}

function Wordmark() {
  return (
    <div className="row gap-10" style={{ alignItems: "center" }}>
      <Mark />
      <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
        Trust<span style={{ color: "var(--accent-bright)" }}>MCP</span>
      </span>
    </div>
  );
}

/* ---------- tier badge ---------- */
function TierBadge({ tier, score, showScore = false }) {
  const T = window.TMCP;
  const grp = (T.TIERS.find((x) => x.t === tier) || {}).grp || "red";
  return (
    <span className={"tier-badge " + T.tierClass(grp)}>
      {tier}
      {showScore && score != null && <span style={{ opacity: 0.7, fontWeight: 500 }}>{score}</span>}
    </span>
  );
}

/* small risk dot */
function RiskDot({ level }) {
  const c = level === "GREEN" ? "var(--green)" : level === "YELLOW" ? "var(--amber)" : "var(--red)";
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flex: "none" }} title={level} />;
}

/* route pill */
function RoutePill({ route }) {
  const map = {
    prod: { c: "var(--green)" }, prod_throttled: { c: "var(--amber)" },
    sandbox: { c: "var(--text-2)" }, sandbox_only: { c: "var(--red)" },
  };
  const c = (map[route] || {}).c || "var(--text-2)";
  return <span className="pill" style={{ color: c, borderColor: "var(--line)" }}>{route}</span>;
}

/* ---------- a single decision feed row ---------- */
function FeedRow({ d, dense }) {
  const T = window.TMCP;
  const cls = !d.allow ? (d.blockedBy === "payment-required" ? "pay" : "no") : (d.payment ? "pay" : "ok");
  const reason = d.reasons[d.reasons.length - 1];
  const blk = d.blockedBy ? T.BLOCK_LABELS[d.blockedBy] : null;
  return (
    <div
      className={"feed-row " + cls}
      style={{ gridTemplateColumns: dense ? "84px 1fr auto" : "96px minmax(0,1.4fr) minmax(0,1.6fr) auto" }}
    >
      {/* verdict */}
      <div className={"verdict " + (d.allow ? "allow" : "deny")}>
        {d.allow ? "▸ ALLOW" : "■ DENY"}
      </div>

      {/* agent → target */}
      <div className="tcell" style={{ minWidth: 0 }}>
        <span className="mono" style={{ color: "var(--text-1)" }}>{d.agentId}</span>
        <span className="dimmer mono" style={{ margin: "0 6px" }}>→</span>
        <span className="mono" style={{ color: "var(--text)" }}>{d.target}</span>
      </div>

      {/* reason (hidden in dense) */}
      {!dense && (
        <div className="tcell mono" style={{ color: d.allow ? "var(--text-2)" : "var(--red)", fontSize: 12 }}>
          {blk && <span className="tier-badge tier-red" style={{ marginRight: 8, fontSize: 9.5, padding: "1px 5px" }}>{blk.label}</span>}
          {reason}
        </div>
      )}

      {/* tier + payment */}
      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
        {d.payment && (
          <span className="mono" style={{ fontSize: 11.5, color: d.payment.state === "settled" ? "var(--amber)" : "var(--red)" }}>
            {d.payment.state === "settled" ? "◇ " : "✕ "}{T.fmt(d.payment.amount)}
          </span>
        )}
        <TierBadge tier={d.tier} score={d.score} showScore />
      </div>
    </div>
  );
}

/* copy-to-clipboard button */
function CopyBtn({ text, label = "Copy" }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      className="btn btn-quiet btn-sm"
      onClick={() => {
        try { navigator.clipboard.writeText(text); } catch (e) {}
        setDone(true); setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

/* count-up number — single guarded rAF, snaps when backgrounded; cannot loop */
function CountUp({ value, decimals = 0 }) {
  const [shown, setShown] = React.useState(value);
  const fromRef = React.useRef(value);
  React.useEffect(() => {
    const from = fromRef.current, to = value;
    fromRef.current = to;
    if (from === to) return;
    if (typeof document !== "undefined" && document.hidden) { setShown(to); return; }
    let raf = 0, cancelled = false;
    const start = performance.now(), dur = 500;
    const tick = (now) => {
      if (cancelled) return;
      const p = Math.min(1, (now - start) / dur);
      setShown(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [value]);
  const v = decimals > 0 ? Number(shown).toFixed(decimals) : Math.round(shown).toLocaleString();
  return <>{v}</>;
}

Object.assign(window, { Mark, Wordmark, TierBadge, RiskDot, RoutePill, FeedRow, CopyBtn, CountUp });
