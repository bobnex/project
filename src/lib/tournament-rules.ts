// Pure tournament rules shared by every client. Kept free of Firebase so they can be tested.

export type TournamentFormat = "elimination" | "groups" | "league";
export type TournamentStatus = "registration" | "running" | "completed" | "cancelled";
export type Tiebreaker = "diff" | "won" | "for" | "against" | "name";

export interface Tournament {
  id: string;
  name: string;
  description: string;
  format: TournamentFormat;
  subject: string;
  status: TournamentStatus;
  requireApproval: boolean;
  maxParticipants: number;
  questionsPerMatch: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: Tiebreaker[];
  /** League only: how many divisions. Index 0 is the top flight. */
  divisionCount: number;
  divisionNames: string[];
  promoteSlots: number;
  relegateSlots: number;
  /** League only: days each gameweek stays open. */
  gameweekDays: number;
  /** Groups only: players per group (approx). */
  groupSize: number;
  /** Groups only: how many per group reach the knockout. */
  qualifiers: number;
  season: number;
  seasonStartedAt: number;
  seasonEndsAt: number;
  participantCount: number;
  /** Prize text for 1st, 2nd, 3rd place. */
  prizes?: string[];
  createdBy: string;
  createdAt: number;
}

export type TournamentPlayerStatus =
  | "pending" | "approved" | "rejected" | "active" | "eliminated" | "champion";

export interface TournamentPlayer {
  id: string;
  tournamentId: string;
  uid: string;
  name: string;
  status: TournamentPlayerStatus;
  /** 0 = top division (league). */
  division: number;
  group: number | null;
  seed: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  registeredAt: number;
}

export type FixtureStage = "league" | "group" | "knockout";

export interface Fixture {
  id: string;
  tournamentId: string;
  stage: FixtureStage;
  /** Gameweek for league/group, knockout round number for elimination. */
  round: number;
  group: number | null;
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  status: "scheduled" | "ready" | "completed" | "void";
  matchId: string | null;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  deadline: number;
  decidedBy?: "score" | "tiebreak" | "draw" | "walkover";
  applied?: boolean;
  createdAt: number;
}

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ["diff", "won", "for", "name"];

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  diff: "Score difference",
  won: "Wins",
  for: "Score scored",
  against: "Score conceded",
  name: "Player name",
};

const NICE_DIVISIONS = [
  "Premier Division", "Championship", "League One", "League Two",
  "League Three", "Conference", "Regional North", "Regional South",
];

/** Nice default division names; the admin can override any of them. */
export function divisionNames(count: number, custom?: string[]): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const c = custom?.[i]?.trim();
    return c || NICE_DIVISIONS[i] || `Division ${i + 1}`;
  });
}

/** Single round-robin (circle method); one list of pairings per round. Odd counts get a bye each round. */
export function roundRobin(ids: string[]): Array<Array<[string, string]>> {
  const list: (string | null)[] = ids.length % 2 ? [...ids, null] : [...ids];
  const n = list.length;
  const rounds: Array<Array<[string, string]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    const last = list.pop();
    if (last !== undefined) list.splice(1, 0, last);
  }
  return rounds;
}

/** Distribute players snake-style so early seeds spread across groups/divisions. */
export function snakeGroups(ids: string[], count: number): string[][] {
  const groups = Array.from({ length: Math.max(1, count) }, () => [] as string[]);
  ids.forEach((id, i) => {
    const col = i % count;
    const row = Math.floor(i / count);
    const idx = row % 2 ? count - 1 - col : col;
    groups[idx].push(id);
  });
  return groups;
}

/** Pairs still-alive players for the next knockout round (seed 1 vs last seed…). */
export function bracketPairs(alive: string[]): Array<[string, string | null]> {
  const ids = [...alive];
  if (ids.length < 2) return [];
  if (ids.length % 2) {
    const bye = ids.pop()!;
    return [[bye, null], ...innerPairs(ids)];
  }
  return innerPairs(ids);
}

function innerPairs(ids: string[]): Array<[string, string | null]> {
  const out: Array<[string, string | null]> = [];
  for (let i = 0; i < ids.length / 2; i++) out.push([ids[i], ids[ids.length - 1 - i]]);
  return out;
}

export type FixtureOutcome = { winnerId: string | null; decidedBy: "score" | "tiebreak" | "draw" };

/** Higher score wins; ties break on correct answers; a perfect tie is a draw. */
export function fixtureWinner(
  aId: string, bId: string, scoreA: number, scoreB: number, correctA = 0, correctB = 0,
): FixtureOutcome {
  if (scoreA !== scoreB) return { winnerId: scoreA > scoreB ? aId : bId, decidedBy: "score" };
  if (correctA !== correctB) return { winnerId: correctA > correctB ? aId : bId, decidedBy: "tiebreak" };
  return { winnerId: null, decidedBy: "draw" };
}

export function gameweekDeadline(seasonStartedAt: number, round: number, gameweekDays: number): number {
  return seasonStartedAt + round * Math.max(1, gameweekDays) * 86_400_000;
}

/** Sorted table: points first, then the admin's tie-breakers in order. */
export function standings(rows: TournamentPlayer[], tiebreakers: Tiebreaker[] = DEFAULT_TIEBREAKERS): TournamentPlayer[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const tb of tiebreakers) {
      if (tb === "diff") {
        const d = b.scoreFor - b.scoreAgainst - (a.scoreFor - a.scoreAgainst);
        if (d) return d;
      } else if (tb === "won") {
        if (b.won !== a.won) return b.won - a.won;
      } else if (tb === "for") {
        if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
      } else if (tb === "against") {
        if (a.scoreAgainst !== b.scoreAgainst) return a.scoreAgainst - b.scoreAgainst;
      } else if (tb === "name") {
        return a.name.localeCompare(b.name);
      }
    }
    return a.uid.localeCompare(b.uid);
  });
}

/** uid → new division index after a season ends. Divisions are ordered 0 (top) → n-1. */
export function applySeasonMoves(
  tables: TournamentPlayer[][],
  promote: number,
  relegate: number,
): Record<string, number> {
  const moves: Record<string, number> = {};
  const bottom = tables.length - 1;
  for (let d = 0; d < tables.length; d++) {
    const table = standings(tables[d] ?? []);
    if (table.length <= promote + relegate) continue; // too small a division to move anyone safely
    if (d > 0) table.slice(0, promote).forEach((p) => { moves[p.uid] = d - 1; });
    if (d < bottom) table.slice(table.length - relegate).forEach((p) => { moves[p.uid] = d + 1; });
  }
  return moves;
}

export type StatDelta = {
  points: number; played: number; won: number; drawn: number; lost: number;
  scoreFor: number; scoreAgainst: number;
};

/** Season stat increments for one side of a finished fixture. */
export function fixtureStats(
  score: number, oppScore: number, result: "win" | "draw" | "loss",
  cfg: Pick<Tournament, "pointsWin" | "pointsDraw" | "pointsLoss">,
): StatDelta {
  const base: StatDelta = {
    points: result === "win" ? cfg.pointsWin : result === "draw" ? cfg.pointsDraw : cfg.pointsLoss,
    played: 1,
    won: result === "win" ? 1 : 0,
    drawn: result === "draw" ? 1 : 0,
    lost: result === "loss" ? 1 : 0,
    scoreFor: score,
    scoreAgainst: oppScore,
  };
  return base;
}

export function emptyStats(): StatDelta {
  return { points: 0, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0 };
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  elimination: "Single Elimination",
  groups: "Group Stage",
  league: "League",
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  registration: "Registration open",
  running: "In progress",
  completed: "Finished",
  cancelled: "Cancelled",
};

/** Gold, silver, bronze finishers from a finished knockout. Bronze may hold two semi-final losers. */
export function knockoutPodium(fixtures: Fixture[]): { first: string | null; second: string | null; third: string[] } {
  const ko = fixtures.filter((f) => f.stage === "knockout" && f.status !== "void");
  const empty = { first: null, second: null, third: [] as string[] };
  if (!ko.length) return empty;
  const last = Math.max(...ko.map((f) => f.round));
  const finals = ko.filter((f) => f.round === last);
  const final = finals[0];
  if (finals.length !== 1 || !final || final.status !== "completed" || !final.winnerId) return empty;
  const loser = (f: Fixture) => (f.winnerId === f.aId ? f.bName : f.aName);
  const third = ko.filter((f) => f.round === last - 1 && f.status === "completed" && f.winnerId && f.bId).map(loser);
  return { first: final.winnerId === final.aId ? final.aName : final.bName, second: final.bId ? loser(final) : null, third };
}

/** Prize text per place (index 0 = 1st), trimmed, max 3, empties dropped from the end. */
export function cleanPrizes(list: unknown): string[] {
  const arr = Array.isArray(list) ? list.slice(0, 3).map((p) => (typeof p === "string" ? p.trim().slice(0, 80) : "")) : [];
  while (arr.length && !arr[arr.length - 1]) arr.pop();
  return arr;
}
