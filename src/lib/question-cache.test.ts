import { describe, it, expect, vi, beforeEach } from "vitest";
const getDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), limit: vi.fn(),
  getDocs: (...a: unknown[]) => getDocs(...a),
}));
import { getSubjectQuestions, clearQuestionCache, QUESTION_CACHE_TTL_MS } from "./question-cache";

describe("question cache", () => {
  beforeEach(() => { clearQuestionCache(); getDocs.mockReset(); getDocs.mockResolvedValue({ docs: [{ id: "q1", data: () => ({ text: "x" }) }] }); });
  it("TTL is 2 hours", () => expect(QUESTION_CACHE_TTL_MS).toBe(7_200_000));
  it("reuses cached questions within 2 hours", async () => {
    const t = Date.now();
    await getSubjectQuestions({} as never, "CHM101", t);
    await getSubjectQuestions({} as never, "CHM101", t + QUESTION_CACHE_TTL_MS - 1000);
    expect(getDocs).toHaveBeenCalledTimes(1);
  });
  it("refetches after 2 hours", async () => {
    const t = Date.now();
    await getSubjectQuestions({} as never, "CHM101", t);
    await getSubjectQuestions({} as never, "CHM101", t + QUESTION_CACHE_TTL_MS + 1000);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });
});
