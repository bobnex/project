import { describe, expect, it } from "vitest";
import { CLASSIC_QUESTIONS } from "@/lib/game-rules";

describe("classic (1v1) battles", () => {
  it("uses 20 questions", () => expect(CLASSIC_QUESTIONS).toBe(20));
});
