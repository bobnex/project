import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

import { sendClanCommand } from "./clan-command";
import { useApp } from "./app-context";
import {
  calculateClanLevel,
  canPerformClanAction,
  CLAN_CREATION_FEE_COINS,
  CLAN_CREATION_MIN_LEVEL,
  getMaxMembersForLevel,
  type ClanActivity,
  type ClanBattleChallenge,
  type ClanDoc,
  type ClanMember,
  type ClanRole,
} from "./clans";

export function usePlayerClan(uid: string | null | undefined) {
  const { fb } = useApp();
  const [membership, setMembership] = useState<ClanMember | null>(null);
  const [clan, setClan] = useState<ClanDoc | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [activities, setActivities] = useState<ClanActivity[]>([]);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const [achievementClaims, setAchievementClaims] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb || !uid) {
      setMembership(null);
      setClan(null);
      setMembers([]);
      setActivities([]);
      setUnlockedAchievementIds([]);
      setAchievementClaims({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const memUnsub = onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", uid)),
      (snap) => {
        if (snap.empty) {
          setMembership(null);
          setClan(null);
          setMembers([]);
          setActivities([]);
          setUnlockedAchievementIds([]);
          setAchievementClaims({});
          setLoading(false);
          return;
        }

        const memDoc = snap.docs[0];
        const memData = { ...memDoc.data(), uid } as ClanMember;
        setMembership(memData);

        const clanId = memData.clanId;

        const clanUnsub = onSnapshot(doc(fb.db, "clans", clanId), (cSnap) => {
          if (cSnap.exists()) {
            setClan({ ...cSnap.data(), id: cSnap.id } as ClanDoc);
          } else {
            setClan(null);
          }
          setLoading(false);
        });

        const membersUnsub = onSnapshot(
          query(collection(fb.db, "clanMembers"), where("clanId", "==", clanId)),
          (mSnap) => {
            const list = mSnap.docs.map((d) => ({ ...d.data() } as ClanMember));
            setMembers(list);
          },
        );

        const actUnsub = onSnapshot(
          query(collection(fb.db, "clanActivities"), where("clanId", "==", clanId), limit(25)),
          (aSnap) => {
            const list = aSnap.docs
              .map((d) => ({ ...d.data(), id: d.id } as ClanActivity))
              .sort((a, b) => b.timestamp - a.timestamp);
            setActivities(list);
          },
        );

        const achUnsub = onSnapshot(
          query(collection(fb.db, "clanUnlockedAchievements"), where("clanId", "==", clanId)),
          (achSnap) => {
            const ids = achSnap.docs
              .map((d) => d.data().achievementId as string | undefined)
              .filter((id): id is string => !!id);

            const claims = Object.fromEntries(
              achSnap.docs
                .map((d) => {
                  const data = d.data();
                  const achievementId = data.achievementId as string | undefined;
                  if (!achievementId) return null;
                  return [achievementId, !!data.claimed];
                })
                .filter((entry): entry is [string, boolean] => !!entry),
            );

            setUnlockedAchievementIds(ids);
            setAchievementClaims(claims);
          },
        );

        return () => {
          clanUnsub();
          membersUnsub();
          actUnsub();
          achUnsub();
        };
      },
      (err) => {
        console.error("Clan membership listener error:", err);
        setLoading(false);
      },
    );

    return () => memUnsub();
  }, [fb, uid]);

  return {
    membership,
    clan,
    members,
    activities,
    unlockedAchievementIds,
    achievementClaims,
    loading,
  };
}

export function useClansDirectory() {
  const { fb } = useApp();
  const [clans, setClans] = useState<ClanDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb) return;

    const unsub = onSnapshot(
      collection(fb.db, "clans"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as ClanDoc))
          .sort((a, b) => b.competitivePoints - a.competitivePoints);
        setClans(list);
        setLoading(false);
      },
      (err) => {
        console.error("Clans directory error:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [fb]);

  return { clans, loading };
}

export function useClanBattles(clanId: string | null) {
  const { fb } = useApp();
  const [battles, setBattles] = useState<ClanBattleChallenge[]>([]);

  useEffect(() => {
    if (!fb || !clanId) {
      setBattles([]);
      return;
    }

    const unsub = onSnapshot(
      collection(fb.db, "clanBattles"),
      (snap) => {
        const matches = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as ClanBattleChallenge))
          .filter((b) => b.challengerClanId === clanId || b.targetClanId === clanId)
          .sort((a, b) => b.createdAt - a.createdAt);
        setBattles(matches);
      },
      (err) => console.error("Clan battles listener error:", err),
    );

    return () => unsub();
  }, [fb, clanId]);

  return battles;
}

function newMember(
  clanId: string,
  uid: string,
  username: string,
  role: ClanMember["role"],
  now: number,
): ClanMember {
  return {
    clanId,
    uid,
    username,
    role,
    joinedAt: now,
    contributionScore: 0,
    weeklyContributionXP: 0,
    battlesWon: 0,
    battlesPlayed: 0,
    questionsAnswered: 0,
    missionsCompleted: 0,
  };
}

export async function createClan(
  db: Firestore,
  userUid: string,
  username: string,
  playerLevel: number,
  userCoins: number,
  clanData: {
    name: string;
    tag: string;
    description: string;
    motto: string;
    emblem: string;
    banner: string;
    joinPolicy: "open" | "approval" | "invite_only";
    minTrophyRequirement: number;
    feeTier: "free" | "coins";
  },
) {
  if (playerLevel < CLAN_CREATION_MIN_LEVEL) {
    throw new Error(`Player level ${CLAN_CREATION_MIN_LEVEL} required to establish a clan.`);
  }

  if (clanData.feeTier === "coins" && userCoins < CLAN_CREATION_FEE_COINS) {
    throw new Error(`Insufficient Juvora Coins. ${CLAN_CREATION_FEE_COINS} coins required.`);
  }

  const cleanName = clanData.name.trim();
  const cleanTag = clanData.tag.trim().toUpperCase();

  if (cleanName.length < 3 || cleanName.length > 25) {
    throw new Error("Clan name must be between 3 and 25 characters.");
  }
  if (cleanTag.length < 2 || cleanTag.length > 5) {
    throw new Error("Clan tag must be between 2 and 5 uppercase characters.");
  }

  const existingTagSnap = await getDocs(
    query(collection(db, "clans"), where("tag", "==", cleanTag), limit(1)),
  );
  if (!existingTagSnap.empty) {
    throw new Error(`Clan tag [${cleanTag}] is already registered by another order.`);
  }

  const existingMemberSnap = await getDocs(
    query(collection(db, "clanMembers"), where("uid", "==", userUid), limit(1)),
  );
  if (!existingMemberSnap.empty) {
    throw new Error("You are already enlisted in an active clan. Leave your current clan first.");
  }

  const clanRef = doc(collection(db, "clans"));
  const memberRef = doc(db, "clanMembers", `${clanRef.id}_${userUid}`);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    if (clanData.feeTier === "coins") {
      const userRef = doc(db, "users", userUid);
      const uSnap = await tx.get(userRef);
      const currentCoins = uSnap.data()?.coins ?? 0;
      if (currentCoins < CLAN_CREATION_FEE_COINS) {
        throw new Error("Insufficient Juvora Coins for creation fee.");
      }
      tx.update(userRef, { coins: currentCoins - CLAN_CREATION_FEE_COINS });
    }

    const newClan: Omit<ClanDoc, "id"> = {
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      tag: cleanTag,
      tagUpper: cleanTag,
      description: clanData.description.trim(),
      motto: clanData.motto.trim(),
      emblem: clanData.emblem,
      banner: clanData.banner,
      leaderUid: userUid,
      leaderName: username,
      coLeaderUids: [],
      minTrophyRequirement: clanData.minTrophyRequirement,
      level: 1,
      xp: 0,
      competitivePoints: 0,
      memberCount: 1,
      maxMembers: getMaxMembersForLevel(1),
      isPublic: clanData.joinPolicy !== "invite_only",
      creationFeeTier: clanData.feeTier,
      totalBattlesWon: 0,
      totalBattlesLost: 0,
      totalTournamentWins: 0,
      achievementsUnlockedCount: 0,
      createdAt: now,
    };

    tx.set(clanRef, { ...newClan, joinPolicy: clanData.joinPolicy, updatedAt: now });

    const leaderMember: ClanMember = newMember(clanRef.id, userUid, username, "leader", now);
    tx.set(memberRef, leaderMember);

    const actRef = doc(collection(db, "clanActivities"));
    const act: Omit<ClanActivity, "id"> = {
      clanId: clanRef.id,
      type: "create",
      actorName: username,
      description: `Established Clan [${cleanTag}] ${cleanName}.`,
      timestamp: now,
    };
    tx.set(actRef, act);
  });

  return clanRef.id;
}

export async function requestJoinClan(
  db: Firestore,
  clan: ClanDoc,
  userUid: string,
  username: string,
  playerRP: number,
) {
  if (clan.memberCount >= clan.maxMembers) {
    throw new Error("This clan has reached maximum member capacity.");
  }
  if (playerRP < (clan.minTrophyRequirement ?? 0)) {
    throw new Error(`Minimum ${clan.minTrophyRequirement ?? 0} RP required to enlist in this order.`);
  }

  const existingMemberSnap = await getDocs(
    query(collection(db, "clanMembers"), where("uid", "==", userUid), limit(1)),
  );
  if (!existingMemberSnap.empty) {
    throw new Error("You are already sworn to a clan.");
  }

  const now = Date.now();
  const memberRef = doc(db, "clanMembers", `${clan.id}_${userUid}`);
  const clanRef = doc(db, "clans", clan.id);

  await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(clanRef);
    if (!cSnap.exists()) throw new Error("Clan not found.");
    const cData = cSnap.data();
    if (cData.memberCount >= cData.maxMembers) {
      throw new Error("Clan capacity was reached.");
    }

    const member: ClanMember = newMember(clan.id, userUid, username, "recruit", now);

    tx.set(memberRef, member);
    tx.update(clanRef, {
      memberCount: (cData.memberCount || 0) + 1,
      updatedAt: now,
    });

    const actRef = doc(collection(db, "clanActivities"));
    tx.set(actRef, {
      clanId: clan.id,
      type: "join",
      actorUid: userUid,
      actorName: username,
      details: `${username} joined the clan order as a recruit.`,
      timestamp: now,
    });
  });
}

export async function leaveClan(db: Firestore, clanId: string, userUid: string, username: string) {
  const memberRef = doc(db, "clanMembers", `${clanId}_${userUid}`);
  const clanRef = doc(db, "clans", clanId);

  await runTransaction(db, async (tx) => {
    const mSnap = await tx.get(memberRef);
    if (!mSnap.exists()) return;

    const mData = mSnap.data() as ClanMember;
    if (mData.role === "leader") {
      throw new Error("Leaders cannot abandon their post. Pass leadership to an officer first.");
    }

    const cSnap = await tx.get(clanRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      tx.update(clanRef, {
        memberCount: Math.max(0, (cData.memberCount || 1) - 1),
        updatedAt: Date.now(),
      });
    }

    tx.delete(memberRef);

    const actRef = doc(collection(db, "clanActivities"));
    tx.set(actRef, {
      clanId,
      type: "leave",
      actorUid: userUid,
      actorName: username,
      details: `${username} stepped down and departed from the clan.`,
      timestamp: Date.now(),
    });
  });
}

export async function updateClanMemberRole(
  db: Firestore,
  clanId: string,
  targetUid: string,
  newRole: ClanRole,
) {
  const ref = doc(db, "clanMembers", `${clanId}_${targetUid}`);
  await updateDoc(ref, { role: newRole });
}

export async function kickClanMember(
  db: Firestore,
  clanId: string,
  targetUid: string,
  targetName: string,
  officerUid: string,
  officerName: string,
) {
  const memberRef = doc(db, "clanMembers", `${clanId}_${targetUid}`);
  const clanRef = doc(db, "clans", clanId);

  await runTransaction(db, async (tx) => {
    const mSnap = await tx.get(memberRef);
    if (!mSnap.exists()) return;

    const cSnap = await tx.get(clanRef);
    if (cSnap.exists()) {
      tx.update(clanRef, {
        memberCount: Math.max(0, (cSnap.data().memberCount || 1) - 1),
        updatedAt: Date.now(),
      });
    }

    tx.delete(memberRef);

    const actRef = doc(collection(db, "clanActivities"));
    tx.set(actRef, {
      clanId,
      type: "kick",
      actorUid: officerUid,
      actorName: officerName,
      details: `${officerName} dismissed ${targetName} from the clan.`,
      timestamp: Date.now(),
    });
  });
}

export async function addClanAnnouncement(
  db: Firestore,
  clanId: string,
  officerUid: string,
  officerName: string,
  announcementText: string,
) {
  const actRef = doc(collection(db, "clanActivities"));
  await setDoc(actRef, {
    clanId,
    type: "announcement",
    actorUid: officerUid,
    actorName: officerName,
    details: announcementText.trim(),
    timestamp: Date.now(),
  });
}

export async function createClanChallenge(
  db: Firestore,
  challengerClan: ClanDoc,
  targetClan: ClanDoc,
  format: "1v1" | "3v3" | "5v5",
  roster: string[],
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

export async function claimClanAchievementReward(
  _db: Firestore,
  clanId: string,
  achievementId: string,
  _userUid: string,
  _rewardType: string,
  _rewardValue: number | string,
) {
  return sendClanCommand("claim", {
    clanId,
    achievementId,
  });
}
