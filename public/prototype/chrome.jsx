/* ============================================================
   TrustMCP — chrome: header, hero, tier explainer, footer
   ============================================================ */

function Header() {
  const g = window.useGateway();
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "oklch(0.155 0.006 274 / 0.78)",
      backdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--line-soft)",
    }}>
      <div className="shell between" style={{ height: 60 }}>
        <div className="row gap-16">
          <window.Wordmark />
          <span className="pill" style={{ color: "var(--green)", borderColor: "var(--green-line)", background: "var(--green-bg)" }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} /> GATEWAY LIVE
          </span>
        </div>
        <div className="row gap-12">
          <div className="seg" title="Demo runs anywhere: real API, strict, or offline mock">
            {["auto", "live", "mock"].map((m) => (
              <button key={m} className={g.mode === m ? "active" : ""} onClick={() => g.setMode(m)}>{m}</button>
            ))}
          </div>
          <a className="btn btn-ghost btn-sm" href="#byo">Bring your API</a>
          <button className="btn btn-primary btn-sm">Deploy gateway</button>
        </div>
      </div>
    </header>
  );
}

/* ---------- hero ---------- */
function Hero() {
  const g = window.useGateway();
  const recent = g.decisions.slice(0, 7);
  const mcp = `{
  "mcpServers": {
    "trustmcp": {
      "url": "https://gate.trustmcp.io/api/mcp",
      "headers": { "x-agent-id": "$AGENT_ID" }
    }
  }
}`;

  return (
    <section className="section" style={{ paddingTop: 56, paddingBottom: 56 }}>
      <div className="shell" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center" }}>
        {/* left */}
        <div>
          <span className="eyebrow"><span className="dot" /> TRUST · GUARDRAILS · PAYMENTS</span>
          <h1 style={{ fontSize: 52, marginTop: 18, letterSpacing: "-0.03em" }}>
            A gate that decides<br />
            <span style={{ color: "var(--text-2)" }}>which agents</span> you can trust.
          </h1>
          <p className="sub" style={{ fontSize: 17, marginTop: 18 }}>
            TrustMCP sits in front of your tools and APIs and decides — in real time, before the call runs —
            whether the calling agent should be <b style={{ color: "var(--green)" }}>allowed</b>,
            <b style={{ color: "var(--amber)" }}> charged</b>, or
            <b style={{ color: "var(--red)" }}> blocked</b>. Reputation, behavioral policing, and x402 payments in one layer. Zero code changes.
          </p>

          <div className="row gap-10 wrap mt-24">
            <a className="btn btn-primary" href="#sim">▸ Run the live demo</a>
            <a className="btn btn-ghost" href="#byo">Register an API</a>
          </div>

          {/* mcp.json connect snippet */}
          <div className="mt-24">
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="label" style={{ margin: 0 }}>Connect in one file · mcp.json</span>
              <window.CopyBtn text={mcp} label="Copy config" />
            </div>
            <pre className="code" style={{ margin: 0 }}>
              <code dangerouslySetInnerHTML={{ __html: highlightJson(mcp) }} />
            </pre>
          </div>
        </div>

        {/* right — live feed hero moment */}
        <div className="panel" style={{ overflow: "hidden", boxShadow: "var(--shadow-2)" }}>
          <div className="between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="row gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
              <span className="live-dot" /> Live decision feed
            </span>
            <span className="mono dimmer" style={{ fontSize: 11 }}>/api/mcp · /api/gateway</span>
          </div>
          <div style={{ minHeight: 372 }}>
            {recent.length === 0 && (
              <div className="center dim mono" style={{ height: 372, fontSize: 13 }}>warming up…</div>
            )}
            {recent.map((d) => <window.FeedRow key={d.id} d={d} dense />)}
          </div>
          <div className="between mono" style={{ padding: "10px 16px", borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--text-3)" }}>
            <span>{g.stats.calls.toLocaleString()} calls gated</span>
            <span className="row gap-12">
              <span style={{ color: "var(--green)" }}>{g.stats.allowed} allowed</span>
              <span style={{ color: "var(--red)" }}>{g.stats.blocked} blocked</span>
              <span style={{ color: "var(--amber)" }}>{g.stats.paid} paid</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* tiny json highlighter for the snippet */
function highlightJson(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="s">$1</span>');
}

/* ---------- tier explainer strip ---------- */
function TierStrip() {
  const T = window.TMCP;
  const rows = [
    { tier: "AAA", range: "93–100", can: "Everything · send_payment, delete_records", grp: "green" },
    { tier: "A",   range: "78–84",  can: "Reads, market data, customer records", grp: "green" },
    { tier: "BA",  range: "60–69",  can: "Public reads · throttled route", grp: "amber" },
    { tier: "CAA", range: "38–49",  can: "Sandbox only · 8× pricing", grp: "red" },
    { tier: "C",   range: "0–24",   can: "Blocked", grp: "red" },
  ];
  return (
    <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="shell">
        <div className="between wrap" style={{ gap: 16, marginBottom: 22 }}>
          <div>
            <span className="eyebrow"><span className="dot" /> VALIRON REPUTATION</span>
            <h2 className="h-sec" style={{ fontSize: 24 }}>Every agent carries a credit rating.</h2>
          </div>
          <p className="sub" style={{ fontSize: 14, maxWidth: "44ch" }}>
            ERC-8004 on-chain history + behavioral sandbox + World ID proof-of-personhood, distilled into a single AAA→C tier. Each endpoint declares the minimum it accepts.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.tier} className="panel" style={{ padding: 16 }}>
              <window.TierBadge tier={r.tier} />
              <div className="mono dimmer mt-12" style={{ fontSize: 11 }}>SCORE {r.range}</div>
              <div className="mt-8" style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.4 }}>{r.can}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- footer ---------- */
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "40px 0 56px", marginTop: 8 }}>
      <div className="shell between wrap" style={{ gap: 20 }}>
        <div>
          <window.Wordmark />
          <p className="dim" style={{ fontSize: 13, marginTop: 12, maxWidth: "42ch" }}>
            Trust, guardrails & payments for AI agents. One gate in front of any tool or API.
          </p>
        </div>
        <div className="row gap-24 wrap" style={{ alignItems: "flex-start", gap: 40 }}>
          <div className="col gap-8">
            <span className="label" style={{ margin: 0 }}>Endpoints</span>
            <span className="mono dim" style={{ fontSize: 12 }}>POST /api/mcp</span>
            <span className="mono dim" style={{ fontSize: 12 }}>/api/gateway/&lt;id&gt;/&lt;path&gt;</span>
          </div>
          <div className="col gap-8">
            <span className="label" style={{ margin: 0 }}>Standards</span>
            <span className="mono dim" style={{ fontSize: 12 }}>x402 · ERC-8004</span>
            <span className="mono dim" style={{ fontSize: 12 }}>RFC 9457 · World ID</span>
          </div>
          <button className="btn btn-primary">Deploy gateway</button>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Header, Hero, TierStrip, Footer });
