import { describe, expect, it } from "vitest";
import { parseQuestionImport } from "@/lib/question-import";

describe("bulk question import", () => {
  it("maps course, topic and question", () => {
    const r = parseQuestionImport('[{"course":"Physics","topic":"Optics","question":"Q?","options":["a","b"],"answer":"b"}]');
    expect(r.questions[0]).toMatchObject({ subject: "Physics", topic: "Optics", text: "Q?", correctIndex: 1 });
  });
  it("rejects a question without a course", () => {
    const r = parseQuestionImport('[{"question":"Q?","options":["a","b"],"answer":0}]');
    expect(r.questions).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });
});
