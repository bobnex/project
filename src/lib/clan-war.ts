import { collection, doc, runTransaction, updateDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { createRoom, hostStart, joinMatch } from "./engine";
import type { Match } from "./game-rules";
import { calculateClanLevel } from "./clans";

export type ClanWarFormat = "1v1" | "3v3" | "5v5";

export const CLAN_WAR_SUBJECTS = ["general", "mathematics", "english"] as const;

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

export async function settleClanWarMatch(db: Firestore, challengeId: string, match: Match) {
  const challengeRef = doc(db, "clanBattles", challengeId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists()) return;
    const war = snap.data();
    if (war.status === "completed") return;

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

    const clanARef = doc(db, "clans", war.challengerClanId);
    const clanBRef = doc(db, "clans", war.targetClanId);
    const [clanASnap, clanBSnap] = await Promise.all([tx.get(clanARef), tx.get(clanBRef)]);

    if (clanASnap.exists()) {
      const cA = clanASnap.data();
      const isWin = winnerClanId === war.challengerClanId;
      const isDraw = winnerClanId === null;
      const cpDelta = isWin ? 25 : isDraw ? 10 : 0;
      const xpDelta = isWin ? 100 : isDraw ? 50 : 25;
      const nextXp = (cA.xp ?? 0) + xpDelta;
      const { level: nextLvl } = calculateClanLevel(nextXp);

      tx.update(clanARef, {
        competitivePoints: Math.max(0, (cA.competitivePoints ?? 0) + cpDelta),
        totalBattlesWon: (cA.totalBattlesWon ?? 0) + (isWin ? 1 : 0),
        totalBattlesLost: (cA.totalBattlesLost ?? 0) + (!isWin && !isDraw ? 1 : 0),
        xp: nextXp,
        level: Math.max(cA.level ?? 1, nextLvl),
      });
    }

    if (clanBSnap.exists()) {
      const cB = clanBSnap.data();
      const isWin = winnerClanId === war.targetClanId;
      const isDraw = winnerClanId === null;
      const cpDelta = isWin ? 25 : isDraw ? 10 : 0;
      const xpDelta = isWin ? 100 : isDraw ? 50 : 25;
      const nextXp = (cB.xp ?? 0) + xpDelta;
      const { level: nextLvl } = calculateClanLevel(nextXp);

      tx.update(clanBRef, {
        competitivePoints: Math.max(0, (cB.competitivePoints ?? 0) + cpDelta),
        totalBattlesWon: (cB.totalBattlesWon ?? 0) + (isWin ? 1 : 0),
        totalBattlesLost: (cB.totalBattlesLost ?? 0) + (!isWin && !isDraw ? 1 : 0),
        xp: nextXp,
        level: Math.max(cB.level ?? 1, nextLvl),
      });
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
  });
}
