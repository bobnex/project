export type GeneratedQuestion = {
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  options: string[];
  correctIndex: number;
};

export function validateQuestionPack(raw: unknown, subject: string, topic: string, count: number): GeneratedQuestion[] {
  const list = (raw as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list) || list.length !== count) throw new Error(`The AI must return exactly ${count} valid questions. Nothing was saved.`);
  const seen = new Set<string>();
  return list.map((item) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.trim() : "";
    const options = Array.isArray(q.options) ? q.options.map((opt) => typeof opt === "string" ? opt.trim() : "") : [];
    const index = q.correctIndex;
    const key = text.toLowerCase();
    if (!text || seen.has(key) || options.length !== 4 || options.some((o) => !o) ||
      new Set(options.map((o) => o.toLowerCase())).size !== 4 || typeof index !== "number" ||
      !Number.isInteger(index) || index < 0 || index > 3) {
      throw new Error("The AI returned an invalid question or answer. Nothing was saved; try generating again.");
    }
    seen.add(key);
    return { subject, topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : topic,
      difficulty: q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium",
      text, options, correctIndex: index };
  });
}