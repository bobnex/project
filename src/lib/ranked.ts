// JUVORA RANKED — pure ranking rules. No Firebase here so every rule can be unit tested.
import type { Result } from "./game-rules";

export interface Tier { name: string; color: string; min: number }

export interface RankedConfig {
  enabled: boolean;
  tiers: Tier[];
  winRp: number;
  lossRp: number; // positive number subtracted on defeat
  drawRp: number;
  placementMatches: number;
  placementWinRp: number;
  mmBaseRange: number;
  mmExpandPerSec: number;
  mmMaxRange: number;
  seasonResetPct: number;
  /** Extra RP per win once a ranked win streak reaches `streakBonusFrom`. */
  streakBonusRp: number;
  streakBonusFrom: number;
  streakBonusMax: number;
  /** Ranked losses absorbed at a rank's starting RP before a demotion happens (0 = off). */
  demotionShield: number;
  /** Admin-configured active season number (e.g. 1) */
  seasonNumber?: number | undefined;
  /** Custom display name for the season (e.g. "Season 1") */
  seasonName?: string | undefined;
  /** Milliseconds timestamp when season began */
  seasonStartedAt?: number | undefined;
  /** Milliseconds timestamp when season concludes */
  seasonEndsAt?: number | undefined;
}

export const DEFAULT_TIERS: Tier[] = [
  { name: "Iron", color: "oklch(0.55 0.02 250)", min: 0 },
  { name: "Bronze", color: "oklch(0.62 0.12 55)", min: 500 },
  { name: "Silver", color: "oklch(0.8 0.02 250)", min: 1000 },
  { name: "Gold", color: "oklch(0.82 0.16 85)", min: 1500 },
  { name: "Platinum", color: "oklch(0.8 0.08 195)", min: 2000 },
  { name: "Emerald", color: "oklch(0.72 0.17 155)", min: 2500 },
  { name: "Diamond", color: "oklch(0.75 0.13 240)", min: 3000 },
  { name: "Master", color: "oklch(0.65 0.22 310)", min: 3500 },
  { name: "Grandmaster", color: "oklch(0.63 0.23 25)", min: 4000 },
  { name: "Legend", color: "oklch(0.86 0.17 95)", min: 4500 },
];

export const DEFAULT_RANKED: RankedConfig = {
  enabled: true,
  tiers: DEFAULT_TIERS,
  winRp: 25,
  lossRp: 20,
  drawRp: 2,
  placementMatches: 5,
  placementWinRp: 100,
  mmBaseRange: 150,
  mmExpandPerSec: 15,
  mmMaxRange: 5000,
  seasonResetPct: 75,
  streakBonusRp: 5,
  streakBonusFrom: 3,
  streakBonusMax: 25,
  demotionShield: 0,
};

/** Merge a stored (possibly partial) admin config onto defaults. */
export function rankedConfig(raw: Partial<RankedConfig> | undefined | null): RankedConfig {
  const c = { ...DEFAULT_RANKED, ...(raw ?? {}) };
  const tiers = DEFAULT_TIERS.map((d, i) => ({ ...d, ...(raw?.tiers?.[i] ?? {}) }));
  tiers[0].min = 0;
  // Keep thresholds strictly rising (at least 3 RP apart for divisions) so a bad admin edit can't break ranks.
  for (let i = 1; i < tiers.length; i++) {
    const m = Math.floor(Number(tiers[i].min));
    tiers[i].min = Number.isFinite(m) && m >= tiers[i - 1].min + 3 ? m : tiers[i - 1].min + 3;
  }
  const num = (v: unknown, d: number, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Number(v)) : d);
  return {
    ...c, tiers,
    winRp: num(c.winRp, DEFAULT_RANKED.winRp), lossRp: num(c.lossRp, DEFAULT_RANKED.lossRp), drawRp: num(c.drawRp, DEFAULT_RANKED.drawRp),
    placementMatches: num(c.placementMatches, DEFAULT_RANKED.placementMatches, 1),
    placementWinRp: num(c.placementWinRp, DEFAULT_RANKED.placementWinRp),
    seasonResetPct: Math.min(100, num(c.seasonResetPct, DEFAULT_RANKED.seasonResetPct)),
    streakBonusRp: num(c.streakBonusRp, DEFAULT_RANKED.streakBonusRp),
    streakBonusFrom: num(c.streakBonusFrom, DEFAULT_RANKED.streakBonusFrom, 1),
    streakBonusMax: num(c.streakBonusMax, DEFAULT_RANKED.streakBonusMax),
    demotionShield: num(c.demotionShield, DEFAULT_RANKED.demotionShield),
    seasonNumber: typeof c.seasonNumber === "number" && c.seasonNumber > 0 ? c.seasonNumber : undefined,
    seasonName: typeof c.seasonName === "string" && c.seasonName.trim() ? c.seasonName.trim() : undefined,
    seasonStartedAt: typeof c.seasonStartedAt === "number" && c.seasonStartedAt > 0 ? c.seasonStartedAt : undefined,
    seasonEndsAt: typeof c.seasonEndsAt === "number" && c.seasonEndsAt > 0 ? c.seasonEndsAt : undefined,
  };
}

const DIVS = ["III", "II", "I"] as const;

export interface RankInfo {
  tierIndex: number;
  tier: Tier;
  division: (typeof DIVS)[number] | null;
  divisionIndex: number; // 0 = III, 2 = I
  label: string;
  /** RP where the next division/rank starts, or null at the top. */
  nextAt: number | null;
  floor: number;
  progress: number; // 0..1 within current division
}

export function rankFor(rp0: number, cfg: RankedConfig = DEFAULT_RANKED): RankInfo {
  const tiers = cfg.tiers;
  const rp = Number.isFinite(rp0) ? Math.max(0, rp0) : 0;
  let ti = 0;
  for (let i = 0; i < tiers.length; i++) if (rp >= tiers[i].min) ti = i;
  const tier = tiers[ti];
  if (ti === tiers.length - 1) return { tierIndex: ti, tier, division: null, divisionIndex: 0, label: tier.name, nextAt: null, floor: tier.min, progress: 1 };
  const width = tiers[ti + 1].min - tier.min;
  const b = [tier.min, Math.round(tier.min + width / 3), Math.round(tier.min + (2 * width) / 3), tiers[ti + 1].min];
  const di = rp >= b[2] ? 2 : rp >= b[1] ? 1 : 0;
  const floor = b[di];
  const nextAt = b[di + 1];
  return { tierIndex: ti, tier, division: DIVS[di], divisionIndex: di, label: `${tier.name} ${DIVS[di]}`, nextAt, floor, progress: nextAt > floor ? Math.max(0, Math.min(1, (rp - floor) / (nextAt - floor))) : 1 };
}

/** Comparable rank position: higher = better. */
export function rankScore(r: RankInfo): number {
  return r.tierIndex * 3 + r.divisionIndex;
}

export function rpDelta(result: Result, cfg: RankedConfig = DEFAULT_RANKED): number {
  return result === "win" ? cfg.winRp : result === "loss" ? -cfg.lossRp : cfg.drawRp;
}

export interface RushMeta {
  place: number;
  totalPlayers: number;
  correct: number;
  totalQuestions: number;
}

/** Fair performance + placement scoring for multiplayer Rush 50 */
export function calculateRushRpDelta(meta: RushMeta, _cfg: RankedConfig = DEFAULT_RANKED): number {
  const { place, totalPlayers, correct, totalQuestions } = meta;

  // 1. Placement tier base
  let placementRp = 0;
  if (place === 1) {
    placementRp = 28;
  } else if (place <= 3) {
    placementRp = 14;
  } else if (place <= Math.ceil(totalPlayers / 2)) {
    placementRp = 6;
  } else {
    placementRp = -10;
  }

  // 2. Academic performance: +1 RP for every 2 correct answers
  const performanceRp = Math.floor(correct / 2);

  let net = placementRp + performanceRp;

  // 3. Accuracy protection: ≥60% accuracy guarantees no net RP loss
  const accuracy = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  if (accuracy >= 60 && net < 0) {
    net = 0;
  }

  // 4. Bound net delta between -15 and +35
  return Math.max(-15, Math.min(35, net));
}

export function seasonId(now: number, cfg?: RankedConfig | null): string {
  if (cfg?.seasonName && cfg.seasonName.trim()) return cfg.seasonName.trim();
  if (cfg?.seasonNumber && cfg.seasonNumber > 0) return `Season ${cfg.seasonNumber}`;
  const d = new Date(now);
  return `${d.getUTCFullYear()}-S${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function seasonEnds(now: number, cfg?: RankedConfig | null): number {
  if (cfg?.seasonEndsAt && cfg.seasonEndsAt > 0) return cfg.seasonEndsAt;
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 3, 1);
}

export function weekKey(now: number): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export function monthKey(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

export function seasonResetRp(rp: number, pct: number): number {
  return Math.floor((rp * pct) / 100);
}

/** Ranked fields stored on users/{uid}. */
export interface RankedState {
  rp?: number;
  placed?: boolean;
  placementPlayed?: number;
  placementWins?: number;
  peakRp?: number;
  rankedSuspended?: boolean;
  seasonId?: string;
  seasonRp?: number;
  seasonWins?: number;
  seasonLosses?: number;
  seasonDraws?: number;
  weekKey?: string;
  weeklyRp?: number;
  monthKey?: string;
  monthlyRp?: number;
  rankedWins?: number;
  rankedLosses?: number;
  rankedDraws?: number;
  courseRp?: Record<string, number>;
  rankedStreak?: number;
  bestRankedStreak?: number;
  shieldUsed?: number;
}

export interface SeasonArchive { seasonId: string; finalRp: number; peakSeasonRp: number; wins: number; losses: number; draws: number; rank: string }

export function isRankedPlaced(s: Pick<RankedState, "placed" | "placementPlayed">, cfg: RankedConfig = DEFAULT_RANKED): boolean {
  return !!s.placed || (s.placementPlayed ?? 0) >= cfg.placementMatches;
}

/** If the stored season is old, returns the reset patch and an archive of the finished season. */
export function seasonRollover(s: RankedState, cfg: RankedConfig, now: number): { patch: Partial<RankedState>; archive: SeasonArchive | null } {
  const sid = seasonId(now, cfg);
  if (s.seasonId === sid) return { patch: {}, archive: null };
  if (!s.seasonId) return { patch: { seasonId: sid, seasonRp: 0, seasonWins: 0, seasonLosses: 0, seasonDraws: 0 }, archive: null };
  const rp = s.rp ?? 0;
  const archive: SeasonArchive = {
    seasonId: s.seasonId, finalRp: rp, peakSeasonRp: s.seasonRp ?? 0,
    wins: s.seasonWins ?? 0, losses: s.seasonLosses ?? 0, draws: s.seasonDraws ?? 0,
    rank: isRankedPlaced(s, cfg) ? rankFor(rp, cfg).label : "Unranked",
  };
  return {
    patch: { seasonId: sid, rp: isRankedPlaced(s, cfg) ? seasonResetRp(rp, cfg.seasonResetPct) : rp, seasonRp: 0, seasonWins: 0, seasonLosses: 0, seasonDraws: 0 },
    archive,
  };
}

export interface RankedOutcome {
  patch: RankedState;
  delta: number;
  rpBefore: number;
  rpAfter: number;
  placementJustFinished: boolean;
  streakBonus: number;
  shielded: boolean;
  inPlacement: boolean;
  change: "promoted" | "demoted" | "none";
  rankBefore: string;
  rankAfter: string;
}

/** Applies one completed ranked battle result. Caller must guarantee it runs once per match per player. */
export function applyRankedResult(
  s0: RankedState,
  result: Result,
  cfg: RankedConfig,
  now: number,
  courseKey?: string,
  rushMeta?: RushMeta
): RankedOutcome {
  const roll = seasonRollover(s0, cfg, now);
  const s: RankedState = { ...s0, ...roll.patch };
  const rpBefore = s.rp ?? 0;
  const placed = isRankedPlaced(s, cfg);
  const win = result === "win" ? 1 : 0, loss = result === "loss" ? 1 : 0, draw = result === "draw" ? 1 : 0;
  const patch: RankedState = {
    ...roll.patch,
    rankedWins: (s.rankedWins ?? 0) + win,
    rankedLosses: (s.rankedLosses ?? 0) + loss,
    rankedDraws: (s.rankedDraws ?? 0) + draw,
    seasonWins: (s.seasonWins ?? 0) + win,
    seasonLosses: (s.seasonLosses ?? 0) + loss,
    seasonDraws: (s.seasonDraws ?? 0) + draw,
  };
  const isRushWin = rushMeta ? rushMeta.place === 1 : result === "win";
  const streak = isRushWin ? (s.rankedStreak ?? 0) + 1 : 0;
  patch.rankedStreak = streak;
  patch.bestRankedStreak = Math.max(s.bestRankedStreak ?? 0, streak);
  let rpAfter = rpBefore;
  let placementJustFinished = false;
  let streakBonus = 0;
  let shielded = false;
  if (!placed) {
    const isRushTopHalf = rushMeta ? rushMeta.place <= Math.ceil(rushMeta.totalPlayers / 2) : false;
    const effectiveWin = rushMeta ? (isRushTopHalf ? 1 : 0) : win;
    const played = (s.placementPlayed ?? 0) + 1;
    const wins = (s.placementWins ?? 0) + effectiveWin;
    patch.placementPlayed = played;
    patch.placementWins = wins;
    if (played >= cfg.placementMatches) {
      patch.placed = true;
      rpAfter = wins * cfg.placementWinRp;
      placementJustFinished = true;
    }
  } else {
    if (isRushWin && streak >= cfg.streakBonusFrom) {
      streakBonus = Math.min(cfg.streakBonusMax, (streak - cfg.streakBonusFrom + 1) * cfg.streakBonusRp);
    }
    const baseDelta = rushMeta ? calculateRushRpDelta(rushMeta, cfg) : rpDelta(result, cfg);
    rpAfter = Math.max(0, rpBefore + baseDelta + streakBonus);

    const tierBefore = rankFor(rpBefore, cfg).tierIndex;
    if (baseDelta < 0 && cfg.demotionShield > 0 && rankFor(rpAfter, cfg).tierIndex < tierBefore && (s.shieldUsed ?? 0) < cfg.demotionShield) {
      rpAfter = cfg.tiers[tierBefore].min;
      patch.shieldUsed = (s.shieldUsed ?? 0) + 1;
      shielded = true;
    } else if (rankFor(rpAfter, cfg).tierIndex !== tierBefore) {
      patch.shieldUsed = 0;
    }
  }
  const delta = rpAfter - rpBefore;
  const wk = weekKey(now), mk = monthKey(now);
  if (placed || placementJustFinished) {
    patch.rp = rpAfter;
    patch.peakRp = Math.max(s.peakRp ?? 0, rpAfter);
    patch.seasonRp = (s.seasonRp ?? 0) + delta;
    patch.weekKey = wk;
    patch.weeklyRp = (s.weekKey === wk ? s.weeklyRp ?? 0 : 0) + delta;
    patch.monthKey = mk;
    patch.monthlyRp = (s.monthKey === mk ? s.monthlyRp ?? 0 : 0) + delta;
    if (courseKey) patch.courseRp = { ...(s.courseRp ?? {}), [courseKey]: Math.max(0, (s.courseRp?.[courseKey] ?? 0) + delta) };
  }
  const before = rankFor(rpBefore, cfg), after = rankFor(rpAfter, cfg);
  const change = !placed ? "none" : rankScore(after) > rankScore(before) ? "promoted" : rankScore(after) < rankScore(before) ? "demoted" : "none";
  return {
    patch, delta, rpBefore, rpAfter, placementJustFinished, streakBonus, shielded, inPlacement: !placed && !placementJustFinished, change,
    rankBefore: placed ? before.label : "Unranked", rankAfter: placed || placementJustFinished ? after.label : "Unranked",
  };
}

/** Allowed RP gap for a queue entry that has waited `waitedMs`. */
export function matchRange(waitedMs: number, cfg: RankedConfig = DEFAULT_RANKED): number {
  return Math.min(cfg.mmMaxRange, cfg.mmBaseRange + Math.floor(waitedMs / 1000) * cfg.mmExpandPerSec);
}

export function winRate(wins: number, losses: number, draws: number): number {
  const t = wins + losses + draws;
  return t ? Math.round((wins / t) * 100) : 0;
}

export interface QueueEntry { id: string; rp: number; createdAt: number }

/**
 * Picks the closest-RP opponent whose gap fits the wider of the two players' expanding ranges.
 * Ties go to whoever has waited longest.
 */
export function pickOpponent(me: { rp: number; createdAt: number }, entries: QueueEntry[], now: number, cfg: RankedConfig = DEFAULT_RANKED): QueueEntry | null {
  let best: QueueEntry | null = null;
  let bestGap = Infinity;
  for (const e of entries) {
    const gap = Math.abs(e.rp - me.rp);
    const range = matchRange(Math.max(now - me.createdAt, now - e.createdAt), cfg);
    if (gap > range) continue;
    if (gap < bestGap || (gap === bestGap && best && e.createdAt < best.createdAt)) { best = e; bestGap = gap; }
  }
  return best;
}

/** Placement only runs in ranked battles; once a player is placed, every finished battle moves their RP. */
export function countsForRank(matchRanked: boolean, s: Pick<RankedState, "placed" | "placementPlayed">, cfg: RankedConfig = DEFAULT_RANKED): boolean {
  return matchRanked || isRankedPlaced(s, cfg);
}
