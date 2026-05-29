"use client";

import { useEffect, useRef, useState } from "react";
import { BLOCK_LABELS } from "@/lib/block-labels";
import { tierClass, tierGroup } from "@/lib/tiers";
import type { Decision } from "./store";

export const fmt = (n: number) => "$" + n.toFixed(2);
export const shortHash = (h?: string) => (h ? h.slice(0, 6) + "…" + h.slice(-4) : "");

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.82 0.145 292)" />
          <stop offset="1" stopColor="oklch(0.62 0.13 292)" />
        </linearGradient>
      </defs>
      <polygon points="16,2 30,16 16,30 2,16" stroke="url(#mk)" strokeWidth="2" fill="oklch(0.30 0.07 292 / 0.25)" />
      <polygon points="16,9 23,16 16,23 9,16" fill="url(#mk)" />
      <rect x="15" y="11.5" width="2" height="9" rx="1" fill="oklch(0.16 0.02 292)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="row gap-10" style={{ alignItems: "center" }}>
      <Mark />
      <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
        Trust<span style={{ color: "var(--accent-bright)" }}>MCP</span>
      </span>
    </div>
  );
}

export function TierBadge({ tier, score, showScore = false }: { tier: string; score?: number | null; showScore?: boolean }) {
  const grp = tierGroup(tier);
  return (
    <span className={"tier-badge " + tierClass(grp)}>
      {tier}
      {showScore && score != null && <span style={{ opacity: 0.7, fontWeight: 500 }}>{score}</span>}
    </span>
  );
}

export function RiskDot({ level }: { level: string }) {
  const c = level === "GREEN" ? "var(--green)" : level === "YELLOW" ? "var(--amber)" : "var(--red)";
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flex: "none" }} title={level} />;
}

export function RoutePill({ route }: { route: string }) {
  const map: Record<string, string> = {
    prod: "var(--green)", prod_throttled: "var(--amber)", sandbox: "var(--text-2)", sandbox_only: "var(--red)",
  };
  return <span className="pill" style={{ color: map[route] ?? "var(--text-2)", borderColor: "var(--line)" }}>{route}</span>;
}

/** Display name for a decision row (API/tool field from backend). */
export function decisionTarget(d: Decision): string {
  return d.tool;
}

export function FeedRow({ d, dense }: { d: Decision; dense?: boolean }) {
  const cls = !d.allow ? (d.blockedBy === "payment-required" ? "pay" : "no") : d.payment ? "pay" : "ok";
  const reason = d.reasons[d.reasons.length - 1];
  const blk = d.blockedBy ? BLOCK_LABELS[d.blockedBy] : null;
  const target = decisionTarget(d);
  return (
    <div
      className={"feed-row " + cls}
      style={{ gridTemplateColumns: dense ? "84px 1fr auto" : "96px minmax(0,1.4fr) minmax(0,1.6fr) auto" }}
    >
      <div className={"verdict " + (d.allow ? "allow" : "deny")}>{d.allow ? "▸ ALLOW" : "■ DENY"}</div>

      <div className="tcell" style={{ minWidth: 0 }}>
        {d.kind === "api" && (
          <span
            className="tier-badge"
            style={{ borderColor: "var(--accent-line)", color: "var(--accent-bright)", background: "var(--accent-bg)", fontSize: 9, padding: "1px 5px", marginRight: 6 }}
          >
            API
          </span>
        )}
        <span className="mono" style={{ color: "var(--text-1)" }}>{d.agentId}</span>
        <span className="dimmer mono" style={{ margin: "0 6px" }}>→</span>
        <span className="mono" style={{ color: "var(--text)" }}>{target}</span>
      </div>

      {!dense && (
        <div className="tcell mono" style={{ color: d.allow ? "var(--text-2)" : "var(--red)", fontSize: 12 }}>
          {blk && <span className="tier-badge tier-red" style={{ marginRight: 8, fontSize: 9.5, padding: "1px 5px" }}>{blk.label}</span>}
          {reason}
        </div>
      )}

      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
        {d.payment && (
          <span className="mono" style={{ fontSize: 11.5, color: d.payment.state === "settled" ? "var(--amber)" : "var(--red)" }}>
            {d.payment.state === "settled" ? "◇ " : "✕ "}{fmt(d.payment.amount)}
          </span>
        )}
        <TierBadge tier={d.tier} score={d.score} showScore />
      </div>
    </div>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-quiet btn-sm"
      onClick={() => {
        try { navigator.clipboard.writeText(text); } catch {}
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

/** Animated stat — guarded rAF cleanup so it cannot loop after unmount (from design components v2). */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    fromRef.current = to;
    if (from === to) return;
    if (typeof document !== "undefined" && document.hidden) {
      setShown(to);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    const dur = 500;
    const tick = (now: number) => {
      if (cancelled) return;
      const p = Math.min(1, (now - start) / dur);
      setShown(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value]);
  const v = decimals > 0 ? Number(shown).toFixed(decimals) : Math.round(shown).toLocaleString();
  return <>{v}</>;
}

export function highlightJson(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="s">$1</span>');
}
