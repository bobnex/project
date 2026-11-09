import { describe, expect, it } from "vitest";
import {
  applySeasonMoves, bracketPairs, divisionNames, fixtureStats, fixtureWinner, gameweekDeadline,
  roundRobin, snakeGroups, standings, type TournamentPlayer,
} from "@/lib/tournament-rules";

function player(uid: string, name: string, stats: Partial<TournamentPlayer> = {}): TournamentPlayer {
  return {
    id: uid, tournamentId: "t", uid, name, status: "active", division: 0, group: null, seed: 1,
    points: 0, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, registeredAt: 0,
    ...stats,
  };
}

describe("roundRobin", () => {
  it("gives every player the right number of matches with no repeats", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const rounds = roundRobin(ids);
    expect(rounds).toHaveLength(5);
    const seen = new Set<string>();
    const counts = new Map<string, number>(ids.map((i) => [i, 0]));
    for (const round of rounds) {
      expect(round).toHaveLength(3);
      for (const [a, b] of round) {
        expect(seen.has(`${a}${b}`)).toBe(false);
        seen.add(`${a}${b}`);
        seen.add(`${b}${a}`);
        counts.set(a, counts.get(a)! + 1);
        counts.set(b, counts.get(b)! + 1);
      }
    }
    for (const id of ids) expect(counts.get(id)).toBe(5);
  });

  it("handles an odd number of players", () => {
    const rounds = roundRobin(["a", "b", "c", "d", "e"]);
    expect(rounds).toHaveLength(5);
    for (const round of rounds) expect(round).toHaveLength(2);
    const seen = new Set<string>();
    for (const round of rounds) for (const [a, b] of round) {
      expect(seen.has(`${a}${b}`)).toBe(false);
      seen.add(`${a}${b}`); seen.add(`${b}${a}`);
    }
    expect(seen.size).toBe(20);
  });
});

describe("standings + tie-breakers", () => {
  it("applies the configured points system", () => {
    const cfg = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };
    expect(fixtureStats(30, 10, "win", cfg)).toMatchObject({ points: 3, played: 1, won: 1, scoreFor: 30, scoreAgainst: 10 });
    expect(fixtureStats(10, 10, "draw", cfg)).toMatchObject({ points: 1, drawn: 1 });
    expect(fixtureStats(5, 40, "loss", cfg)).toMatchObject({ points: 0, lost: 1 });
  });

  it("ranks by points, then score difference, then wins", () => {
    const rows = [
      player("c", "Cara", { points: 4, won: 1, drawn: 1, scoreFor: 300, scoreAgainst: 290 }),
      player("a", "Ada", { points: 6, won: 2, scoreFor: 250, scoreAgainst: 250 }),
      player("b", "Ben", { points: 6, won: 2, scoreFor: 260, scoreAgainst: 240 }),
      player("d", "Dami", { points: 4, won: 1, drawn: 1, scoreFor: 310, scoreAgainst: 300 }),
    ];
    const order = standings(rows).map((p) => p.uid);
    expect(order).toEqual(["b", "a", "d", "c"]);
  });

  it("falls back to name when everything is level", () => {
    const rows = [player("z", "Zara", { points: 3 }), player("m", "Musa", { points: 3 })];
    expect(standings(rows, ["name"]).map((p) => p.uid)).toEqual(["m", "z"]);
  });
});

describe("promotion and relegation", () => {
  it("moves the top and bottom of each division", () => {
    const div = (d: number, uids: [string, number][]) =>
      uids.map(([uid, pts]) => player(uid, uid, { division: d, points: pts }));
    const tables = [
      div(0, [["d1", 10], ["d2", 8], ["d3", 6], ["d4", 4]]),
      div(1, [["m1", 10], ["m2", 8], ["m3", 6], ["m4", 4]]),
      div(2, [["b1", 10], ["b2", 8], ["b3", 6], ["b4", 4]]),
    ];
    const moves = applySeasonMoves(tables, 1, 1);
    expect(moves).toEqual({ d4: 1, m1: 0, m4: 2, b1: 1 });
    expect(moves["d1"]).toBeUndefined();
    expect(moves["b4"]).toBeUndefined();
  });

  it("leaves tiny divisions untouched", () => {
    const tables = [
      [player("a", "A", { points: 5 }), player("b", "B", { points: 3 })],
      [player("c", "C", { points: 5 }), player("d", "D", { points: 3 })],
    ];
    expect(applySeasonMoves(tables, 1, 1)).toEqual({});
  });
});

describe("brackets and groups", () => {
  it("pairs 8 players into 4 matches", () => {
    const pairs = bracketPairs(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(pairs).toEqual([["1", "8"], ["2", "7"], ["3", "6"], ["4", "5"]]);
  });

  it("gives the lowest seed a bye with 5 players", () => {
    const pairs = bracketPairs(["1", "2", "3", "4", "5"]);
    expect(pairs).toEqual([["5", null], ["1", "4"], ["2", "3"]]);
  });

  it("spreads early seeds across groups", () => {
    const groups = snakeGroups(["1", "2", "3", "4", "5", "6"], 2);
    expect(groups[0]).toEqual(["1", "4", "5"]);
    expect(groups[1]).toEqual(["2", "3", "6"]);
  });

  it("names divisions nicely", () => {
    expect(divisionNames(3)).toEqual(["Premier Division", "Championship", "League One"]);
    expect(divisionNames(2, ["", "Falcon Tier"])[1]).toBe("Falcon Tier");
  });
});

describe("fixture winner", () => {
  it("breaks score ties with correct answers", () => {
    expect(fixtureWinner("a", "b", 500, 500, 4, 5).winnerId).toBe("b");
    expect(fixtureWinner("a", "b", 500, 500, 4, 4)).toEqual({ winnerId: null, decidedBy: "draw" });
    expect(fixtureWinner("a", "b", 510, 500).winnerId).toBe("a");
  });
});

describe("gameweek deadlines", () => {
  it("stages one gameweek per configured window", () => {
    expect(gameweekDeadline(1000, 1, 7)).toBe(1000 + 7 * 86_400_000);
    expect(gameweekDeadline(1000, 3, 7)).toBe(1000 + 21 * 86_400_000);
  });
});
