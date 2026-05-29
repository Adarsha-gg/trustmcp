/* ============================================================
   TrustMCP — Bring Your Own API (register + test as agent)
   ============================================================ */

function ByoApi() {
  const g = window.useGateway();
  const T = window.TMCP;

  return (
    <section className="section" id="byo">
      <div className="shell">
        <span className="eyebrow"><span className="dot" /> REVERSE PROXY · ZERO CODE</span>
        <h2 className="h-sec">Bring your own API.</h2>
        <p className="sub">Register any HTTPS API by URL. TrustMCP becomes an SSRF-guarded reverse proxy in front of it — agents hit your gateway URL, we trust-check, charge, and forward to your origin. Instant monetization and protection.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, marginTop: 28, alignItems: "start" }}>
          {/* registered list */}
          <div className="col gap-12">
            {g.upstreams.map((u) => <UpstreamCard key={u.id} u={u} />)}
            {g.upstreams.length === 0 && (
              <div className="panel center dim mono" style={{ height: 120, fontSize: 13 }}>no APIs registered yet — add one →</div>
            )}
          </div>

          {/* register form */}
          <RegisterForm onAdd={g.addUpstream} />
        </div>
      </div>
    </section>
  );
}

function UpstreamCard({ u }) {
  const g = window.useGateway();
  const T = window.TMCP;
  const [test, setTest] = React.useState(null); // {kind:'aaa'|'scraper', d}
  const gwUrl = "gate.trustmcp.io/api/gateway/" + u.id;

  function runTest(kind) {
    const agent = kind === "aaa"
      ? { id: "aaa-trusted-agent", score: 96, wallet: "0x7Af3…91c2" }
      : { id: "low-trust-scraper", score: 38, wallet: "0xf1aa…77c0" };
    const d = T.decide(agent, T.upstreamTarget(u), { source: "manual" });
    setTest({ kind, d });
    g.push(d);
  }

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="between wrap" style={{ gap: 10 }}>
        <div className="row gap-10" style={{ flex: 1, minWidth: 0 }}>
          <window.RiskDot level={u.risk} />
          <div style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</span>
              {u.builtin && <span className="pill" style={{ fontSize: 10 }}>built-in</span>}
            </div>
            <div className="mono dim tcell" style={{ fontSize: 12, marginTop: 2 }}>{u.baseUrl}</div>
          </div>
        </div>
        <div className="row gap-16" style={{ flex: "none" }}>
          <Meta k="PRICE/CALL" v={u.price > 0 ? T.fmt(u.price) : "free"} />
          <Meta k="MIN SCORE" v={"≥ " + u.minScore} />
        </div>
      </div>

      {/* gateway url */}
      <div className="between mt-12" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 8, padding: "8px 12px" }}>
        <span className="mono tcell" style={{ fontSize: 12, color: "var(--accent-bright)" }}>{gwUrl}/&lt;path&gt;</span>
        <window.CopyBtn text={"https://" + gwUrl} label="Copy URL" />
      </div>

      {/* test buttons */}
      <div className="row gap-8 mt-12 wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => runTest("aaa")}>Test as AAA agent</button>
        <button className="btn btn-ghost btn-sm" onClick={() => runTest("scraper")}>Test as scraper</button>
        {test && <span className="dimmer mono" style={{ fontSize: 11 }}>response below</span>}
      </div>

      {test && <TestResponse d={test.d} />}
    </div>
  );
}

function TestResponse({ d }) {
  const T = window.TMCP;
  const ok = d.allow;
  const body = ok
    ? { status: 200, route: d.route, forwarded: true, ...(d.payment ? { paid: T.fmt(d.payment.amount), tx: T.shortHash(d.payment.txHash) } : {}) }
    : { status: d.blockedBy === "payment-required" ? 402 : 403, type: "trustmcp/" + d.blockedBy, title: d.reasons[0], score: d.score, tier: d.tier, retryAfter: 30 };
  return (
    <pre className="code fade-in mt-12" style={{
      margin: 0, fontSize: 11.5,
      borderColor: ok ? "var(--green-line)" : "var(--red-line)",
      background: ok ? "oklch(0.20 0.03 150 / 0.4)" : "oklch(0.21 0.04 25 / 0.4)",
    }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <span className={"verdict " + (ok ? "allow" : "deny")}>{ok ? "▸ 200 ALLOW" : (body.status === 402 ? "◇ 402 PAY" : "■ 403 DENY")}</span>
        <span className="dimmer">{ok ? "application/json" : "application/problem+json"}</span>
      </div>
      <code>{JSON.stringify(body, null, 2)}</code>
    </pre>
  );
}

function Meta({ k, v }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="mono dimmer" style={{ fontSize: 10, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{k}</div>
      <div className="mono" style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

function RegisterForm({ onAdd }) {
  const T = window.TMCP;
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [price, setPrice] = React.useState("0.02");
  const [minScore, setMinScore] = React.useState(60);

  const valid = name.trim() && /^https?:\/\/.+/.test(url.trim());

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      id: T.hex(2) + "-" + T.hex(2),
      name: name.trim(),
      baseUrl: url.trim(),
      price: parseFloat(price) || 0,
      minScore: Number(minScore),
      risk: minScore >= 70 ? "YELLOW" : "GREEN",
      desc: "Custom upstream",
      builtin: false,
    });
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
            <input type="range" min="0" max="95" value={minScore} onChange={(e) => setMinScore(e.target.value)}
              style={{ width: "100%", accentColor: "var(--accent)", marginTop: 10 }} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={!valid} style={{ justifyContent: "center" }}>
          + Register & proxy
        </button>
        <p className="dimmer mono" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
          SSRF-guarded · no code changes · live the moment you submit.
        </p>
      </div>
    </form>
  );
}

Object.assign(window, { ByoApi });
