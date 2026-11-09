import { describe, expect, it } from "vitest";
import { GHOST_WAIT_MS, ghostReplay, isUsableGhost } from "@/lib/ghost-rules";

describe("ghost rivals", () => {
  it("only offers a ghost after 25 seconds", () => {
    expect(GHOST_WAIT_MS).toBe(25_000);
  });
  it("replays a fast correct answer early and keeps its points", () => {
    const [s] = ghostReplay({ 0: { choice: 1, correct: true, points: 150 } }, 1, 15_000);
    expect(s).toEqual({ atMs: 0, correct: true, points: 150 });
  });
  it("leaves unanswered questions unanswered", () => {
    expect(ghostReplay({}, 2)[1].atMs).toBeNull();
  });
  it("never uses the player themselves as a ghost", () => {
    const a = { 0: { choice: 0, correct: true, points: 120 }, 1: { choice: 0, correct: false, points: 0 }, 2: { choice: 0, correct: true, points: 110 } };
    expect(isUsableGhost("me", "me", a)).toBe(false);
    expect(isUsableGhost("other", "me", a)).toBe(true);
  });
});
