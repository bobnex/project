// Pure rules for "Ghost Rivals": replaying a real past player's recorded answers. No Firebase here.
import { QUESTION_MS, type Answer } from "./game-rules";

/** The Ghost Rival option appears only after this long without a real opponent. */
export const GHOST_WAIT_MS = 25_000;

export interface GhostStep {
  /** How many ms into the question the ghost locked in its answer; null = never answered. */
  atMs: number | null;
  correct: boolean;
  points: number;
}

/** Turns a past player's answers (keyed by question index) into a timed replay. */
export function ghostReplay(answers: Record<string, Answer> | undefined, count: number, totalMs = QUESTION_MS): GhostStep[] {
  return Array.from({ length: count }, (_, i) => {
    const a = answers?.[i];
    if (!a) return { atMs: null, correct: false, points: 0 };
    if (a.correct) {
      // points = 100 + 50 * remaining/total, so recover when they answered.
      const ratio = Math.min(1, Math.max(0, (a.points - 100) / 50));
      return { atMs: Math.round(totalMs * (1 - ratio)), correct: true, points: a.points };
    }
    return { atMs: Math.round(totalMs * 0.6), correct: false, points: 0 };
  });
}

/** A past player is usable as a ghost only if it is someone else and they answered at least 3 questions. */
export function isUsableGhost(ghostId: string, myUid: string, answers: Record<string, Answer> | undefined): boolean {
  return ghostId !== myUid && Object.keys(answers ?? {}).length >= 3;
}
