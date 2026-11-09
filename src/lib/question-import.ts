// Parses an admin's bulk JSON question import.
export type ImportedQuestion = {
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  options: string[];
  correctIndex: number;
};

export const IMPORT_EXAMPLE = `[
  {
    "course": "Mathematics",
    "topic": "Algebra",
    "question": "Solve for x: 2x = 10",
    "options": ["2", "5", "10", "20"],
    "answer": 1
  }
]`;

export function parseQuestionImport(raw: string): { questions: ImportedQuestion[]; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { questions: [], errors: ["That isn't valid JSON."] };
  }
  if (!Array.isArray(data)) data = (data as { questions?: unknown })?.questions;
  if (!Array.isArray(data)) return { questions: [], errors: ["Expected a list of questions."] };
  const questions: ImportedQuestion[] = [];
  const errors: string[] = [];
  data.forEach((item: Record<string, unknown>, i: number) => {
    const n = i + 1;
    const subject = String(item?.course ?? item?.subject ?? "").trim();
    const topic = String(item?.topic ?? "").trim();
    const text = String(item?.question ?? item?.text ?? "").trim();
    const options = Array.isArray(item?.options) ? item.options.map((o) => String(o).trim()) : [];
    const ans = item?.answer ?? item?.correctIndex;
    const correctIndex = typeof ans === "number" ? ans : options.indexOf(String(ans ?? "").trim());
    const d = String(item?.difficulty ?? "medium").toLowerCase();
    if (!subject) return errors.push(`#${n}: missing course`);
    if (!text) return errors.push(`#${n}: missing question`);
    if (options.length < 2 || options.length > 6 || options.some((o) => !o)) return errors.push(`#${n}: needs 2–6 non-empty options`);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return errors.push(`#${n}: answer must match an option`);
    questions.push({ subject, topic, text, options, correctIndex, difficulty: d === "easy" || d === "hard" ? d : "medium" });
  });
  return { questions, errors };
}
