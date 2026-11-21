import { collection, doc, runTransaction, updateDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { createRoom, hostStart, joinMatch } from "./engine";
import type { Match } from "./game-rules";
import { calculateClanLevel, type ClanBattleChallenge } from "./clans";

export type ClanWarFormat = "1v1" | "2v2" | "3v3" | "5v5";

export const CLAN_WAR_SUBJECTS = ["general", "mathematics", "english"] as const;

export interface ClanWarSettleResult {
  challengeId: string;
  winnerClanId: string | null;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanTag: string;
  targetClanId: string;
  targetClanName: string;
  targetClanTag: string;
  scoreA: number;
  scoreB: number;
  cpDeltaA: number;
  cpDeltaB: number;
  xpDeltaA: number;
  xpDeltaB: number;
  newCpA: number;
  newCpB: number;
  newLvlA: number;
  newLvlB: number;
  p1Uid?: string;
  p2Uid?: string;
  challengerUids?: string[];
  targetUids?: string[];
}

export function warSize(format: string): number {
  if (format === "1v1") return 1;
  if (format === "2v2") return 2;
  if (format === "3v3") return 3;
  if (format === "5v5") return 5;
  throw new Error("Choose 1v1, 2v2, 3v3 or 5v5.");
}

export function warPairs(format: string, a: string[], b: string[]): [string, string][] {
  const size = warSize(format);
  if (a.length !== size || b.length !== size) throw new Error(`Both clans need exactly ${size} players.`);
  if (new Set([...a, ...b]).size !== size * 2) throw new Error("Each player must occupy just one roster slot.");
  return a.map((uid, i) => [uid, b[i]]);
}

export function warSettings(format: string, subjects: string[], count?: number, seconds?: number) {
  warSize(format);
  const pool = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))];
  if (!pool.length) throw new Error("Select at least one course.");
  const defaultCount = format === "1v1" ? 10 : format === "2v2" ? 15 : format === "3v3" ? 25 : 30;
  return {
    subjects: pool,
    questionCount: Math.max(10, Math.min(30, Math.floor(Number(count) || defaultCount))),
    secondsPerQuestion: Math.max(5, Math.min(60, Math.floor(Number(seconds) || 15))),
  };
}

export function aggregateWar(challenge: ClanBattleChallenge, matches: Match[]) {
  const a = challenge.challengerRoster;
  const b = challenge.targetRoster ?? [];
  const pairs = warPairs(challenge.format, a, b);
  if (matches.length !== pairs.length || matches.some((m) => m.status !== "completed")) return null;
  let scoreA = 0;
  let scoreB = 0;
  for (let i = 0; i < pairs.length; i++) {
    const [uidA, uidB] = pairs[i];
    const m = matches[i];
    if (!m.players[uidA] || !m.players[uidB] || m.clanWarId !== challenge.id) {
      throw new Error("War match participants do not match the roster.");
    }
    scoreA += m.forfeitedUid === uidA ? 0 : m.players[uidA].score;
    scoreB += m.forfeitedUid === uidB ? 0 : m.players[uidB].score;
    if (m.forfeitedUid === uidA) scoreB += 1;
    if (m.forfeitedUid === uidB) scoreA += 1;
  }
  return {
    scores: { [challenge.challengerClanId]: scoreA, [challenge.targetClanId]: scoreB },
    winnerClanId: scoreA === scoreB ? null : scoreA > scoreB ? challenge.challengerClanId : challenge.targetClanId,
  };
}

export function getClanWarQuestionCount(format: ClanWarFormat): number {
  if (format === "1v1") return 10;
  if (format === "2v2") return 15;
  if (format === "3v3") return 25;
  return 30;
}

export function buildClanWarQuestionSubjects(
  format: ClanWarFormat,
  explicit?: string[],
): string[] {
  const pool = explicit && explicit.length ? explicit : [...CLAN_WAR_SUBJECTS];
  if (pool.length === 0) return [...CLAN_WAR_SUBJECTS];
  return pool;
}

export async function startClanWarMatch({
  db,
  challengeId,
  clanAId,
  clanBId,
  challengerRoster,
  targetRoster,
  memberLookup,
  hostUid: _hostUid,
  format,
  explicitSubjects,
  secondsPerQuestion = 15,
  questionCount: customCount,
}: {
  db: Firestore;
  challengeId: string;
  clanAId: string;
  clanBId: string;
  challengerRoster: string[];
  targetRoster: string[];
  memberLookup: Map<string, { username: string }>;
  hostUid: string;
  format: ClanWarFormat;
  explicitSubjects?: string[];
  secondsPerQuestion?: number;
  questionCount?: number;
}) {
  const questionCount = customCount && customCount > 0 ? customCount : getClanWarQuestionCount(format);
  const subjects = buildClanWarQuestionSubjects(format, explicitSubjects);

  const playerOneUid = challengerRoster[0];
  const playerTwoUid = targetRoster[0];

  if (!playerOneUid || !playerTwoUid) {
    throw new Error("Each clan needs at least one player selected before starting.");
  }

  const playerOneName = memberLookup.get(playerOneUid)?.username ?? "Clan challenger";
  const playerTwoName = memberLookup.get(playerTwoUid)?.username ?? "Clan opponent";

  const room = await createRoom(db, playerOneUid, playerOneName, "classic", subjects, {
    secondsPerQuestion: Math.max(5, Math.min(60, secondsPerQuestion)),
    questionCount,
  });

  await joinMatch(db, room.id, playerTwoUid, playerTwoName);

  await updateDoc(doc(db, "matches", room.id), {
    ranked: false,
    clanWarId: challengeId,
    clanAId,
    clanBId,
    questionCount,
    subjects,
  });

  await hostStart(db, room.id, playerOneUid);

  await updateDoc(doc(db, "clanBattles", challengeId), {
    status: "in_progress",
    matchId: room.id,
    playerOneUid,
    playerTwoUid,
    challengerRoster,
    targetRoster,
    startedAt: Date.now(),
    questionCount,
    subjects,
    format,
  });

  return room.id;
}

export async function settleClanWarMatch(
  db: Firestore,
  challengeId: string,
  match: Match
): Promise<ClanWarSettleResult | null> {
  const challengeRef = doc(db, "clanBattles", challengeId);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists()) return null;
    const war = snap.data();

    const matchId = war.matchId || match.id;
    let freshMatch = match;
    if (matchId) {
      const matchSnap = await tx.get(doc(db, "matches", matchId));
      if (matchSnap.exists()) {
        freshMatch = { id: matchSnap.id, ...(matchSnap.data() as Omit<Match, "id">) };
      }
    }

    const challengerUids: string[] =
      (war.challengerRoster && war.challengerRoster.length > 0)
        ? war.challengerRoster
        : [war.playerOneUid || freshMatch.playerIds[0]].filter(Boolean);

    const targetUids: string[] =
      (war.targetRoster && war.targetRoster.length > 0)
        ? war.targetRoster
        : [war.playerTwoUid || freshMatch.playerIds[1]].filter(Boolean);

    const p1Uid = challengerUids[0] || war.playerOneUid || freshMatch.playerIds[0];
    const p2Uid = targetUids[0] || war.playerTwoUid || freshMatch.playerIds[1];

    let score1 = 0;
    for (const uid of challengerUids) {
      score1 += freshMatch.players?.[uid]?.score ?? 0;
    }

    let score2 = 0;
    for (const uid of targetUids) {
      score2 += freshMatch.players?.[uid]?.score ?? 0;
    }

    const clanARef = doc(db, "clans", war.challengerClanId);
    const clanBRef = doc(db, "clans", war.targetClanId);
    const [clanASnap, clanBSnap] = await Promise.all([tx.get(clanARef), tx.get(clanBRef)]);

    const cA = clanASnap.exists() ? clanASnap.data() : {};
    const cB = clanBSnap.exists() ? clanBSnap.data() : {};

    if (war.status === "completed") {
      const winnerClanId: string | null = war.winnerClanId ?? null;
      const isWinA = winnerClanId === war.challengerClanId;
      const isWinB = winnerClanId === war.targetClanId;
      const isDraw = winnerClanId === null;

      const cpDeltaA = typeof war.cpDeltaA === "number" ? war.cpDeltaA : isWinA ? 25 : isDraw ? 10 : 0;
      const xpDeltaA = typeof war.xpDeltaA === "number" ? war.xpDeltaA : isWinA ? 100 : isDraw ? 50 : 25;
      const cpDeltaB = typeof war.cpDeltaB === "number" ? war.cpDeltaB : isWinB ? 25 : isDraw ? 10 : 0;
      const xpDeltaB = typeof war.xpDeltaB === "number" ? war.xpDeltaB : isWinB ? 100 : isDraw ? 50 : 25;

      const finalScoreA = war.scores?.[war.challengerClanId] ?? score1;
      const finalScoreB = war.scores?.[war.targetClanId] ?? score2;

      return {
        challengeId,
        winnerClanId,
        challengerClanId: war.challengerClanId,
        challengerClanName: war.challengerClanName ?? "Challenger Clan",
        challengerClanTag: war.challengerClanTag ?? "CLAN",
        targetClanId: war.targetClanId,
        targetClanName: war.targetClanName ?? "Opponent Clan",
        targetClanTag: war.targetClanTag ?? "RIVAL",
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        cpDeltaA,
        cpDeltaB,
        xpDeltaA,
        xpDeltaB,
        newCpA: cA.competitivePoints ?? 0,
        newCpB: cB.competitivePoints ?? 0,
        newLvlA: cA.level ?? 1,
        newLvlB: cB.level ?? 1,
        p1Uid,
        p2Uid,
        challengerUids,
        targetUids,
      };
    }

    let winnerClanId: string | null = null;
    if (score1 > score2) {
      winnerClanId = war.challengerClanId;
    } else if (score2 > score1) {
      winnerClanId = war.targetClanId;
    }

    const isWinA = winnerClanId === war.challengerClanId;
    const isWinB = winnerClanId === war.targetClanId;
    const isDraw = winnerClanId === null;

    const cpDeltaA = isWinA ? 25 : isDraw ? 10 : 0;
    const xpDeltaA = isWinA ? 100 : isDraw ? 50 : 25;

    const cpDeltaB = isWinB ? 25 : isDraw ? 10 : 0;
    const xpDeltaB = isWinB ? 100 : isDraw ? 50 : 25;

    const newCpA = Math.max(0, (cA.competitivePoints ?? 0) + cpDeltaA);
    const nextXpA = (cA.xp ?? 0) + xpDeltaA;
    const { level: nextLvlA } = calculateClanLevel(nextXpA);

    const newCpB = Math.max(0, (cB.competitivePoints ?? 0) + cpDeltaB);
    const nextXpB = (cB.xp ?? 0) + xpDeltaB;
    const { level: nextLvlB } = calculateClanLevel(nextXpB);

    const now = Date.now();
    const scores: Record<string, number> = {
      [war.challengerClanId]: score1,
      [war.targetClanId]: score2,
    };

    tx.update(challengeRef, {
      status: "completed",
      winnerClanId,
      scores,
      cpDeltaA,
      cpDeltaB,
      xpDeltaA,
      xpDeltaB,
      resolvedAt: now,
    });

    if (clanASnap.exists()) {
      tx.update(clanARef, {
        competitivePoints: newCpA,
        totalBattlesWon: (cA.totalBattlesWon ?? 0) + (isWinA ? 1 : 0),
        totalBattlesLost: (cA.totalBattlesLost ?? 0) + (!isWinA && !isDraw ? 1 : 0),
        totalBattlesDrawn: (cA.totalBattlesDrawn ?? 0) + (isDraw ? 1 : 0),
        xp: nextXpA,
        level: Math.max(cA.level ?? 1, nextLvlA),
      });
    }

    if (clanBSnap.exists()) {
      tx.update(clanBRef, {
        competitivePoints: newCpB,
        totalBattlesWon: (cB.totalBattlesWon ?? 0) + (isWinB ? 1 : 0),
        totalBattlesLost: (cB.totalBattlesLost ?? 0) + (!isWinB && !isDraw ? 1 : 0),
        totalBattlesDrawn: (cB.totalBattlesDrawn ?? 0) + (isDraw ? 1 : 0),
        xp: nextXpB,
        level: Math.max(cB.level ?? 1, nextLvlB),
      });
    }

    if (p1Uid && war.challengerClanId) {
      const memARef = doc(db, "clanMembers", `${war.challengerClanId}_${p1Uid}`);
      tx.update(memARef, {
        battlesPlayed: (war.challengerMember?.battlesPlayed ?? 0) + 1,
        battlesWon: (war.challengerMember?.battlesWon ?? 0) + (isWinA ? 1 : 0),
        contributionScore: (war.challengerMember?.contributionScore ?? 0) + cpDeltaA,
      }).catch?.(() => {});
    }

    if (p2Uid && war.targetClanId) {
      const memBRef = doc(db, "clanMembers", `${war.targetClanId}_${p2Uid}`);
      tx.update(memBRef, {
        battlesPlayed: (war.targetMember?.battlesPlayed ?? 0) + 1,
        battlesWon: (war.targetMember?.battlesWon ?? 0) + (isWinB ? 1 : 0),
        contributionScore: (war.targetMember?.contributionScore ?? 0) + cpDeltaB,
      }).catch?.(() => {});
    }

    const actRef = doc(collection(db, "clanActivities"));
    const desc = winnerClanId
      ? `${winnerClanId === war.challengerClanId ? war.challengerClanName : war.targetClanName} won the Clan War (${score1} - ${score2})`
      : `Clan War clash ended in an honorable draw (${score1} - ${score2})`;

    tx.set(actRef, {
      clanId: war.challengerClanId,
      type: winnerClanId === war.challengerClanId ? "battle_won" : winnerClanId ? "battle_lost" : "battle_drawn",
      description: desc,
      timestamp: now,
    });

    return {
      challengeId,
      winnerClanId,
      challengerClanId: war.challengerClanId,
      challengerClanName: war.challengerClanName ?? "Challenger Clan",
      challengerClanTag: war.challengerClanTag ?? "CLAN",
      targetClanId: war.targetClanId,
      targetClanName: war.targetClanName ?? "Opponent Clan",
      targetClanTag: war.targetClanTag ?? "RIVAL",
      scoreA: score1,
      scoreB: score2,
      cpDeltaA,
      cpDeltaB,
      xpDeltaA,
      xpDeltaB,
      newCpA,
      newCpB,
      newLvlA: Math.max(cA.level ?? 1, nextLvlA),
      newLvlB: Math.max(cB.level ?? 1, nextLvlB),
      p1Uid,
      p2Uid,
      challengerUids,
      targetUids,
    };
  });
}
