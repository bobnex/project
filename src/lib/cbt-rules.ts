// Pure CBT rules: course settings defaults, scoring and timing.
import type { Subject } from "./subjects";

export const CBT_DEFAULTS = { duration: 30, questionCount: 40, passMark: 50 } as const;

export interface CbtSettings {
  duration: number; // minutes for the whole test
  questionCount: number;
  passMark: number; // percent
  enabled: boolean;
  instructions: string;
}

export function cbtSettings(s: Partial<Subject>): CbtSettings {
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min ? Math.min(n, max) : d;
  };
  return {
    duration: num(s.cbtDuration, CBT_DEFAULTS.duration, 1, 600),
    questionCount: num(s.cbtQuestionCount, CBT_DEFAULTS.questionCount, 1, 500),
    passMark: num(s.cbtPassMark, CBT_DEFAULTS.passMark, 0, 100),
    enabled: s.cbtEnabled !== false,
    instructions: s.cbtInstructions ?? "",
  };
}

/** Milliseconds left in the whole test, never negative. */
export function timeLeftMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

export function formatClock(ms: number): string {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface CbtResult {
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  percent: number;
  passed: boolean;
}

/** answers[i] is the chosen option index for question i, or null if skipped. */
export function scoreCbt(correctIndexes: number[], answers: (number | null)[], passMark: number): CbtResult {
  let correct = 0;
  let unanswered = 0;
  correctIndexes.forEach((c, i) => {
    const a = answers[i];
    if (a === null || a === undefined) unanswered++;
    else if (a === c) correct++;
  });
  const total = correctIndexes.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { correct, wrong: total - correct - unanswered, unanswered, total, percent, passed: percent >= passMark };
}

/** Distinct topics in a course with question counts, sorted by name. Untagged questions are grouped as "General". */
export function topicsOf(questions: { topic?: string }[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const q of questions) {
    const t = q.topic?.trim() || "General";
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Topic tests get time in proportion to their question count (at least 1 minute). */
export function testDuration(settings: Pick<CbtSettings, "duration" | "questionCount">, questions: number): number {
  if (questions >= settings.questionCount) return settings.duration;
  return Math.max(1, Math.ceil((settings.duration * questions) / settings.questionCount));
}

export type CbtLevel = "easy" | "medium" | "hard";
export const CBT_LEVELS: CbtLevel[] = ["easy", "medium", "hard"];

/** A question's difficulty; untagged questions count as medium (the import default). */
export function levelOf(q: { difficulty?: string }): CbtLevel {
  return q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium";
}

/** Questions matching the chosen topic and difficulty (null = any). */
export function pickCbtPool<T extends { topic?: string; difficulty?: string }>(pool: T[], topic: string | null, level: CbtLevel | null): T[] {
  return pool.filter((q) => (!topic || (q.topic?.trim() || "General") === topic) && (!level || levelOf(q) === level));
}
