import { describe, expect, it } from "vitest";
import { QUESTION_MS, RUSH_QUESTION_MS, questionMs } from "@/lib/game-rules";

describe("questionMs", () => {
  it("rush questions last 25 seconds", () => expect(questionMs("rush")).toBe(25_000));
  it("classic questions still last 15 seconds", () => expect(questionMs("classic")).toBe(QUESTION_MS));
  it("rush is longer than classic", () => expect(RUSH_QUESTION_MS).toBeGreaterThan(QUESTION_MS));
});
