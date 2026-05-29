/* ============================================================
   TrustMCP — data layer & decision engine  (plain JS → window.TMCP)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- tiers ---------- */
  // 9-band Moody's-style scale, green → red
  const TIERS = [
    { t: "AAA", min: 93, grp: "green" },
    { t: "AA",  min: 85, grp: "green" },
    { t: "A",   min: 78, grp: "green" },
    { t: "BAA", min: 70, grp: "amber" },
    { t: "BA",  min: 60, grp: "amber" },
    { t: "B",   min: 50, grp: "amber" },
    { t: "CAA", min: 38, grp: "red" },
    { t: "CA",  min: 25, grp: "red" },
    { t: "C",   min: 0,  grp: "red" },
  ];

  function tierFromScore(score) {
    for (const x of TIERS) if (score >= x.min) return x;
    return TIERS[TIERS.length - 1];
  }
  function tierClass(grp) {
    return grp === "green" ? "tier-green" : grp === "amber" ? "tier-amber" : "tier-red";
  }
  function riskFromGrp(grp) {
    return grp === "green" ? "GREEN" : grp === "amber" ? "YELLOW" : "RED";
  }

  /* ---------- demo agents (personas) ---------- */
  const AGENTS = [
    { id: "aaa-trusted-agent",  score: 96, label: "Production payments agent",  note: "World ID verified · AAA on-chain history", wallet: "0x7Af3…91c2" },
    { id: "a-tier-research-bot", score: 82, label: "Market research bot",        note: "Steady read traffic · solid reputation",     wallet: "0x2b08…dd41" },
    { id: "hijacked-agent",      score: 88, label: "Trusted agent — hijacked",   note: "Prompt-injected payload in arguments",        wallet: "0x9c12…4a7f", hijacked: true },
    { id: "b-tier-bot",          score: 54, label: "New integration bot",        note: "Limited history · throttled route",           wallet: "0x55de…0b9a" },
    { id: "broke-agent",         score: 74, label: "Funded-less agent",          note: "Good standing · empty wallet",                wallet: "0x0000…0000", broke: true },
    { id: "low-trust-scraper",   score: 38, label: "Aggressive scraper",         note: "Bandwidth abuse signals",                     wallet: "0xf1aa…77c0" },
    { id: "malicious-drainer",   score: 9,  label: "Malicious drainer",          note: "Burst attack pattern · flagged",              wallet: "0xdead…beef", drainer: true },
    { id: "unknown-newcomer",    score: 0,  label: "Unknown newcomer",           note: "No reputation yet · sandbox",                 wallet: "0x4e91…b220", pending: true },
  ];

  /* ---------- demo tool catalog ---------- */
  const TOOLS = [
    { name: "search_web",            kind: "tool", minScore: 20, price: 0,    risk: "GREEN",  desc: "Open web search" },
    { name: "get_market_data",       kind: "tool", minScore: 50, price: 0.02, risk: "GREEN",  desc: "Real-time quotes" },
    { name: "read_customer_records", kind: "tool", minScore: 70, price: 0.05, risk: "YELLOW", desc: "PII read access" },
    { name: "send_payment",          kind: "tool", minScore: 85, price: 0.10, risk: "RED",    desc: "Move funds" },
    { name: "delete_records",        kind: "tool", minScore: 90, price: 0,    risk: "RED",    desc: "Destructive write" },
  ];

  /* ---------- built-in upstreams (BYO API) ---------- */
  const UPSTREAMS = [
    { id: "wx-1f", name: "Aperture Weather API", baseUrl: "https://api.aperture.dev/v3", price: 0.01, minScore: 30, risk: "GREEN", desc: "Forecast & historical climate data", builtin: true },
    { id: "lg-7c", name: "Ledger Postgres Proxy", baseUrl: "https://db.internal.acme.io", price: 0.05, minScore: 75, risk: "YELLOW", desc: "Read-only financial ledger", builtin: true },
  ];

  /* ---------- helpers ---------- */
  const HEX = "0123456789abcdef";
  function hex(n) { let s = ""; for (let i = 0; i < n; i++) s += HEX[(Math.random() * 16) | 0]; return s; }
  function txHash() { return "0x" + hex(40); }
  function shortHash(h) { return h.slice(0, 6) + "…" + h.slice(-4); }
  let _id = 0;
  function nextId() { return "d" + (++_id) + "-" + hex(4); }
  function fmt(n) { return "$" + n.toFixed(2); }

  // trust-adjusted pricing: low trust pays up to ~8×
  function pricedFor(base, score) {
    if (base <= 0) return 0;
    let mult = 1;
    if (score < 85) mult = Math.min(8, 1 + (85 - score) / 9);
    return Math.round(base * mult * 100) / 100;
  }

  function routeFor(allow, score, pending) {
    if (pending) return "sandbox";
    if (!allow) return "sandbox_only";
    if (score >= 70) return "prod";
    return "prod_throttled";
  }

  /* ---------- core gate ---------- */
  // target = tool {name,kind,minScore,price,risk,desc} OR upstream-derived target
  function decide(agent, target, opts) {
    opts = opts || {};
    const reasons = [];
    const score = agent.score;
    const tinfo = tierFromScore(score);
    const tier = tinfo.t;
    const risk = agent.hijacked || agent.drainer ? "RED" : riskFromGrp(tinfo.grp);
    let allow = true, blockedBy = null, payment = null;

    // 1 — identity / sandbox
    if (agent.pending) {
      allow = false; blockedBy = "pending-eval";
      reasons.push("Agent in reputation sandbox — awaiting on-chain bootstrap");
    }
    // 2 — trust gate
    else if (score < target.minScore) {
      allow = false; blockedBy = "trust-gate";
      reasons.push("Trust " + score + " (" + tier + ") below required " + target.minScore + " for " + target.name);
    }
    // 3 — guardrails
    else if (agent.hijacked && (target.risk === "RED" || target.risk === "YELLOW")) {
      allow = false; blockedBy = "guardrail";
      reasons.push("Prompt-injection signature in arguments — agent quarantined");
    }
    else if (agent.drainer) {
      allow = false; blockedBy = "guardrail";
      reasons.push("High-risk burst detected — velocity cap exceeded, quarantined");
    }
    // 4 — payment + 5 run
    else {
      if (target.price > 0) {
        const amount = pricedFor(target.price, score);
        if (agent.broke) {
          allow = false; blockedBy = "payment-required";
          payment = { state: "required", amount: amount, asset: "USDC" };
          reasons.push("402 Payment Required — " + fmt(amount) + " USDC · wallet unfunded");
        } else {
          payment = { state: "settled", amount: amount, asset: "USDC", txHash: txHash() };
          const surcharge = score < 85 && amount > target.price;
          reasons.push("Settled " + fmt(amount) + " USDC" + (surcharge ? " (trust-adjusted ×" + (amount / target.price).toFixed(1) + ")" : ""));
        }
      }
      if (allow) reasons.push(target.kind === "api" ? "Forwarded to upstream origin → 200 OK" : "Tool executed → 200 OK");
    }

    return {
      id: nextId(),
      ts: Date.now(),
      agentId: agent.id,
      score: score,
      tier: tier,
      grp: tinfo.grp,
      riskLevel: risk,
      target: target.name,
      kind: target.kind,
      minScore: target.minScore,
      basePrice: target.price,
      allow: allow,
      blockedBy: blockedBy,
      route: routeFor(allow, score, agent.pending),
      payment: payment,
      reasons: reasons,
      source: opts.source || "live",
    };
  }

  /* which pipeline step did it stop at (0..4) */
  function stopStep(d) {
    switch (d.blockedBy) {
      case "pending-eval": return 0;       // identity
      case "trust-gate": return 1;         // trust
      case "guardrail": return 2;          // guardrails
      case "payment-required": return 3;   // payment
      default: return 4;                   // ran
    }
  }

  const BLOCK_LABELS = {
    "trust-gate":       { label: "TRUST GATE",   step: "Valiron Trust" },
    "tool-policy":      { label: "TOOL POLICY",  step: "Policy" },
    "guardrail":        { label: "GUARDRAIL",    step: "Guardrails" },
    "payment-required": { label: "402 UNPAID",   step: "x402 Payment" },
    "pending-eval":     { label: "SANDBOX",      step: "Identity" },
    "kill-switch":      { label: "KILL SWITCH",  step: "Identity" },
    "read-only":        { label: "READ ONLY",    step: "Valiron Trust" },
  };

  /* ---------- live-stream generator ---------- */
  // weight personas so the feed feels realistic but shows variety
  const STREAM_WEIGHTS = [
    ["aaa-trusted-agent", 5], ["a-tier-research-bot", 6], ["hijacked-agent", 2],
    ["b-tier-bot", 4], ["broke-agent", 2], ["low-trust-scraper", 4],
    ["malicious-drainer", 2], ["unknown-newcomer", 2],
  ];
  const _wpool = [];
  STREAM_WEIGHTS.forEach(([id, w]) => { for (let i = 0; i < w; i++) _wpool.push(id); });

  // some anonymous agent ids to sprinkle in
  function randomAnonAgent() {
    const score = [12, 28, 45, 61, 73, 84, 91, 97][(Math.random() * 8) | 0];
    return { id: "agent-" + hex(6), score: score, wallet: "0x" + hex(4) + "…" + hex(4) };
  }

  function randomDecision() {
    let agent;
    if (Math.random() < 0.4) agent = randomAnonAgent();
    else { const pid = _wpool[(Math.random() * _wpool.length) | 0]; agent = AGENTS.find((a) => a.id === pid) || AGENTS[0]; }
    const pool = Math.random() < 0.7 ? TOOLS : UPSTREAMS.map(upstreamTarget);
    const target = pool[(Math.random() * pool.length) | 0];
    return decide(agent, target, { source: "live" });
  }

  function upstreamTarget(u) {
    return { name: u.name, kind: "api", minScore: u.minScore, price: u.price, risk: u.risk, desc: u.desc };
  }

  window.TMCP = {
    TIERS, AGENTS, TOOLS, UPSTREAMS, BLOCK_LABELS,
    tierFromScore, tierClass, riskFromGrp,
    decide, stopStep, pricedFor, routeFor,
    randomDecision, upstreamTarget, randomAnonAgent,
    fmt, txHash, shortHash, hex, nextId,
  };
})();
