import { doc, updateDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { createRoom, hostStart, joinMatch } from "./engine";

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
  hostUid,
  format,
  explicitSubjects,
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
}) {
  const questionCount = getClanWarQuestionCount(format);
  const subjects = buildClanWarQuestionSubjects(format, explicitSubjects);

  const playerOneUid = challengerRoster[0];
  const playerTwoUid = targetRoster[0];

  if (!playerOneUid || !playerTwoUid) {
    throw new Error("Each clan needs at least one player selected before starting.");
  }

  const playerOneName =
    memberLookup.get(playerOneUid)?.username ??
    "Clan challenger";

  const playerTwoName =
    memberLookup.get(playerTwoUid)?.username ??
    "Clan opponent";

  const room = await createRoom(db, playerOneUid, playerOneName, "classic", subjects, {
    secondsPerQuestion: 15,
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

  await hostStart(db, room.id, hostUid);

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
