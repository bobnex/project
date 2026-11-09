import { describe, expect, it } from "vitest";
import { rushQuestionCount } from "@/lib/game-rules";

describe("rushQuestionCount", () => {
  it("lowest is 25", () => expect(rushQuestionCount(() => 0)).toBe(25));
  it("highest is 30", () => expect(rushQuestionCount(() => 0.9999)).toBe(30));
});
