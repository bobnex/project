import { describe, expect, it } from "vitest";
import { cbtSettings, formatClock, scoreCbt, timeLeftMs } from "@/lib/cbt-rules";

describe("CBT rules", () => {
  it("uses the course's own duration for the whole test", () => {
    expect(cbtSettings({ cbtDuration: 45 }).duration).toBe(45);
    expect(cbtSettings({}).duration).toBe(30);
  });
  it("time never goes below zero", () => {
    expect(timeLeftMs(1000, 5000)).toBe(0);
    expect(formatClock(90_000)).toBe("01:30");
  });
  it("scores correct, wrong and skipped answers", () => {
    const r = scoreCbt([0, 1, 2, 3], [0, 1, 0, null], 50);
    expect(r).toMatchObject({ correct: 2, wrong: 1, unanswered: 1, percent: 50, passed: true });
    expect(scoreCbt([0, 1], [1, null], 50).passed).toBe(false);
  });
});

import { testDuration, topicsOf } from "@/lib/cbt-rules";
describe("course topics", () => {
  it("lists each topic with its question count", () => {
    expect(topicsOf([{ topic: "Optics" }, { topic: "Mechanics" }, { topic: "Optics" }, {}])).toEqual([
      { name: "General", count: 1 }, { name: "Mechanics", count: 1 }, { name: "Optics", count: 2 },
    ]);
  });
  it("gives a topic test time in proportion to its questions", () => {
    expect(testDuration({ duration: 30, questionCount: 40 }, 10)).toBe(8);
    expect(testDuration({ duration: 30, questionCount: 40 }, 40)).toBe(30);
  });
});

describe("CBT difficulty selector", () => {
  it("only gives hard questions when Hard is chosen, and medium includes untagged ones", async () => {
    const { pickCbtPool } = await import("@/lib/cbt-rules");
    const pool = [
      { id: 1, topic: "Algebra", difficulty: "hard" },
      { id: 2, topic: "Algebra", difficulty: "medium" },
      { id: 3, topic: "Algebra" },
      { id: 4, topic: "Calculus", difficulty: "hard" },
      { id: 5, topic: "Algebra", difficulty: "easy" },
    ];
    expect(pickCbtPool(pool, null, "hard").map((q) => q.id)).toEqual([1, 4]);
    expect(pickCbtPool(pool, "Algebra", "medium").map((q) => q.id)).toEqual([2, 3]);
    expect(pickCbtPool(pool, "Algebra", null).map((q) => q.id)).toEqual([1, 2, 3, 5]);
  });
});
