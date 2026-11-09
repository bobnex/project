import { describe, expect, it } from "vitest";
import { cleanPrizes, knockoutPodium, type Fixture } from "@/lib/tournament-rules";

const fx = (round: number, a: string, b: string, winner: string | null, status: Fixture["status"] = "completed") =>
  ({ id: `${round}${a}`, tournamentId: "t", stage: "knockout", round, group: null, aId: a, aName: a, bId: b, bName: b,
    status, matchId: null, scoreA: 0, scoreB: 0, winnerId: winner, deadline: 0, createdAt: 0 }) as Fixture;

describe("knockout podium", () => {
  it("gives 1st to final winner, 2nd to finalist, 3rd to semi losers", () => {
    const p = knockoutPodium([fx(1, "A", "B", "A"), fx(1, "C", "D", "D"), fx(2, "A", "D", "D")]);
    expect(p).toEqual({ first: "D", second: "A", third: ["B", "C"] });
  });
  it("is empty until the final is played", () => {
    expect(knockoutPodium([fx(1, "A", "B", "A"), fx(1, "C", "D", "D"), fx(2, "A", "D", null, "scheduled")]).first).toBeNull();
  });
});

describe("prizes", () => {
  it("keeps at most 3 places and drops trailing blanks", () => {
    expect(cleanPrizes([" ₦5000 ", "", "Badge", "extra"])).toEqual(["₦5000", "", "Badge"]);
    expect(cleanPrizes(["Cup", " ", ""])).toEqual(["Cup"]);
    expect(cleanPrizes(undefined)).toEqual([]);
  });
});
