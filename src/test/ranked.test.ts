import { describe, expect, it } from "vitest";
import { DEFAULT_RANKED as C, applyRankedResult, matchRange, rankFor, seasonId, seasonResetRp, seasonRollover } from "@/lib/ranked";

const NOW = Date.UTC(2026, 9, 31);
const placed = (rp: number) => ({ rp, placed: true, seasonId: seasonId(NOW) });

describe("rank thresholds", () => {
  it("has 10 ranks with the specified starting RP", () => {
    expect(C.tiers.map((t) => [t.name, t.min])).toEqual([
      ["Iron", 0], ["Bronze", 500], ["Silver", 1000], ["Gold", 1500], ["Platinum", 2000],
      ["Emerald", 2500], ["Diamond", 3000], ["Master", 3500], ["Grandmaster", 4000], ["Legend", 4500],
    ]);
  });
  it("splits ranks into III, II, I and Legend has none", () => {
    expect(rankFor(0).label).toBe("Iron III");
    expect(rankFor(499).label).toBe("Iron I");
    expect(rankFor(1500).label).toBe("Gold III");
    expect(rankFor(4500).label).toBe("Legend");
    expect(rankFor(9000).division).toBeNull();
  });
});

describe("RP changes", () => {
  it("victory +25", () => expect(applyRankedResult(placed(100), "win", C, NOW).rpAfter).toBe(125));
  it("defeat -20", () => expect(applyRankedResult(placed(100), "loss", C, NOW).rpAfter).toBe(80));
  it("draw +2", () => expect(applyRankedResult(placed(100), "draw", C, NOW).rpAfter).toBe(102));
  it("never below 0", () => expect(applyRankedResult(placed(10), "loss", C, NOW).rpAfter).toBe(0));
  it("promotes across a rank threshold", () => expect(applyRankedResult(placed(490), "win", C, NOW).change).toBe("promoted"));
  it("demotes Legend with no protection", () => {
    const o = applyRankedResult(placed(4510), "loss", C, NOW);
    expect(o.change).toBe("demoted");
    expect(o.rankAfter).toBe("Grandmaster I");
  });
});

describe("placement", () => {
  it("stays unranked until 5 battles then starts at wins × 100", () => {
    let s = { seasonId: seasonId(NOW) } as Record<string, unknown>;
    const results = ["win", "loss", "win", "win", "loss"] as const;
    let last;
    for (const r of results) {
      last = applyRankedResult(s, r, C, NOW);
      s = { ...s, ...last.patch };
      if (r !== results[4] || s.placementPlayed !== 5) expect(s.placed).toBeFalsy();
    }
    expect(s.placed).toBe(true);
    expect(s.rp).toBe(300);
    expect(last!.placementJustFinished).toBe(true);
  });
  it("cannot be repeated once placed", () => {
    const o = applyRankedResult({ ...placed(300), placementPlayed: 5, placementWins: 3 }, "win", C, NOW);
    expect(o.patch.placementPlayed).toBeUndefined();
    expect(o.rpAfter).toBe(325);
  });
});

describe("seasons", () => {
  it("keeps 75% rounded down", () => expect(seasonResetRp(1999, 75)).toBe(1499));
  it("resets and archives when a new 3-month season starts", () => {
    const r = seasonRollover({ rp: 2000, placed: true, seasonId: "2026-S3", seasonWins: 4 }, C, NOW);
    expect(r.patch.rp).toBe(1500);
    expect(r.patch.seasonId).toBe("2026-S4");
    expect(r.archive).toMatchObject({ seasonId: "2026-S3", finalRp: 2000, wins: 4 });
  });
});

describe("matchmaking", () => {
  it("widens the RP range the longer a player waits", () => {
    expect(matchRange(0)).toBe(150);
    expect(matchRange(10_000)).toBe(300);
  });
});

import { pickOpponent } from "@/lib/ranked";
describe("rank-based matchmaking", () => {
  const T = 1_000_000;
  it("starts within 150 RP", () => {
    expect(pickOpponent({ rp: 1000, createdAt: T }, [{ id: "a", rp: 1200, createdAt: T }], T)).toBeNull();
    expect(pickOpponent({ rp: 1000, createdAt: T }, [{ id: "a", rp: 1150, createdAt: T }], T)?.id).toBe("a");
  });
  it("widens by 15 RP per second waited", () => {
    // 10s wait → 150 + 150 = 300
    expect(pickOpponent({ rp: 1000, createdAt: T }, [{ id: "a", rp: 1300, createdAt: T - 10_000 }], T)?.id).toBe("a");
    expect(pickOpponent({ rp: 1000, createdAt: T }, [{ id: "a", rp: 1301, createdAt: T - 10_000 }], T)).toBeNull();
  });
  it("prefers the closest RP", () => {
    const e = [{ id: "far", rp: 1100, createdAt: T }, { id: "near", rp: 1020, createdAt: T }];
    expect(pickOpponent({ rp: 1000, createdAt: T }, e, T)?.id).toBe("near");
  });
});

describe("rank extras", () => {
  it("adds +5 streak bonus on the 3rd ranked win in a row", () => {
    const o = applyRankedResult({ ...placed(100), rankedStreak: 2 }, "win", C, NOW);
    expect(o.streakBonus).toBe(5);
    expect(o.rpAfter).toBe(130);
  });
  it("no streak bonus on the 2nd win", () => expect(applyRankedResult({ ...placed(100), rankedStreak: 1 }, "win", C, NOW).rpAfter).toBe(125));
  it("a loss resets the ranked streak", () => expect(applyRankedResult({ ...placed(100), rankedStreak: 4 }, "loss", C, NOW).patch.rankedStreak).toBe(0));
  it("demotion shield holds the player at the rank floor once", () => {
    const cfg = { ...C, demotionShield: 1 };
    const a = applyRankedResult(placed(505), "loss", cfg, NOW);
    expect(a.shielded).toBe(true);
    expect(a.rpAfter).toBe(500);
    const b = applyRankedResult({ ...placed(500), shieldUsed: 1 }, "loss", cfg, NOW);
    expect(b.change).toBe("demoted");
  });
  it("broken tier thresholds are repaired so ranks stay ordered", async () => {
    const { rankedConfig } = await import("@/lib/ranked");
    const cfg = rankedConfig({ tiers: [{ min: 0 }, { min: 0 }] as never });
    expect(cfg.tiers[1].min).toBeGreaterThan(cfg.tiers[0].min);
    expect(Number.isNaN(rankFor(1, cfg).progress)).toBe(false);
  });
});

describe("division boundaries", () => {
  it("never shows 0 RP to the next division", () => {
    for (let rp = 0; rp < 1200; rp++) {
      const r = rankFor(rp, C);
      if (r.nextAt !== null) expect(r.nextAt).toBeGreaterThan(rp);
      expect(rp).toBeGreaterThanOrEqual(r.floor);
    }
  });
});
