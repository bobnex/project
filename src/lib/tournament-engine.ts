// Tournament persistence: every write here is validated inside a transaction so
// scores and progression can't be double-applied, no matter which player's client runs it.
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, query, runTransaction, setDoc,
  updateDoc, where, writeBatch, type DocumentReference, type Firestore,
} from "firebase/firestore";
import { CLASSIC_QUESTIONS, COUNTDOWN_MS, newPlayer, type Match } from "./game-rules";
import { baseMatch, pickQuestions } from "./engine";
import {
  applySeasonMoves, bracketPairs, divisionNames, fixtureStats, fixtureWinner, gameweekDeadline,
  roundRobin, snakeGroups, standings,
  type Fixture, type StatDelta, type Tiebreaker, type Tournament, type TournamentFormat,
  type TournamentPlayer, type TournamentPlayerStatus,
} from "./tournament-rules";

export const DAY_MS = 86_400_000;

export interface TournamentDraft {
  name: string;
  description: string;
  format: TournamentFormat;
  subject: string;
  requireApproval: boolean;
  maxParticipants: number;
  questionsPerMatch: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: Tiebreaker[];
  divisionCount: number;
  divisionNames?: string[];
  promoteSlots: number;
  relegateSlots: number;
  gameweekDays: number;
  groupSize: number;
  qualifiers: number;
  seasonEndsAt: number;
}

function withId<T extends object>(d: T | undefined, id: string) {
  return d ? { ...d, id } : undefined;
}

export function playerDocId(tid: string, uid: string): string {
  return `${tid}_${uid}`;
}

function newFixture(
  t: Tournament, stage: Fixture["stage"], round: number, group: number | null,
  a: { uid: string; name: string }, b: { uid: string; name: string }, deadline: number,
): Omit<Fixture, "id"> {
  return {
    tournamentId: t.id, stage, round, group,
    aId: a.uid, aName: a.name, bId: b.uid, bName: b.name,
    status: "scheduled", matchId: null, scoreA: 0, scoreB: 0, winnerId: null,
    deadline, createdAt: Date.now(),
  };
}

type BatchOp = { ref: DocumentReference; set?: unknown; update?: unknown; del?: boolean };

async function commitOps(db: Firestore, ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      if (op.del) b.delete(op.ref);
      else if (op.set !== undefined) b.set(op.ref, op.set as Record<string, unknown>);
      else b.update(op.ref, op.update as Record<string, unknown>);
    }
    await b.commit();
  }
}

function statsPatch(d: StatDelta) {
  return {
    points: increment(d.points), played: increment(d.played), won: increment(d.won),
    drawn: increment(d.drawn), lost: increment(d.lost), scoreFor: increment(d.scoreFor),
    scoreAgainst: increment(d.scoreAgainst),
  };
}

const RESET_STATS = { points: 0, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0 };

/* ---------------- Admin: lifecycle ---------------- */

export async function createTournament(db: Firestore, uid: string, draft: TournamentDraft): Promise<string> {
  const ref = doc(collection(db, "tournaments"));
  const t: Omit<Tournament, "id"> = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    format: draft.format,
    subject: draft.subject,
    status: "registration",
    requireApproval: draft.requireApproval,
    maxParticipants: Math.max(2, draft.maxParticipants),
    questionsPerMatch: Math.min(40, Math.max(3, draft.questionsPerMatch || CLASSIC_QUESTIONS)),
    pointsWin: draft.pointsWin, pointsDraw: draft.pointsDraw, pointsLoss: draft.pointsLoss,
    tiebreakers: draft.tiebreakers.length ? draft.tiebreakers : ["diff", "won", "for", "name"],
    divisionCount: Math.max(1, draft.divisionCount),
    divisionNames: divisionNames(draft.divisionCount, draft.divisionNames),
    promoteSlots: Math.max(0, draft.promoteSlots),
    relegateSlots: Math.max(0, draft.relegateSlots),
    gameweekDays: Math.max(1, draft.gameweekDays),
    groupSize: Math.max(2, draft.groupSize),
    qualifiers: Math.max(1, draft.qualifiers),
    season: 1,
    seasonStartedAt: 0,
    seasonEndsAt: draft.seasonEndsAt,
    participantCount: 0,
    createdBy: uid,
    createdAt: Date.now(),
  };
  await setDoc(ref, t);
  return ref.id;
}

export async function updateTournament(db: Firestore, id: string, patch: Partial<Tournament>) {
  await updateDoc(doc(db, "tournaments", id), patch);
}

export async function deleteTournament(db: Firestore, id: string) {
  const ops: BatchOp[] = [{ ref: doc(db, "tournaments", id), del: true }];
  for (const col of ["t_fixtures", "t_players"]) {
    const snap = await getDocs(query(collection(db, col), where("tournamentId", "==", id)));
    snap.docs.forEach((d) => ops.push({ ref: d.ref, del: true }));
  }
  await commitOps(db, ops);
}

/* ---------------- Registration ---------------- */

export async function registerForTournament(db: Firestore, tid: string, uid: string, name: string) {
  await runTransaction(db, async (tx) => {
    const tRef = doc(db, "tournaments", tid);
    const ts = await tx.get(tRef);
    if (!ts.exists()) throw new Error("Tournament not found.");
    const t = withId(ts.data(), ts.id) as Tournament;
    if (t.status !== "registration") throw new Error("Registration is closed for this tournament.");
    const pRef = doc(db, "t_players", playerDocId(tid, uid));
    const existing = await tx.get(pRef);
    if (existing.exists() && (existing.data() as TournamentPlayer).status !== "rejected") return;
    if ((t.participantCount ?? 0) >= t.maxParticipants) throw new Error("This tournament is full.");
    tx.set(pRef, {
      id: playerDocId(tid, uid), tournamentId: tid, uid, name,
      status: t.requireApproval ? "pending" : "approved",
      division: 0, group: null, seed: (t.participantCount ?? 0) + 1,
      ...RESET_STATS, registeredAt: Date.now(),
    } satisfies Omit<TournamentPlayer, never> & Record<string, unknown>);
    tx.update(tRef, { participantCount: increment(1) });
  });
}

export async function leaveTournament(db: Firestore, tid: string, uid: string) {
  const t = withId((await getDoc(doc(db, "tournaments", tid))).data(), tid) as Tournament | undefined;
  if (!t || t.status !== "registration") throw new Error("You can only leave before the tournament starts.");
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, "t_players", playerDocId(tid, uid));
    const p = await tx.get(pRef);
    if (!p.exists()) return;
    const status = (p.data() as TournamentPlayer).status;
    if (status === "rejected") { tx.delete(pRef); return; }
    tx.delete(pRef);
    tx.update(doc(db, "tournaments", tid), { participantCount: increment(-1) });
  });
}

export async function adminUpdateParticipant(
  db: Firestore, tid: string, uid: string, patch: { status: TournamentPlayerStatus },
) {
  const pRef = doc(db, "t_players", playerDocId(tid, uid));
  const snap = await getDoc(pRef);
  if (!snap.exists()) return;
  const before = (snap.data() as TournamentPlayer).status;
  await updateDoc(pRef, patch);
  const wasCounted = before !== "rejected";
  const isCounted = patch.status !== "rejected";
  if (wasCounted !== isCounted) {
    await updateDoc(doc(db, "tournaments", tid), { participantCount: increment(isCounted ? 1 : -1) });
  }
}

export async function adminRemoveParticipant(db: Firestore, tid: string, uid: string) {
  await adminUpdateParticipant(db, tid, uid, { status: "rejected" });
}

/* ---------------- Starting: fixtures, divisions, brackets ---------------- */

async function loadPlayers(db: Firestore, tid: string): Promise<TournamentPlayer[]> {
  const snap = await getDocs(query(collection(db, "t_players"), where("tournamentId", "==", tid)));
  return snap.docs.map((d) => d.data() as TournamentPlayer).filter((p) => p.status === "approved" || p.status === "active");
}

export async function startTournament(db: Firestore, tid: string) {
  const tRef = doc(db, "tournaments", tid);
  const t = withId((await getDoc(tRef)).data(), tRef.id) as Tournament | undefined;
  if (!t) throw new Error("Tournament not found.");
  if (t.status === "running") throw new Error("This tournament is already running.");
  const players = (await loadPlayers(db, tid)).sort((a, b) => a.seed - b.seed);
  if (players.length < 2) throw new Error("Need at least 2 approved players to start.");
  const byId = new Map(players.map((p) => [p.uid, p]));
  const startedAt = Date.now();
  const ops: BatchOp[] = [];
  players.forEach((p) => ops.push({ ref: doc(db, "t_players", p.id), update: { status: "active" } }));

  if (t.format === "league") {
    const divCount = Math.max(1, Math.min(t.divisionCount, Math.floor(players.length / 2)));
    snakeGroups(players.map((p) => p.uid), divCount).forEach((ids, di) => {
      ids.forEach((uid) => ops.push({ ref: doc(db, "t_players", playerDocId(tid, uid)), update: { division: di, group: null } }));
      roundRobin(ids).forEach((pairs, r) => pairs.forEach(([aUid, bUid]) => {
        ops.push({
          ref: doc(collection(db, "t_fixtures")),
          set: newFixture(t, "league", r + 1, di,
            { uid: aUid, name: byId.get(aUid)!.name }, { uid: bUid, name: byId.get(bUid)!.name },
            gameweekDeadline(startedAt, r + 1, t.gameweekDays)),
        });
      }));
    });
  } else if (t.format === "groups") {
    const gCount = Math.max(2, Math.min(Math.ceil(players.length / t.groupSize), Math.floor(players.length / 2)));
    const ends = t.seasonEndsAt || startedAt + 30 * DAY_MS;
    snakeGroups(players.map((p) => p.uid), gCount).forEach((ids, gi) => {
      ids.forEach((uid) => ops.push({ ref: doc(db, "t_players", playerDocId(tid, uid)), update: { division: 0, group: gi } }));
      roundRobin(ids).forEach((pairs, r) => pairs.forEach(([aUid, bUid]) => {
        ops.push({
          ref: doc(collection(db, "t_fixtures")),
          set: newFixture(t, "group", r + 1, gi,
            { uid: aUid, name: byId.get(aUid)!.name }, { uid: bUid, name: byId.get(bUid)!.name }, ends),
        });
      }));
    });
  } else {
    const ends = t.seasonEndsAt || startedAt + 30 * DAY_MS;
    bracketPairs(players.map((p) => p.uid)).forEach(([aUid, bUid]) => {
      if (!bUid) return; // bye: the player simply advances
      ops.push({
        ref: doc(collection(db, "t_fixtures")),
        set: newFixture(t, "knockout", 1, null,
          { uid: aUid, name: byId.get(aUid)!.name }, { uid: bUid, name: byId.get(bUid)!.name }, ends),
      });
    });
  }

  ops.push({ ref: tRef, update: { status: "running", seasonStartedAt: startedAt, seasonComplete: false } });
  await commitOps(db, ops);
}

/** A participant opens their scheduled match: joins the waiting lobby or starts a fresh one. */
export async function enterFixture(
  db: Firestore, uid: string, name: string, fixture: Fixture, t: Tournament,
): Promise<string> {
  const qids = await pickQuestions(db, t.questionsPerMatch || CLASSIC_QUESTIONS, t.subject)
    .catch(() => null);
  return runTransaction(db, async (tx) => {
    const fRef = doc(db, "t_fixtures", fixture.id);
    const fs = await tx.get(fRef);
    if (!fs.exists()) throw new Error("Match not found.");
    const f = fs.data() as Fixture;
    if (f.status === "completed" || f.status === "void") throw new Error("This match is already finished.");
    if (uid !== f.aId && uid !== f.bId) throw new Error("This isn't your match.");
    if (f.deadline && Date.now() > f.deadline)
      throw new Error("The window for this match has passed. Ask an admin to reschedule it.");
    if (f.matchId) {
      const ms = await tx.get(doc(db, "matches", f.matchId));
      const m = ms.data() as Match | undefined;
      if (ms.exists() && m && (m.status === "waiting" || m.status === "countdown" || m.status === "active")) {
        if (m.status === "waiting" && !m.playerIds.includes(uid)) {
          if (m.playerIds.length >= m.maxPlayers) throw new Error("This room is full.");
          const full = m.playerIds.length + 1 >= 2;
          tx.update(doc(db, "matches", f.matchId), {
            playerIds: [...m.playerIds, uid],
            [`players.${uid}`]: newPlayer(name),
            // Tournament rooms have no host button: start once both players are in.
            ...(full ? { status: "countdown", countdownEndsAt: Date.now() + COUNTDOWN_MS } : {}),
          });
        }
        return f.matchId;
      }
    }
    if (!qids) throw new Error("Not enough active questions for this tournament's courses yet.");
    const ref = doc(collection(db, "matches"));
    const m = baseMatch("classic", uid, qids);
    m.fixtureId = fixture.id;
    m.tournamentId = fixture.tournamentId;
    m.ranked = false;
    m.playerIds = [uid];
    m.players = { [uid]: newPlayer(name) };
    tx.set(ref, m);
    tx.update(fRef, { matchId: ref.id, status: "ready" });
    return ref.id;
  });
}

/* ---------------- Scoring ---------------- */

/** Records a finished fixture exactly once; safe to call from both participants. */
export async function applyFixtureResult(db: Firestore, fixtureId: string): Promise<Fixture | null> {
  return runTransaction(db, async (tx) => {
    const fRef = doc(db, "t_fixtures", fixtureId);
    const fs = await tx.get(fRef);
    if (!fs.exists()) return null;
    const f = fs.data() as Fixture;
    if (f.applied) return null;
    if (!f.matchId) return null;
    const ms = await tx.get(doc(db, "matches", f.matchId));
    const m = ms.data() as Match | undefined;
    if (!ms.exists() || !m || m.status !== "completed") return null;
    const pa = m.players[f.aId];
    const pb = m.players[f.bId];
    if (!pa || !pb) return null;
    const ts = await tx.get(doc(db, "tournaments", f.tournamentId));
    const t = withId(ts.data(), ts.id) as Tournament;
    const outcome = fixtureWinner(f.aId, f.bId, pa.score, pb.score, pa.correct, pb.correct);
    // A knockout match needs a winner; equal scores fall back to a stable order.
    const winnerId = outcome.winnerId ?? (t.format === "league" || f.stage === "league" || f.stage === "group"
      ? null
      : (f.aId < f.bId ? f.aId : f.bId));
    const aResult = winnerId === f.aId ? "win" : winnerId ? "loss" : "draw";
    const bResult = winnerId === f.bId ? "win" : winnerId ? "loss" : "draw";
    tx.update(doc(db, "t_players", playerDocId(f.tournamentId, f.aId)), statsPatch(fixtureStats(pa.score, pb.score, aResult, t)));
    tx.update(doc(db, "t_players", playerDocId(f.tournamentId, f.bId)), statsPatch(fixtureStats(pb.score, pa.score, bResult, t)));
    if (f.stage === "knockout" && winnerId) {
      const loser = winnerId === f.aId ? f.bId : f.aId;
      tx.update(doc(db, "t_players", playerDocId(f.tournamentId, loser)), { status: "eliminated" });
    }
    const done: Partial<Fixture> = {
      status: "completed", scoreA: pa.score, scoreB: pb.score, winnerId,
      decidedBy: outcome.decidedBy, applied: true,
    };
    tx.update(fRef, done);
    return { ...f, ...done } as Fixture;
  });
}

/** Walkover / manual result entered by an admin. */
export async function adminSetFixtureResult(
  db: Firestore, fixtureId: string, scoreA: number, scoreB: number, winnerId: string | null,
) {
  await runTransaction(db, async (tx) => {
    const fRef = doc(db, "t_fixtures", fixtureId);
    const fs = await tx.get(fRef);
    if (!fs.exists()) throw new Error("Match not found.");
    const f = fs.data() as Fixture;
    if (f.applied) throw new Error("This match already has a recorded result.");
    const ts = await tx.get(doc(db, "tournaments", f.tournamentId));
    const t = withId(ts.data(), ts.id) as Tournament;
    const aResult = winnerId === f.aId ? "win" : winnerId ? "loss" : "draw";
    const bResult = winnerId === f.bId ? "win" : winnerId ? "loss" : "draw";
    tx.update(doc(db, "t_players", playerDocId(f.tournamentId, f.aId)), statsPatch(fixtureStats(scoreA, scoreB, aResult, t)));
    tx.update(doc(db, "t_players", playerDocId(f.tournamentId, f.bId)), statsPatch(fixtureStats(scoreB, scoreA, bResult, t)));
    if (f.stage === "knockout" && winnerId) {
      tx.update(doc(db, "t_players", playerDocId(f.tournamentId, winnerId === f.aId ? f.bId : f.aId)), { status: "eliminated" });
    }
    tx.update(fRef, { status: "completed", scoreA, scoreB, winnerId, decidedBy: "walkover", applied: true });
  });
}

export async function adminDeleteFixture(db: Firestore, fixtureId: string) {
  await deleteDoc(doc(db, "t_fixtures", fixtureId));
}

export async function adminRescheduleFixture(db: Firestore, fixtureId: string, deadline: number) {
  await updateDoc(doc(db, "t_fixtures", fixtureId), { deadline, status: "scheduled", matchId: null });
}

/* ---------------- Progression ---------------- */

/**
 * Called after a fixture result lands. Advances knockout rounds, promotes group
 * winners into the knockout and flags a finished league season. Idempotent.
 */
export async function maybeAdvance(db: Firestore, tid: string) {
  await advanceWrites(db, tid);
}

async function advanceWrites(db: Firestore, tid: string) {
  // Re-derive the same ops outside the transaction; every step is idempotent
  // because generation checks existing fixtures/players first.
  const t = withId((await getDoc(doc(db, "tournaments", tid))).data(), tid) as Tournament | undefined;
  if (!t || t.status !== "running") return;
  const fSnap = await getDocs(query(collection(db, "t_fixtures"), where("tournamentId", "==", tid)));
  const fixtures = fSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Fixture, "id">) }));
  const pending = fixtures.filter((f) => f.status === "scheduled" || f.status === "ready");
  const players = await loadPlayers(db, tid);
  const active = players.filter((p) => p.status === "active");
  const byId = new Map(players.map((p) => [p.uid, p]));
  const now = Date.now();
  const ops: BatchOp[] = [];

  if (t.format === "groups" && !fixtures.some((f) => f.stage === "knockout")) {
    if (pending.length > 0 || active.length < 2) return;
    const gCount = Math.max(...players.map((p) => p.group ?? 0)) + 1;
    const alive: TournamentPlayer[] = [];
    for (let rank = 0; rank < t.qualifiers; rank++) {
      for (let g = 0; g < gCount; g++) {
        const table = standings(players.filter((p) => p.group === g), t.tiebreakers);
        const q = table[rank];
        if (q) alive.push(q);
      }
    }
    if (alive.length < 2) return;
    players.filter((p) => p.status === "active" && !alive.some((a) => a.uid === p.uid))
      .forEach((p) => ops.push({ ref: doc(db, "t_players", p.id), update: { status: "eliminated" } }));
    bracketPairs(alive.map((p) => p.uid)).forEach(([aUid, bUid]) => {
      if (!bUid) return;
      ops.push({
        ref: doc(collection(db, "t_fixtures")),
        set: newFixture(t, "knockout", 1, null,
          { uid: aUid, name: byId.get(aUid)?.name ?? "?" }, { uid: bUid, name: byId.get(bUid)?.name ?? "?" },
          now + Math.max(1, t.gameweekDays) * DAY_MS),
      });
    });
  } else if (t.format === "groups" || t.format === "elimination") {
    if (pending.length > 0) return;
    if (active.length === 1) {
      ops.push({ ref: doc(db, "t_players", active[0].id), update: { status: "champion" } });
      ops.push({ ref: doc(db, "tournaments", tid), update: { status: "completed" } });
    } else if (active.length >= 2) {
      const nextRound = Math.max(...fixtures.map((f) => f.round)) + 1;
      if (fixtures.some((f) => f.round === nextRound)) return;
      bracketPairs(active.sort((a, b) => a.seed - b.seed).map((p) => p.uid)).forEach(([aUid, bUid]) => {
        if (!bUid) return;
        ops.push({
          ref: doc(collection(db, "t_fixtures")),
          set: newFixture(t, "knockout", nextRound, null,
            { uid: aUid, name: byId.get(aUid)?.name ?? "?" }, { uid: bUid, name: byId.get(bUid)?.name ?? "?" },
            now + Math.max(1, t.gameweekDays) * DAY_MS),
        });
      });
    }
  } else if (t.format === "league" && pending.length === 0 && active.length > 0) {
    ops.push({ ref: doc(db, "tournaments", tid), update: { seasonComplete: true } });
  }
  if (ops.length) await commitOps(db, ops);
}

/* ---------------- League seasons ---------------- */

/** Ends the current season: promotes/relegates, resets stats and draws the new fixture list. */
export async function endSeason(db: Firestore, tid: string) {
  const tRef = doc(db, "tournaments", tid);
  const t = withId((await getDoc(tRef)).data(), tRef.id) as Tournament | undefined;
  if (!t || t.format !== "league") throw new Error("Seasons only apply to League tournaments.");
  const snap = await getDocs(query(collection(db, "t_players"), where("tournamentId", "==", tid)));
  const players = snap.docs.map((d) => d.data() as TournamentPlayer).filter((p) => p.status === "active");
  if (players.length < 2) throw new Error("Not enough players to run another season.");
  const divCount = Math.max(...players.map((p) => p.division)) + 1;
  const tables = Array.from({ length: divCount }, (_, di) =>
    standings(players.filter((p) => p.division === di), t.tiebreakers));
  const moves = applySeasonMoves(tables, t.promoteSlots, t.relegateSlots);
  const byId = new Map(players.map((p) => [p.uid, p]));
  const startedAt = Date.now();
  const ops: BatchOp[] = [];
  players.forEach((p) => ops.push({
    ref: doc(db, "t_players", p.id),
    update: { division: moves[p.uid] ?? p.division, group: null, ...RESET_STATS },
  }));
  const fSnap = await getDocs(query(collection(db, "t_fixtures"), where("tournamentId", "==", tid)));
  fSnap.docs.forEach((d) => ops.push({ ref: d.ref, del: true }));
  const divs = Array.from({ length: divCount }, (_, di) =>
    players.filter((p) => (moves[p.uid] ?? p.division) === di).sort((a, b) => a.seed - b.seed).map((p) => p.uid));
  divs.forEach((ids, di) => {
    roundRobin(ids).forEach((pairs, r) => pairs.forEach(([aUid, bUid]) => {
      ops.push({
        ref: doc(collection(db, "t_fixtures")),
        set: newFixture(t, "league", r + 1, di,
          { uid: aUid, name: byId.get(aUid)?.name ?? "?" }, { uid: bUid, name: byId.get(bUid)?.name ?? "?" },
          gameweekDeadline(startedAt, r + 1, t.gameweekDays)),
      });
    }));
  });
  ops.push({ ref: tRef, update: { season: t.season + 1, seasonStartedAt: startedAt, seasonComplete: false, status: "running" } });
  await commitOps(db, ops);
}
