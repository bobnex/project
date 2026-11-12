// Pure game rules shared by every client. Kept free of Firebase so they can be tested.

export const QUESTION_MS = 15_000;
/** Rush gives players longer to think: 25 seconds per question. */
export const RUSH_QUESTION_MS = 25_000;
export const REVEAL_MS = 2_500;
export const COUNTDOWN_MS = 4_000;
export const RUSH_LOBBY_MS = 30_000;
export const RUSH_MAX_PLAYERS = 50;
export const RUSH_MAX_WRONG = 2;
export const CLASSIC_QUESTIONS = 20;
export const RUSH_MIN_QUESTIONS = 25;
export const RUSH_MAX_QUESTIONS = 30;
/** Each Rush gets a random question count between 25 and 30 (inclusive). */
export function rushQuestionCount(rand: () => number = Math.random): number {
  return RUSH_MIN_QUESTIONS + Math.floor(rand() * (RUSH_MAX_QUESTIONS - RUSH_MIN_QUESTIONS + 1));
}

export type Mode = "classic" | "rush" | "duo";
export type Team = "A" | "B";
/** 2v2 Tag Team: when both teammates answer a question correctly, each earns a Sync bonus. */
export const DUO_SYNC_BONUS = 40;
export const DUO_TEAM_SIZE = 2;
/** Seconds allowed per question depend on the mode, or a custom override if configured for a private room. */
export function questionMs(mode: Mode, customSec?: number): number {
  if (typeof customSec === "number" && customSec > 0) return customSec * 1000;
  return mode === "rush" ? RUSH_QUESTION_MS : QUESTION_MS;
}
export type Status = "waiting" | "countdown" | "active" | "completed" | "cancelled";
export type Result = "win" | "loss" | "draw";

export interface Answer {
  choice: number;
  correct: boolean;
  points: number;
  sync?: boolean;
}
export interface Player {
  name: string;
  score: number;
  correct: number;
  wrong: number;
  eliminated: boolean;
  eliminatedAt: number | null;
  answers: Record<string, Answer>;
  applied?: boolean;
  team?: Team;
}
export interface Match {
  id: string;
  mode: Mode;
  status: Status;
  phase: "question" | "reveal";
  hostId: string;
  code: string | null;
  lobbyKey: string | null;
  ranked: boolean;
  maxPlayers: number;
  playerIds: string[];
  players: Record<string, Player>;
  questionIds: string[];
  currentIndex: number;
  deadline: number;
  revealEndsAt: number;
  countdownEndsAt: number;
  lobbyEndsAt: number;
  createdAt: number;
  winnerIds: string[];
  /** Optional custom room modifiers */
  secondsPerQuestion?: number;
  questionCount?: number;
  /** Set when this battle belongs to a tournament fixture. */
  fixtureId?: string;
  tournamentId?: string;
  clanWarId?: string;
  clanAId?: string;
  clanBId?: string;
  forfeitedUid?: string;
}

export function newPlayer(name: string): Player {
  return { name, score: 0, correct: 0, wrong: 0, eliminated: false, eliminatedAt: null, answers: {} };
}

/** Correct answers earn 100 points plus up to 50 for speed. Wrong answers earn 0. */
export function pointsFor(correct: boolean, msRemaining: number, totalMs = QUESTION_MS): number {
  if (!correct) return 0;
  const ratio = Math.min(1, Math.max(0, msRemaining / totalMs));
  return 100 + Math.round(50 * ratio);
}

export function isEliminated(wrong: number): boolean {
  return wrong >= RUSH_MAX_WRONG;
}

export function ratingDelta(result: Result): number {
  return result === "win" ? 25 : result === "loss" ? -15 : 0;
}

export function xpFor(result: Result, score: number): number {
  const base = result === "win" ? 50 : result === "draw" ? 30 : 15;
  return base + Math.floor(score / 50);
}

export function coinsFor(result: Result): number {
  return result === "win" ? 20 : result === "draw" ? 10 : 5;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

/** XP needed to reach a given level. */
export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 100;
}

export function alivePlayers(m: Match): string[] {
  return m.playerIds.filter((id) => m.players[id] && !m.players[id].eliminated);
}

export function teamOf(m: Match, team: Team): string[] {
  return m.playerIds.filter((id) => m.players[id]?.team === team);
}
export function teamScore(m: Match, team: Team): number {
  return teamOf(m, team).reduce((t, id) => t + (m.players[id]?.score ?? 0), 0);
}
/** Team with fewer members (A on ties) — where a new 2v2 player is seated. */
export function openTeam(m: Match): Team | null {
  const a = teamOf(m, "A").length, b = teamOf(m, "B").length;
  if (a >= DUO_TEAM_SIZE && b >= DUO_TEAM_SIZE) return null;
  return b < a ? "B" : "A";
}
/** Score updates for a team whose members both answered question idx correctly. */
export function syncBonuses(m: Match, idx: string): Record<string, unknown> {
  const upd: Record<string, unknown> = {};
  for (const t of ["A", "B"] as Team[]) {
    const ids = teamOf(m, t);
    if (ids.length === DUO_TEAM_SIZE && ids.every((id) => m.players[id].answers?.[idx]?.correct)) {
      for (const id of ids) {
        upd[`players.${id}.score`] = m.players[id].score + DUO_SYNC_BONUS;
        upd[`players.${id}.answers.${idx}.sync`] = true;
      }
    }
  }
  return upd;
}

export function computeWinners(m: Match): string[] {
  if (m.mode === "duo") {
    const a = teamScore(m, "A"), b = teamScore(m, "B");
    return a === b ? [...m.playerIds] : teamOf(m, a > b ? "A" : "B");
  }
  const alive = alivePlayers(m);
  const pool = m.mode === "rush" && alive.length > 0 ? alive : m.playerIds;
  const best = Math.max(...pool.map((id) => m.players[id]?.score ?? 0));
  return pool.filter((id) => (m.players[id]?.score ?? 0) === best);
}

export function resultFor(m: Match, uid: string): Result {
  if (!m.winnerIds.includes(uid)) return "loss";
  if (m.mode === "duo") return m.winnerIds.length === m.playerIds.length ? "draw" : "win";
  return m.winnerIds.length > 1 ? "draw" : "win";
}

/** Final standings: survivors first, then later eliminations, then higher scores. */
export function standings(m: Match): string[] {
  return [...m.playerIds].sort((a, b) => {
    const pa = m.players[a];
    const pb = m.players[b];
    if (pa.eliminated !== pb.eliminated) return pa.eliminated ? 1 : -1;
    if (pa.eliminated && pb.eliminated && pa.eliminatedAt !== pb.eliminatedAt)
      return (pb.eliminatedAt ?? 0) - (pa.eliminatedAt ?? 0);
    return pb.score - pa.score;
  });
}

/**
 * Decides the next state transition for a match, or null if nothing should change.
 * Any participant's client may apply it inside a transaction; it is idempotent
 * because it re-reads fresh match data each time.
 */
export function nextState(m: Match, now: number): Record<string, unknown> | null {
  const n = m.playerIds.length;
  if (m.status === "waiting") {
    if (m.lobbyEndsAt > 0 && now >= m.lobbyEndsAt) {
      return n >= 2
        ? { status: "countdown", countdownEndsAt: now + COUNTDOWN_MS, lobbyKey: null }
        : { lobbyEndsAt: now + RUSH_LOBBY_MS };
    }
    if (m.fixtureId && n >= 2) return { status: "countdown", countdownEndsAt: now + COUNTDOWN_MS };
    return null;
  }
  if (m.status === "countdown") {
    return now >= m.countdownEndsAt
      ? { status: "active", phase: "question", currentIndex: 0, deadline: now + questionMs(m.mode, m.secondsPerQuestion) }
      : null;
  }
  if (m.status !== "active") return null;

  const alive = alivePlayers(m);
  const idx = String(m.currentIndex);

  if (m.phase === "question") {
    const allAnswered = alive.every((id) => m.players[id].answers?.[idx]);
    if (now < m.deadline && !allAnswered) return null;
    const upd: Record<string, unknown> = { phase: "reveal", revealEndsAt: now + REVEAL_MS };
    // Rush: staying silent counts as a wrong answer, so idle players get eliminated.
    if (m.mode === "rush") {
      for (const id of alive) {
        const p = m.players[id];
        if (!p.answers?.[idx]) {
          const wrong = p.wrong + 1;
          upd[`players.${id}.wrong`] = wrong;
          if (isEliminated(wrong)) {
            upd[`players.${id}.eliminated`] = true;
            upd[`players.${id}.eliminatedAt`] = m.currentIndex;
          }
        }
      }
    }
    if (m.mode === "duo") Object.assign(upd, syncBonuses(m, idx));
    return upd;
  }

  if (now < m.revealEndsAt) return null;
  const last = m.currentIndex + 1 >= m.questionIds.length;
  const rushOver = m.mode === "rush" && alive.length <= 1;
  if (last || rushOver) return { status: "completed", winnerIds: computeWinners(m) };
  return { phase: "question", currentIndex: m.currentIndex + 1, deadline: now + questionMs(m.mode, m.secondsPerQuestion) };
}
