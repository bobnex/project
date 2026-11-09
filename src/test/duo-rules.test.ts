import { describe, expect, it } from "vitest";
import { DUO_SYNC_BONUS, computeWinners, newPlayer, openTeam, resultFor, syncBonuses, type Match } from "@/lib/game-rules";

function duo(scores: number[], answers: boolean[] = []): Match {
  const ids = ["a1", "a2", "b1", "b2"];
  const players = Object.fromEntries(ids.map((id, i) => [id, { ...newPlayer(id), team: i < 2 ? "A" : "B", score: scores[i],
    answers: answers.length ? { "0": { choice: 0, correct: answers[i], points: 100 } } : {} }]));
  return { mode: "duo", playerIds: ids, players, winnerIds: [] } as unknown as Match;
}

describe("2v2 tag team", () => {
  it("sync bonus is 40", () => expect(DUO_SYNC_BONUS).toBe(40));
  it("team with higher combined score wins", () => expect(computeWinners(duo([100, 100, 150, 0]))).toEqual(["a1", "a2"]));
  it("both winners get a win, not a draw", () => {
    const m = duo([100, 100, 150, 0]); m.winnerIds = computeWinners(m);
    expect(resultFor(m, "a2")).toBe("win"); expect(resultFor(m, "b1")).toBe("loss");
  });
  it("equal team totals is a draw", () => {
    const m = duo([100, 50, 75, 75]); m.winnerIds = computeWinners(m);
    expect(resultFor(m, "a1")).toBe("draw");
  });
  it("bonus only when both teammates are correct", () => {
    const u = syncBonuses(duo([100, 100, 100, 0], [true, true, true, false]), "0");
    expect(u["players.a1.score"]).toBe(140); expect(u["players.b1.score"]).toBeUndefined();
  });
  it("seats the newcomer on the smaller team", () => {
    const m = duo([0, 0, 0, 0]); m.playerIds = ["a1", "a2", "b1"]; delete (m.players as Record<string, unknown>).b2;
    expect(openTeam(m)).toBe("B");
  });
});
