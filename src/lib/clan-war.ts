import { collection, doc, runTransaction, updateDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { createRoom, hostStart, joinMatch } from "./engine";
import type { Match } from "./game-rules";
import { calculateClanLevel } from "./clans";

export type ClanWarFormat = "1v1" | "3v3" | "5v5";

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
}

export function getClanWarQuestionCount(format: ClanWarFormat): number {
  if (format === "1v1") return 10;
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

  // Create duel room as classic 1v1 duel
  const room = await createRoom(db, playerOneUid, playerOneName, "classic", subjects, {
    secondsPerQuestion: Math.max(5, Math.min(60, secondsPerQuestion)),
    questionCount,
  });

  // Second player joins room
  await joinMatch(db, room.id, playerTwoUid, playerTwoName);

  // Link match to clan war
  await updateDoc(doc(db, "matches", room.id), {
    ranked: false,
    clanWarId: challengeId,
    clanAId,
    clanBId,
    questionCount,
    subjects,
  });

  // Start the countdown using room's hostId
  await hostStart(db, room.id, playerOneUid);

  // Set challenge to in_progress
  await updateDoc(doc(db, "clanBattles", challengeId), {
    status: "in_progress",
    matchId: room.id,
    playerOneUid,
    playerTwoUid,
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

    const p1Uid = war.playerOneUid || match.playerIds[0];
    const p2Uid = war.playerTwoUid || match.playerIds[1];
    const score1 = match.players[p1Uid]?.score ?? 0;
    const score2 = match.players[p2Uid]?.score ?? 0;

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

    const clanARef = doc(db, "clans", war.challengerClanId);
    const clanBRef = doc(db, "clans", war.targetClanId);
    const [clanASnap, clanBSnap] = await Promise.all([tx.get(clanARef), tx.get(clanBRef)]);

    const cA = clanASnap.exists() ? clanASnap.data() : {};
    const cB = clanBSnap.exists() ? clanBSnap.data() : {};

    const newCpA = Math.max(0, (cA.competitivePoints ?? 0) + cpDeltaA);
    const nextXpA = (cA.xp ?? 0) + xpDeltaA;
    const { level: nextLvlA } = calculateClanLevel(nextXpA);

    const newCpB = Math.max(0, (cB.competitivePoints ?? 0) + cpDeltaB);
    const nextXpB = (cB.xp ?? 0) + xpDeltaB;
    const { level: nextLvlB } = calculateClanLevel(nextXpB);

    if (war.status !== "completed") {
      const now = Date.now();
      const scores: Record<string, number> = {
        [war.challengerClanId]: score1,
        [war.targetClanId]: score2,
      };

      tx.update(challengeRef, {
        status: "completed",
        winnerClanId,
        scores,
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

      // Update duel participants' member contributions
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
    }

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
    };
  });
}
