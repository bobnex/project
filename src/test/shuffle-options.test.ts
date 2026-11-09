import { describe, expect, it } from "vitest";
import { shuffleOptions, type Question } from "@/lib/engine";
const q: Question = { id: "q1", text: "?", options: ["a", "b", "c", "d"], correctIndex: 2, subject: "x", active: true };
describe("shuffleOptions", () => {
  it("keeps the correct answer pointing at the same text", () => {
    for (let i = 0; i < 50; i++) { const s = shuffleOptions(q, "m" + i); expect(s.options[s.correctIndex]).toBe("c"); }
  });
  it("gives every player in the same match the same order", () => {
    expect(shuffleOptions(q, "match1").options).toEqual(shuffleOptions(q, "match1").options);
  });
  it("varies the order across matches", () => {
    const orders = new Set(Array.from({ length: 30 }, (_, i) => shuffleOptions(q, "m" + i).options.join("")));
    expect(orders.size).toBeGreaterThan(5);
  });
});
