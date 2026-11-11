/**
 * Juvora Clans V1 — Firestore subscriptions, atomic transactions, and mutations.
 */
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { useApp } from "./app-context";
import {
  calculateClanLevel,
  getMaxMembersForLevel,
  INITIAL_ACHIEVEMENTS,
  type ClanActivity,
  type ClanBattleChallenge,
  type ClanCreationFeeOption,
  type ClanDoc,
  type ClanMember,
  type ClanMission,
  type ClanRole,
  type ClanUnlockedAchievement,
} from "./clans";

export function usePlayerClan() {
  const { fb, user } = useApp();
  const [clan, setClan] = useState<ClanDoc | null>(null);
  const [membership, setMembership] = useState<ClanMember | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [activities, setActivities] = useState<ClanActivity[]>([]);
  const [achievements, setAchievements] = useState<Record<string, ClanUnlockedAchievement>>({});
  const [missions, setMissions] = useState<ClanMission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb || !user) {
      setClan(null);
      setMembership(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Find player's clan membership
    const unsubMember = onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid)),
      async (snap) => {
        if (snap.empty) {
          setClan(null);
          setMembership(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const memDoc = snap.docs[0]!;
        const memData = { ...memDoc.data(), uid: user.uid } as ClanMember;
        setMembership(memData);
        const clanId = memDoc.data().clanId as string;

        // Subscribe to clan document
        const unsubClan = onSnapshot(doc(fb.db, "clans", clanId), (cSnap) => {
          if (cSnap.exists()) {
            setClan({ ...(cSnap.data() as ClanDoc), id: cSnap.id });
          }
        });

        // Subscribe to clan members
        const unsubAllMembers = onSnapshot(
          query(collection(fb.db, "clanMembers"), where("clanId", "==", clanId)),
          (mSnap) => {
            const list = mSnap.docs.map((d) => ({ ...d.data(), uid: d.id.split("_")[1] || d.data().uid } as ClanMember));
            list.sort((a, b) => b.contributionScore - a.contributionScore);
            setMembers(list);
          }
        );

        // Subscribe to activities
        const unsubActivities = onSnapshot(
          query(collection(fb.db, "clanActivities"), where("clanId", "==", clanId), orderBy("timestamp", "desc")),
          (aSnap) => {
            setActivities(aSnap.docs.slice(0, 20).map((d) => ({ ...d.data(), id: d.id } as ClanActivity)));
          }
        );

        // Subscribe to unlocked achievements
        const unsubAch = onSnapshot(
          query(collection(fb.db, "clanUnlockedAchievements"), where("clanId", "==", clanId)),
          (achSnap) => {
            const map: Record<string, ClanUnlockedAchievement> = {};
            achSnap.docs.forEach((d) => {
              const data = d.data() as ClanUnlockedAchievement;
              map[data.achievementId] = data;
            });
            setAchievements(map);
          }
        );

        setLoading(false);

        return () => {
          unsubClan();
          unsubAllMembers();
          unsubActivities();
          unsubAch();
        };
      },
      () => setLoading(false)
    );

    return () => unsubMember();
  }, [fb, user]);

  return { clan, membership, members, activities, achievements, missions, loading };
}

export function useClansDirectory() {
  const { fb } = useApp();
  const [clans, setClans] = useState<ClanDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb) return;
    const unsub = onSnapshot(
      query(collection(fb.db, "clans"), orderBy("competitivePoints", "desc")),
      (snap) => {
        setClans(snap.docs.map((d) => ({ ...d.data(), id: d.id } as ClanDoc)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [fb]);

  return { clans, loading };
}

export function useClanBattles(clanId?: string) {
  const { fb } = useApp();
  const [battles, setBattles] = useState<ClanBattleChallenge[]>([]);

  useEffect(() => {
    if (!fb || !clanId) return;
    const unsub = onSnapshot(
      query(collection(fb.db, "clanBattles"), orderBy("createdAt", "desc")),
      (snap) => {
        const matches = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as ClanBattleChallenge))
          .filter((b) => b.challengerClanId === clanId || b.targetClanId === clanId);
        setBattles(matches);
      }
    );
    return () => unsub();
  }, [fb, clanId]);

  return battles;
}

export async function createClan(
  db: Firestore,
  user: { uid: string; displayName?: string | null },
  profile: { level: number; username: string; coins?: number },
  params: {
    name: string;
    tag: string;
    motto: string;
    description: string;
    emblem: string;
    banner: string;
    feeOption: ClanCreationFeeOption;
  }
) {
  if (profile.level < 6) throw new Error("You must reach Level 6 or above to form a clan.");
  const cleanName = params.name.trim();
  const cleanTag = params.tag.trim().toUpperCase();
  if (cleanName.length < 3 || cleanName.length > 25) throw new Error("Clan name must be between 3 and 25 characters.");
  if (cleanTag.length < 2 || cleanTag.length > 6) throw new Error("Clan tag must be between 2 and 6 letters.");

  const clanDocId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  await runTransaction(db, async (tx) => {
    // Check if user is already in a clan
    const memQuery = await tx.get(doc(db, "clanMembers", `${clanDocId}_${user.uid}`));
    if (memQuery.exists()) throw new Error("You are already in a clan.");

    // Check unique clan name & tag
    const existingClan = await tx.get(doc(db, "clans", clanDocId));
    if (existingClan.exists()) throw new Error("A clan with this name already exists.");

    // Deduct fee if paid option chosen
    if (params.feeOption.coins > 0) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await tx.get(userRef);
      const currentCoins = (userSnap.data()?.coins ?? 0) as number;
      if (currentCoins < params.feeOption.coins) {
        throw new Error(`Insufficient Juvora Coins. You need ${params.feeOption.coins} coins.`);
      }
      tx.update(userRef, { coins: currentCoins - params.feeOption.coins });
    }

    const initialCapacity = getMaxMembersForLevel(1);
    const now = Date.now();

    // Create clan record
    tx.set(doc(db, "clans", clanDocId), {
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      tag: cleanTag,
      tagUpper: cleanTag,
      description: params.description.trim(),
      motto: params.motto.trim(),
      emblem: params.emblem,
      banner: params.banner,
      leaderUid: user.uid,
      leaderName: profile.username || "Leader",
      level: 1,
      xp: 0,
      competitivePoints: 1000,
      memberCount: 1,
      maxMembers: initialCapacity,
      isPublic: true,
      creationFeeTier: params.feeOption.id,
      totalBattlesWon: 0,
      totalBattlesLost: 0,
      totalTournamentWins: 0,
      achievementsUnlockedCount: 0,
      createdAt: now,
    });

    // Create leader membership
    tx.set(doc(db, "clanMembers", `${clanDocId}_${user.uid}`), {
      clanId: clanDocId,
      uid: user.uid,
      username: profile.username || "Leader",
      role: "leader" as ClanRole,
      joinedAt: now,
      contributionScore: 100,
      battlesWon: 0,
      battlesPlayed: 0,
      questionsAnswered: 0,
      missionsCompleted: 0,
    });

    // Log creation activity
    tx.set(doc(collection(db, "clanActivities")), {
      clanId: clanDocId,
      type: "member_joined",
      description: `${profile.username} founded [${cleanTag}] ${cleanName}!`,
      actorName: profile.username,
      timestamp: now,
    });
  });
}

export async function requestJoinClan(
  db: Firestore,
  user: { uid: string },
  profile: { username: string },
  clan: ClanDoc
) {
  if (clan.memberCount >= clan.maxMembers) throw new Error("This clan has reached its maximum member capacity.");

  const membershipId = `${clan.id}_${user.uid}`;
  await runTransaction(db, async (tx) => {
    const memSnap = await tx.get(doc(db, "clanMembers", membershipId));
    if (memSnap.exists()) throw new Error("You are already a member of this clan.");

    const clanRef = doc(db, "clans", clan.id);
    const currentClan = await tx.get(clanRef);
    const count = (currentClan.data()?.memberCount ?? 0) as number;
    const max = (currentClan.data()?.maxMembers ?? 5) as number;
    if (count >= max) throw new Error("Clan capacity is full.");

    tx.set(doc(db, "clanMembers", membershipId), {
      clanId: clan.id,
      uid: user.uid,
      username: profile.username,
      role: "recruit" as ClanRole,
      joinedAt: Date.now(),
      contributionScore: 0,
      battlesWon: 0,
      battlesPlayed: 0,
      questionsAnswered: 0,
      missionsCompleted: 0,
    });

    tx.update(clanRef, { memberCount: count + 1 });

    tx.set(doc(collection(db, "clanActivities")), {
      clanId: clan.id,
      type: "member_joined",
      description: `${profile.username} joined the clan!`,
      actorName: profile.username,
      timestamp: Date.now(),
    });
  });
}

export async function leaveClan(db: Firestore, clanId: string, uid: string, isLeader: boolean) {
  if (isLeader) throw new Error("The Clan Leader must transfer leadership before leaving or disband the clan.");
  const membershipId = `${clanId}_${uid}`;

  await runTransaction(db, async (tx) => {
    const memRef = doc(db, "clanMembers", membershipId);
    tx.delete(memRef);

    const clanRef = doc(db, "clans", clanId);
    const clanSnap = await tx.get(clanRef);
    if (clanSnap.exists()) {
      const current = (clanSnap.data().memberCount ?? 1) as number;
      tx.update(clanRef, { memberCount: Math.max(1, current - 1) });
    }
  });
}

export async function updateClanMemberRole(
  db: Firestore,
  clanId: string,
  targetUid: string,
  newRole: ClanRole
) {
  const membershipId = `${clanId}_${targetUid}`;
  await updateDoc(doc(db, "clanMembers", membershipId), { role: newRole });
}

export async function kickClanMember(db: Firestore, clanId: string, targetUid: string) {
  const membershipId = `${clanId}_${targetUid}`;
  await runTransaction(db, async (tx) => {
    tx.delete(doc(db, "clanMembers", membershipId));
    const clanRef = doc(db, "clans", clanId);
    const clanSnap = await tx.get(clanRef);
    if (clanSnap.exists()) {
      const count = (clanSnap.data().memberCount ?? 1) as number;
      tx.update(clanRef, { memberCount: Math.max(1, count - 1) });
    }
  });
}

export async function addClanAnnouncement(
  db: Firestore,
  clanId: string,
  author: { uid: string; username: string },
  title: string,
  body: string
) {
  const clanRef = doc(db, "clans", clanId);
  const snap = await getDoc(clanRef);
  if (!snap.exists()) return;
  const current = (snap.data().announcements ?? []) as any[];
  const newAnn = {
    id: `${Date.now()}`,
    authorUid: author.uid,
    authorName: author.username,
    title: title.trim(),
    body: body.trim(),
    createdAt: Date.now(),
  };
  await updateDoc(clanRef, {
    announcements: [newAnn, ...current].slice(0, 10),
  });
}

export async function createClanChallenge(
  db: Firestore,
  challengerClan: ClanDoc,
  targetClan: ClanDoc,
  format: "1v1" | "3v3" | "5v5",
  roster: string[]
) {
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
    createdAt: Date.now(),
  });
}

export async function claimClanAchievementReward(
  db: Firestore,
  clanId: string,
  achievementId: string,
  userUid: string,
  rewardType: string,
  rewardValue: number | string
) {
  const docId = `${clanId}_${achievementId}`;
  await runTransaction(db, async (tx) => {
    const claimRef = doc(db, "clanUnlockedAchievements", docId);
    const snap = await tx.get(claimRef);
    if (snap.exists() && snap.data().claimed) {
      throw new Error("This reward has already been claimed.");
    }

    tx.set(
      claimRef,
      {
        clanId,
        achievementId,
        claimed: true,
        claimedAt: Date.now(),
        claimedByUid: userUid,
      },
      { merge: true }
    );

    // Apply reward
    if (rewardType === "coins" && typeof rewardValue === "number") {
      const userRef = doc(db, "users", userUid);
      const uSnap = await tx.get(userRef);
      const coins = (uSnap.data()?.coins ?? 0) as number;
      tx.update(userRef, { coins: coins + rewardValue });
    } else if (rewardType === "clan_xp" && typeof rewardValue === "number") {
      const clanRef = doc(db, "clans", clanId);
      const cSnap = await tx.get(clanRef);
      if (cSnap.exists()) {
        const curXp = (cSnap.data().xp ?? 0) as number;
        const newXp = curXp + rewardValue;
        const { level } = calculateClanLevel(newXp);
        tx.update(clanRef, {
          xp: newXp,
          level,
          maxMembers: getMaxMembersForLevel(level),
        });
      }
    }
  });
}
