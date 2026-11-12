export async function createClanChallenge(
  db: Firestore,
  challengerClan: ClanDoc,
  targetClan: ClanDoc,
  format: "1v1" | "3v3" | "5v5",
  roster: string[]
): Promise<string> {
  const ref = doc(collection(db, "clanBattles"));
  await setDoc(ref, {
    challengerClanId: challengerClan.id,
    challengerClanName: challengerClan.name,
    challengerClanTag: challengerClan.tag,
    targetClanId: targetClan.id,
    targetClanName: targetClan.name,
    targetClanTag: targetClan.tag,
    format,
    status: "pending",
    challengerRoster: roster,
    targetRoster: [],
    createdAt: Date.now(),
  });
  return ref.id;
}
