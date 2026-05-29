/* ============================================================
   TrustMCP — App: store, streaming engine, compose, mount
   ============================================================ */

const MAX_FEED = 60;

function useGatewayStore() {
  const T = window.TMCP;
  const [decisions, setDecisions] = React.useState([]);
  const [stats, setStats] = React.useState({ calls: 0, allowed: 0, blocked: 0, paid: 0, revenue: 0 });
  const [upstreams, setUpstreams] = React.useState(T.UPSTREAMS.slice());
  const [streaming, setStreaming] = React.useState(true);
  const [mode, setMode] = React.useState("auto");

  const push = React.useCallback((d) => {
    setDecisions((arr) => [d, ...arr].slice(0, MAX_FEED));
    setStats((s) => ({
      calls: s.calls + 1,
      allowed: s.allowed + (d.allow ? 1 : 0),
      blocked: s.blocked + (d.allow ? 0 : 1),
      paid: s.paid + (d.payment && d.payment.state === "settled" ? 1 : 0),
      revenue: s.revenue + (d.payment && d.payment.state === "settled" ? d.payment.amount : 0),
    }));
  }, []);

  const addUpstream = React.useCallback((u) => setUpstreams((arr) => [u, ...arr]), []);

  // seed a few rows so the hero isn't empty on load
  React.useEffect(() => {
    const seed = [];
    for (let i = 0; i < 6; i++) seed.push(T.randomDecision());
    seed.forEach((d) => push(d));
    // eslint-disable-next-line
  }, []);

  // live streaming engine
  React.useEffect(() => {
    if (!streaming) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      push(T.randomDecision());
      const next = 900 + Math.random() * 1700;
      timer = setTimeout(tick, next);
    };
    let timer = setTimeout(tick, 1200);
    return () => { alive = false; clearTimeout(timer); };
  }, [streaming, push]);

  return { decisions, stats, upstreams, streaming, setStreaming, mode, setMode, push, addUpstream };
}

function App() {
  const store = useGatewayStore();
  return (
    <window.GatewayContext.Provider value={store}>
      <window.Header />
      <window.Hero />
      <window.TierStrip />
      <window.Simulator />
      <window.ByoApi />
      <window.Activity />
      <window.Footer />
    </window.GatewayContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
