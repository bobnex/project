import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { useApp } from "./app-context";
import {
  type ClanDoc,
  type ClanMember,
  type ClanActivity,
  type ClanBattleDoc,
  type ClanRole,
  type ClanJoinPolicy,
  type ClanBadgeIcon,
  type ClanColorTheme,
  CLAN_CREATION_FEE_COINS,
  CLAN_CREATION_MIN_LEVEL,
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

        const clanUnsub = onSnapshot(doc(fb.db, "clans", memData.clanId), (cSnap) => {
          if (cSnap.exists()) {
            const raw = cSnap.data() as ClanDoc;
            setClan({
              ...raw,
              id: cSnap.id,
              level: raw.level ?? 1,
              xp: raw.xp ?? 0,
              competitivePoints: raw.competitivePoints ?? 0,
              badgeIcon: raw.badgeIcon ?? "shield",
              badgeColor: raw.badgeColor ?? "amber",
              joinPolicy: raw.joinPolicy ?? "open",
            });
            setUnlockedAchievementIds(raw.unlockedAchievementIds ?? []);
            setAchievementClaims(raw.achievementClaims ?? {});
          }
        });

        const membersUnsub = onSnapshot(
          query(collection(fb.db, "clanMembers"), where("clanId", "==", memData.clanId)),
          (mSnap) => {
            const mems = mSnap.docs.map((d) => ({ ...d.data(), uid: d.data().uid } as ClanMember));
            mems.sort((a, b) => (b.contributionScore || 0) - (a.contributionScore || 0));
            setMembers(mems);
          }
        );

        const actUnsub = onSnapshot(
          query(collection(fb.db, "clanActivities"), where("clanId", "==", memData.clanId)),
          (aSnap) => {
            const acts = aSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ClanActivity));
            acts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setActivities(acts.slice(0, 15));
            setLoading(false);
          }
        );

        return () => {
          clanUnsub();
          membersUnsub();
          actUnsub();
        };
      },
      () => {
        setLoading(false);
      }
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

/**
 * Compatible hook adapter so imports of useClanMembership resolve reliably.
 */
export function useClanMembership(dbOrUid?: unknown, uid?: string | null) {
  const targetUid = typeof dbOrUid === "string" ? dbOrUid : uid;
  return usePlayerClan(targetUid);
}

export function useClansDirectory() {
  const { fb } = useApp();
  const [clans, setClans] = useState<ClanDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb) return;
    const unsub = onSnapshot(collection(fb.db, "clans"), (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as ClanDoc;
        return {
          ...raw,
          id: d.id,
          level: raw.level ?? 1,
          xp: raw.xp ?? 0,
          competitivePoints: raw.competitivePoints ?? 0,
          badgeIcon: raw.badgeIcon ?? "shield",
          badgeColor: raw.badgeColor ?? "amber",
          joinPolicy: raw.joinPolicy ?? "open",
        };
      });
      list.sort((a, b) => (b.competitivePoints || 0) - (a.competitivePoints || 0));
      setClans(list);
      setLoading(false);
    });
    return () => unsub();
  }, [fb]);

  return { clans, loading };
}

export function useClanBattles(clanId: string | null) {
  const { fb } = useApp();
  const [challenges, setChallenges] = useState<ClanBattleDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb || !clanId) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    const unsubChallenger = onSnapshot(
      query(collection(fb.db, "clanBattles"), where("challengerClanId", "==", clanId)),
      (cSnap) => {
        const cList = cSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ClanBattleDoc));
        const unsubTarget = onSnapshot(
          query(collection(fb.db, "clanBattles"), where("targetClanId", "==", clanId)),
          (tSnap) => {
            const tList = tSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ClanBattleDoc));
            const all = [...cList, ...tList];
            const dedup = Array.from(new Map(all.map((m) => [m.id, m])).values());
            dedup.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setChallenges(dedup);
            setLoading(false);
          }
        );
        return () => unsubTarget();
      }
    );

    return () => unsubChallenger();
  }, [fb, clanId]);

  return { challenges, loading };
}

async function sendClanCommand(action: string, payload: Record<string, unknown>) {
  const { clanCommand } = await import("./clans.functions");
  const res = await clanCommand({ data: { action, payload } });
  if (!res || !res.ok) {
    throw new Error(res?.error || "Clan command failed.");
  }
  return res;
}

export async function createClan(
  db: Firestore,
  userUid: string,
  username: string,
  userLevel: number,
  userCoins: number,
  data: {
    name: string;
    tag: string;
    description: string;
    badgeIcon: ClanBadgeIcon;
    badgeColor: ClanColorTheme;
    joinPolicy: ClanJoinPolicy;
    minLevelRequired: number;
  }
) {
  if (userLevel < CLAN_CREATION_MIN_LEVEL) {
    throw new Error(`You must be at least level ${CLAN_CREATION_MIN_LEVEL} to create a clan.`);
  }
  if (userCoins < CLAN_CREATION_FEE_COINS) {
    throw new Error(`Creating a clan costs ${CLAN_CREATION_FEE_COINS} coins.`);
  }

  const existingMember = await getDocs(
    query(collection(db, "clanMembers"), where("uid", "==", userUid))
  );
  if (!existingMember.empty) {
    throw new Error("You are already a member of a clan.");
  }

  const tagQuery = await getDocs(
    query(collection(db, "clans"), where("tag", "==", data.tag.toUpperCase()))
  );
  if (!tagQuery.empty) {
    throw new Error("Clan tag already taken.");
  }

  const nameQuery = await getDocs(
    query(collection(db, "clans"), where("name", "==", data.name))
  );
  if (!nameQuery.empty) {
    throw new Error("Clan name already in use.");
  }

  const clanRef = doc(collection(db, "clans"));
  const clanId = clanRef.id;
  const now = Date.now();

  const clanDoc: ClanDoc = {
    id: clanId,
    name: data.name.trim(),
    tag: data.tag.toUpperCase().trim(),
    description: data.description.trim(),
    badgeIcon: data.badgeIcon,
    badgeColor: data.badgeColor,
    leaderUid: userUid,
    leaderUsername: username,
    memberCount: 1,
    maxMembers: 20,
    level: 1,
    xp: 0,
    competitivePoints: 1000,
    joinPolicy: data.joinPolicy,
    minLevelRequired: data.minLevelRequired,
    createdAt: now,
    updatedAt: now,
    totalBattlesPlayed: 0,
    totalBattlesWon: 0,
    seasonRank: 0,
    unlockedAchievementIds: [],
    achievementClaims: {},
  };

  await setDoc(clanRef, clanDoc);

  const memberRef = doc(db, "clanMembers", `${clanId}_${userUid}`);
  const memberDoc: ClanMember = {
    clanId,
    uid: userUid,
    username,
    role: "leader",
    joinedAt: now,
    contributionScore: 0,
    battlesPlayed: 0,
    battlesWon: 0,
    lastActiveAt: now,
  };

  await setDoc(memberRef, memberDoc);

  const actRef = doc(collection(db, "clanActivities"));
  await setDoc(actRef, {
    clanId,
    type: "create",
    description: `${username} founded [${clanDoc.tag}] ${clanDoc.name}`,
    timestamp: now,
  });

  const userRef = doc(db, "profiles", userUid);
  await updateDoc(userRef, {
    coins: userCoins - CLAN_CREATION_FEE_COINS,
    clanId,
    clanTag: clanDoc.tag,
    clanName: clanDoc.name,
  });

  return clanId;
}

export async function requestJoinClan(
  db: Firestore,
  clan: ClanDoc,
  userUid: string,
  username: string,
  userLevel: number
) {
  if (userLevel < clan.minLevelRequired) {
    throw new Error(`Your level (${userLevel}) is below the required level (${clan.minLevelRequired}).`);
  }

  if (clan.memberCount >= clan.maxMembers) {
    throw new Error("This clan has reached maximum member capacity.");
  }

  const existingMember = await getDocs(
    query(collection(db, "clanMembers"), where("uid", "==", userUid))
  );
  if (!existingMember.empty) {
    throw new Error("You are already in a clan. Leave your current clan first.");
  }

  const now = Date.now();

  if (clan.joinPolicy === "open") {
    const memberRef = doc(db, "clanMembers", `${clan.id}_${userUid}`);
    const memberDoc: ClanMember = {
      clanId: clan.id,
      uid: userUid,
      username,
      role: "member",
      joinedAt: now,
      contributionScore: 0,
      battlesPlayed: 0,
      battlesWon: 0,
      lastActiveAt: now,
    };
    await setDoc(memberRef, memberDoc);

    await updateDoc(doc(db, "clans", clan.id), {
      memberCount: (clan.memberCount || 0) + 1,
      updatedAt: now,
    });

    const actRef = doc(collection(db, "clanActivities"));
    await setDoc(actRef, {
      clanId: clan.id,
      type: "member_joined",
      description: `${username} joined the clan`,
      timestamp: now,
    });

    await updateDoc(doc(db, "profiles", userUid), {
      clanId: clan.id,
      clanTag: clan.tag,
      clanName: clan.name,
    });

    return { status: "joined" };
  }

  if (clan.joinPolicy === "closed") {
    throw new Error("This clan is currently not accepting new members.");
  }

  return { status: "requested" };
}

export async function leaveClan(db: Firestore, clanId: string, userUid: string, username: string) {
  const memberRef = doc(db, "clanMembers", `${clanId}_${userUid}`);
  await deleteDoc(memberRef);

  const clanRef = doc(db, "clans", clanId);
  const snap = await getDocs(query(collection(db, "clanMembers"), where("clanId", "==", clanId)));
  const remaining = snap.size;

  if (remaining === 0) {
    await deleteDoc(clanRef);
  } else {
    await updateDoc(clanRef, {
      memberCount: remaining,
      updatedAt: Date.now(),
    });

    const actRef = doc(collection(db, "clanActivities"));
    await setDoc(actRef, {
      clanId,
      type: "member_left",
      description: `${username} left the clan`,
      timestamp: Date.now(),
    });
  }

  await updateDoc(doc(db, "profiles", userUid), {
    clanId: null,
    clanTag: null,
    clanName: null,
  });
}

export async function updateClanMemberRole(
  _db: Firestore,
  clanId: string,
  targetUid: string,
  newRole: ClanRole
) {
  return sendClanCommand("updateRole", {
    clanId,
    targetUid,
    newRole,
  });
}

export async function kickClanMember(
  _db: Firestore,
  clanId: string,
  targetUid: string,
  _targetUsername: string
) {
  return sendClanCommand("kick", {
    clanId,
    targetUid,
  });
}

export async function addClanAnnouncement(
  _db: Firestore,
  clanId: string,
  _authorUid: string,
  _authorName: string,
  message: string
) {
  return sendClanCommand("postAnnouncement", {
    clanId,
    message,
  });
}

export async function createClanChallenge(
  db: Firestore,
  challengerClan: ClanDoc,
  targetClan: ClanDoc,
  userUid: string,
  format: "1v1" | "3v3" | "5v5" = "1v1"
) {
  const ref = doc(collection(db, "clanBattles"));
  const roster = [userUid];
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
