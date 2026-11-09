import { describe, expect, it } from "vitest";
import { buildBattleCardData, getBattleCardFileName } from "@/lib/shareable-battle-card";
import type { Match } from "@/lib/game-rules";

const m = {
  id: "x", mode: "classic", playerIds: ["a", "b"], questionIds: ["1", "2", "3", "4"], winnerIds: ["a"],
  players: { a: { name: "Ada Obi", score: 300, correct: 3 }, b: { name: "Tunde", score: 100, correct: 1 } },
} as unknown as Match;

describe("battle card", () => {
  it("shows correct count and accuracy", () => {
    const c = buildBattleCardData(m, "a");
    expect(c.correct).toBe(3);
    expect(c.accuracy).toBe(75);
  });
  it("names the file after the result and player", () => {
    const c = buildBattleCardData(m, "a");
    expect(getBattleCardFileName(c)).toBe(`favoje-${c.status}-ada-obi.png`);
  });
});
