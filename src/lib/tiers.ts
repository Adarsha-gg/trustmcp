/** 9-band Moody's-style tier scale (matches design prototype `data.js`). */

export type TierGroup = "green" | "amber" | "red";

export const TIERS: { t: string; min: number; grp: TierGroup }[] = [
  { t: "AAA", min: 93, grp: "green" },
  { t: "AA", min: 85, grp: "green" },
  { t: "A", min: 78, grp: "green" },
  { t: "BAA", min: 70, grp: "amber" },
  { t: "BA", min: 60, grp: "amber" },
  { t: "B", min: 50, grp: "amber" },
  { t: "CAA", min: 38, grp: "red" },
  { t: "CA", min: 25, grp: "red" },
  { t: "C", min: 0, grp: "red" },
];

export function tierGroup(tier: string): TierGroup {
  return TIERS.find((x) => x.t === tier)?.grp ?? "red";
}

export function tierClass(grp: TierGroup): string {
  return grp === "green" ? "tier-green" : grp === "amber" ? "tier-amber" : "tier-red";
}

export function tierFromScore(score: number): string {
  for (const x of TIERS) if (score >= x.min) return x.t;
  return "C";
}
