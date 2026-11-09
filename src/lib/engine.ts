import { getSubjectQuestions } from "./question-cache";
import { formatCoursePick, parseCoursePick, sameCoursePick } from "./course-pick";
import { applyRankedResult, countsForRank, seasonRollover, pickOpponent, type RankedOutcome, type RankedState } from "./ranked";
import { getRankedConfig } from "./ranked-store";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  CLASSIC_QUESTIONS,
  RUSH_LOBBY_MS,
  RUSH_MAX_PLAYERS,
  rushQuestionCount,
  COUNTDOWN_MS,
  questionMs,
  coinsFor,
  computeWinners,
  isEliminated,
  levelFromXp,
  newPlayer,
  nextState,
  pointsFor,
  ratingDelta,
  resultFor,
  standings,
  xpFor,
  type Match,
  type Mode,
  type Team,
  openTeam,
  teamOf,
  DUO_TEAM_SIZE,
} from "./game-rules";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  subject: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  active: boolean;
}

export interface CreateRoomOptions {
  secondsPerQuestion?: number;
  questionCount?: number;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function roomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function pickQuestions(db: Firestore, n: number, subject?: string | string[]): Promise<string[]> {
  const rows = await getSubjectQuestions(db, subject);
  rows.forEach((q) => qCache.set(q.id, q));
  const ids = shuffle(rows.map((q) => q.id)).slice(0, n);
  if (ids.length < 3) throw new Error("Not enough questions yet. An admin needs to add questions first.");
  return ids;
}

const qCache = new Map<string, Question>();
/** Deterministic per-match option shuffle so every player (and the review page) sees the same order. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffleOptions(q: Question, seed: string): Question {
  const rand = seededRandom(`${seed}:${q.id}`);
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

export async function loadQuestions(db: Firestore, ids: string[], seed?: string): Promise<Record<string, Question>> {
  const out: Record<string, Question> = {};
  await Promise.all(
    ids.map(async (id) => {
      if (!qCache.has(id)) {
        const s = await getDoc(doc(db, "questions", id));
        if (s.exists()) qCache.set(id, { id, ...(s.data() as Omit<Question, "id">) });
      }
      const q = qCache.get(id);
      if (q) out[id] = seed ? shuffleOptions(q, seed) : q;
    }),
  );
  return out;
}

export function baseMatch(mode: Mode, hostId: string, questionIds: string[]): Omit<Match, "id"> {
  return {
    mode,
    status: "waiting",
    phase: "question",
    hostId,
    code: null,
    lobbyKey: null,
    ranked: false,
    maxPlayers: mode === "rush" ? RUSH_MAX_PLAYERS : mode === "duo" ? DUO_TEAM_SIZE * 2 : 2,
    playerIds: [],
    players: {},
    questionIds,
    currentIndex: 0,
    deadline: 0,
    revealEndsAt: 0,
    countdownEndsAt: 0,
    lobbyEndsAt: 0,
    createdAt: Date.now(),
    winnerIds: [],
  };
}

/* ---------------- Classic ranked matchmaking ---------------- */

export async function findClassicMatch(
  db: Firestore,
  uid: string,
  name: string,
  subject: string | string[],
  onMatched: (matchId: string) => void,
  rp = 0,
): Promise<() => Promise<void>> {
  const myRef = doc(db, "queue", uid);
  const cfg = await getRankedConfig(db);
  const joinedAt = Date.now();
  const pick = parseCoursePick(subject);
  const wire = formatCoursePick(pick);
  let done = false;
  let busy = false;

  /** Scans the queue and pairs with the best opponent inside the current RP window. */
  const scan = async (): Promise<boolean> => {
    if (done || busy) return false;
    busy = true;
    try {
      const snap = await getDocs(query(collection(db, "queue"), where("status", "==", "waiting"), limit(50)));
      const now = Date.now();
      let pool = snap.docs
        .filter((d) => d.id !== uid && sameCoursePick(parseCoursePick(d.data().subject), pick) && now - d.data().createdAt < 120_000)
        .map((d) => ({ id: d.id, rp: Number(d.data().rp ?? 0), createdAt: Number(d.data().createdAt) }));
      while (!done) {
        const c = pickOpponent({ rp, createdAt: joinedAt }, pool, now, cfg);
        if (!c) return false;
        pool = pool.filter((p) => p.id !== c.id);
        const qids = await pickQuestions(db, CLASSIC_QUESTIONS, pick);
        const matchRef = doc(collection(db, "matches"));
        const cRef = doc(db, "queue", c.id);
        const ok = await runTransaction(db, async (tx) => {
          const cs = await tx.get(cRef);
          const mine = await tx.get(myRef);
          if (mine.exists() && mine.data().status !== "waiting") return false;
          if (!cs.exists() || cs.data().status !== "waiting") return false;
          const m = baseMatch("classic", cs.id, qids);
          m.ranked = true;
          m.playerIds = [cs.id, uid];
          m.players = { [cs.id]: newPlayer(cs.data().name), [uid]: newPlayer(name) };
          m.status = "countdown";
          m.countdownEndsAt = Date.now() + COUNTDOWN_MS;
          tx.set(matchRef, m);
          tx.update(cRef, { status: "matched", matchId: matchRef.id });
          tx.set(myRef, { status: "matched", matchId: matchRef.id, name, subject: wire, rp, createdAt: joinedAt });
          return true;
        }).catch(() => false);
        if (ok) {
          finish(matchRef.id);
          return true;
        }
      }
      return false;
    } finally {
      busy = false;
    }
  };

  let unsub: () => void = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  const finish = (matchId: string) => {
    if (done) return;
    done = true;
    unsub();
    if (timer) clearInterval(timer);
    onMatched(matchId);
  };

  if (await scan()) return async () => {};

  await setDoc(myRef, { status: "waiting", matchId: null, name, subject: wire, rp, createdAt: joinedAt });
  unsub = onSnapshot(myRef, (s) => {
    const d = s.data();
    if (d?.status === "matched" && d.matchId) finish(d.matchId);
  });
  // The RP window widens while waiting, so keep re-scanning.
  timer = setInterval(() => void scan().catch(() => {}), 3000);
  return async () => {
    done = true;
    unsub();
    if (timer) clearInterval(timer);
    await deleteDoc(myRef).catch(() => {});
  };
}

/* ---------------- Private rooms ---------------- */

export async function createRoom(
  db: Firestore,
  uid: string,
  name: string,
  mode: Mode,
  subject: string | string[],
  options?: CreateRoomOptions,
) {
  const count = options?.questionCount && options.questionCount > 0
    ? Math.min(50, Math.max(3, options.questionCount))
    : (mode === "rush" ? rushQuestionCount() : CLASSIC_QUESTIONS);

  const qids = await pickQuestions(db, count, subject);
  const ref = doc(collection(db, "matches"));
  const code = roomCode();
  const m = baseMatch(mode, uid, qids);
  m.code = code;
  m.lobbyKey = `code_${code}`;
  // 1v1, 2v2 and Rush rooms are ranked: they count for placement and RP.
  m.ranked = true;
  m.playerIds = [uid];
  m.players = { [uid]: { ...newPlayer(name), ...(mode === "duo" ? { team: "A" as Team } : {}) } };
  if (options?.secondsPerQuestion && options.secondsPerQuestion > 0) {
    m.secondsPerQuestion = Math.min(120, Math.max(5, options.secondsPerQuestion));
  }
  if (options?.questionCount && options.questionCount > 0) {
    m.questionCount = count;
  }
  await setDoc(ref, m);
  return { id: ref.id, code };
}

export async function joinRoomByCode(db: Firestore, uid: string, name: string, code: string) {
  const clean = code.trim().toUpperCase();
  const snap = await getDocs(query(collection(db, "matches"), where("lobbyKey", "==", `code_${clean}`), limit(1)));
  if (snap.empty) throw new Error("No open room with that code.");
  return joinMatch(db, snap.docs[0].id, uid, name);
}

export async function joinMatch(db: Firestore, matchId: string, uid: string, name: string) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Room not found.");
    const m = s.data() as Match;
    if (m.playerIds.includes(uid)) return;
    if (m.status !== "waiting") throw new Error("This battle has already started.");
    if (m.playerIds.length >= m.maxPlayers) throw new Error("This room is full.");
    const p = newPlayer(name);
    if (m.mode === "duo") {
      const t = openTeam(m);
      if (!t) throw new Error("Both teams are full.");
      p.team = t;
    }
    tx.update(ref, { playerIds: [...m.playerIds, uid], [`players.${uid}`]: p });
  });
  return matchId;
}

export async function leaveLobby(db: Firestore, matchId: string, uid: string) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const m = s.data() as Match;
    if (m.status !== "waiting" || !m.playerIds.includes(uid)) return;
    const rest = m.playerIds.filter((id) => id !== uid);
    const players = { ...m.players };
    delete players[uid];
    if (rest.length === 0) tx.update(ref, { status: "cancelled", lobbyKey: null, playerIds: [], players: {} });
    else tx.update(ref, { playerIds: rest, players, hostId: m.hostId === uid ? rest[0] : m.hostId });
  });
}

export async function hostStart(db: Firestore, matchId: string, uid: string) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const m = s.data() as Match;
    if (m.hostId !== uid || m.status !== "waiting") return;
    if (m.playerIds.length < 2) throw new Error("You need at least 2 players to start.");
    if (m.mode === "duo" && (teamOf(m, "A").length !== DUO_TEAM_SIZE || teamOf(m, "B").length !== DUO_TEAM_SIZE))
      throw new Error("Both teams need 2 players to start.");
    tx.update(ref, { status: "countdown", countdownEndsAt: Date.now() + COUNTDOWN_MS, lobbyKey: null });
  });
}

/** 2v2 lobby: move yourself to the other team if it has a free seat. */
export async function switchTeam(db: Firestore, matchId: string, uid: string, team: Team) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const m = s.data() as Match;
    if (m.status !== "waiting" || !m.players[uid] || m.players[uid].team === team) return;
    if (teamOf(m, team).length >= DUO_TEAM_SIZE) throw new Error("That team is full.");
    tx.update(ref, { [`players.${uid}.team`]: team });
  });
}

/* ---------------- 50 Players Rush ---------------- */

export async function joinRush(db: Firestore, uid: string, name: string) {
  const snap = await getDocs(query(collection(db, "matches"), where("lobbyKey", "==", "rush_public"), limit(5)));
  for (const d of snap.docs) {
    try {
      return await joinMatch(db, d.id, uid, name);
    } catch {
      /* try next lobby */
    }
  }
  const qids = await pickQuestions(db, rushQuestionCount());
  const ref = doc(collection(db, "matches"));
  const m = baseMatch("rush", uid, qids);
  m.lobbyKey = "rush_public";
  m.ranked = true;
  m.lobbyEndsAt = Date.now() + RUSH_LOBBY_MS;
  m.playerIds = [uid];
  m.players = { [uid]: newPlayer(name) };
  await setDoc(ref, m);
  return ref.id;
}

/* ---------------- Gameplay ---------------- */

export async function submitAnswer(db: Firestore, matchId: string, uid: string, q: Question, choice: number) {
  const ref = doc(db, "matches", matchId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const m = s.data() as Match;
    const now = Date.now();
    const idx = String(m.currentIndex);
    const p = m.players[uid];
    if (m.status !== "active" || m.phase !== "question") throw new Error("Answers are closed.");
    if (m.questionIds[m.currentIndex] !== q.id) throw new Error("That question has passed.");
    if (now > m.deadline) throw new Error("Time is up.");
    if (!p || p.eliminated) throw new Error("You can't answer right now.");
    if (p.answers?.[idx]) return; // duplicate submission ignored
    const correct = choice === q.correctIndex;
    const points = pointsFor(correct, m.deadline - now, questionMs(m.mode, m.secondsPerQuestion));
    const wrong = p.wrong + (correct ? 0 : 1);
    const upd: Record<string, unknown> = {
      [`players.${uid}.answers.${idx}`]: { choice, correct, points },
      [`players.${uid}.score`]: p.score + points,
      [`players.${uid}.correct`]: p.correct + (correct ? 1 : 0),
      [`players.${uid}.wrong`]: wrong,
    };
    if (m.mode === "rush" && isEliminated(wrong)) {
      upd[`players.${uid}.eliminated`] = true;
      upd[`players.${uid}.eliminatedAt`] = m.currentIndex;
    }
    tx.update(ref, upd);
  });
}

export async function tick(db: Firestore, matchId: string, local: Match) {
  if (!nextState(local, Date.now())) return;
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const m = { id: s.id, ...(s.data() as Omit<Match, "id">) };
    const upd = nextState(m, Date.now());
    if (upd) tx.update(ref, upd);
  }).catch(() => {
    /* another player advanced it first */
  });
}

export async function forfeit(db: Firestore, matchId: string, uid: string) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const m = s.data() as Match;
    if (m.status !== "active" && m.status !== "countdown") return;
    if (m.mode === "duo") {
      const mine = m.players[uid]?.team;
      tx.update(ref, { status: "completed", winnerIds: m.playerIds.filter((id) => m.players[id].team !== mine) });
    } else if (m.mode === "classic") {
      const other = m.playerIds.filter((id) => id !== uid);
      tx.update(ref, { status: "completed", winnerIds: other });
    } else {
      tx.update(ref, {
        [`players.${uid}.eliminated`]: true,
        [`players.${uid}.eliminatedAt`]: m.currentIndex - 1,
      });
    }
  });
}

const PENDING_KEY = "favoje.pendingSettle";
/** Remembers a match the player left early so its result is settled once it finishes. */
export function rememberPendingSettle(matchId: string) {
  try {
    const ids = new Set<string>(JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"));
    ids.add(matchId);
    localStorage.setItem(PENDING_KEY, JSON.stringify([...ids].slice(-20)));
  } catch { /* storage unavailable */ }
}
/** Settles any left-early matches that have since finished. Safe to call repeatedly. */
export async function settlePending(db: Firestore, uid: string) {
  let ids: string[] = [];
  try { ids = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return; }
  const keep: string[] = [];
  for (const id of ids) {
    try {
      const s = await getDoc(doc(db, "matches", id));
      const st = s.data()?.status;
      if (!s.exists() || st === "cancelled") continue;
      if (st !== "completed") { keep.push(id); continue; }
      await applyResults(db, id, uid);
    } catch { keep.push(id); }
  }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(keep)); } catch { /* ignore */ }
}

/** Applies the finished match to the player's own stats exactly once. */
export interface MatchRewards { result: ReturnType<typeof resultFor>; delta: number; xpGained: number; coins: number; ranked: RankedOutcome | null }

/** Applies the finished match to the player's own stats exactly once, including ranked RP, placement and tier. */
export async function applyResults(db: Firestore, matchId: string, uid: string): Promise<MatchRewards | null> {
  const cfg = await getRankedConfig(db);
  const mRef = doc(db, "matches", matchId);
  const uRef = doc(db, "users", uid);
  return runTransaction(db, async (tx) => {
    const ms = await tx.get(mRef);
    const us = await tx.get(uRef);
    const m = { id: ms.id, ...(ms.data() as Omit<Match, "id">) };
    const p = m.players[uid];
    if (m.status !== "completed" || !p || p.applied || !us.exists()) return null;
    const u = us.data();
    const result = resultFor(m, uid);
    const xp = (u.xp ?? 0) + xpFor(result, p.score);
    const delta = m.ranked ? ratingDelta(result) : 0;

    const rushMeta = m.mode === "rush" ? {
      place: Math.max(1, standings(m).indexOf(uid) + 1),
      totalPlayers: m.playerIds.length,
      correct: p.correct ?? 0,
      totalQuestions: m.questionIds.length,
    } : undefined;

    const ranked = countsForRank(!!m.ranked, u as RankedState, cfg) && cfg.enabled && !u.rankedSuspended
      ? applyRankedResult(u as RankedState, result, cfg, Date.now(), undefined, rushMeta)
      : null;

    tx.update(uRef, {
      battles: (u.battles ?? 0) + 1,
      wins: (u.wins ?? 0) + (result === "win" ? 1 : 0),
      losses: (u.losses ?? 0) + (result === "loss" ? 1 : 0),
      draws: (u.draws ?? 0) + (result === "draw" ? 1 : 0),
      streak: result === "win" ? (u.streak ?? 0) + 1 : 0,
      bestStreak: Math.max(u.bestStreak ?? 0, result === "win" ? (u.streak ?? 0) + 1 : 0),
      xp,
      level: levelFromXp(xp),
      rating: Math.max(0, (u.rating ?? 1000) + delta),
      coins: (u.coins ?? 0) + coinsFor(result),
      ...(ranked ? ranked.patch : {}),
    });
    if (ranked) {
      const { archive } = seasonRollover(u as RankedState, cfg, Date.now());
      if (archive) tx.set(doc(db, "users", uid, "seasons", archive.seasonId), archive);
    }
    tx.update(mRef, { [`players.${uid}.applied`]: true });
    tx.set(doc(db, "users", uid, "history", matchId), {
      mode: m.mode,
      result,
      score: p.score,
      correct: p.correct,
      opponents: m.playerIds.filter((id) => id !== uid && (m.mode !== "duo" || m.players[id].team !== p.team)).slice(0, 3).map((id) => m.players[id].name),
      players: m.playerIds.length,
      ratingDelta: delta,
      ...(ranked ? { rpDelta: ranked.delta, rankAfter: ranked.rankAfter } : {}),
      at: Date.now(),
    });
    return { result, delta, xpGained: xpFor(result, p.score), coins: coinsFor(result), ranked };
  });
}

/* ---------------- Admin match controls ---------------- */

/** Admin: close a battle outright; every player is sent back to the arena. */
export async function adminCancelMatch(db: Firestore, matchId: string) {
  await updateDoc(doc(db, "matches", matchId), { status: "cancelled", lobbyKey: null });
}

/** Admin: finish a running battle immediately with the current scores deciding the winner. */
export async function adminEndMatch(db: Firestore, matchId: string) {
  const ref = doc(db, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const m = { id: s.id, ...(s.data() as Omit<Match, "id">) };
    if (m.status !== "active" && m.status !== "countdown") return;
    tx.update(ref, { status: "completed", winnerIds: computeWinners(m) });
  });
}
