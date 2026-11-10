export type ClanRole = "leader" | "co-leader" | "general" | "elite" | "member" | "recruit";

export interface ClanCreationFee {
  id: string;
  label: string;
  coins: number;
}

export interface ClanConfig {
  minCreationLevel: number;
  creationFees: ClanCreationFee[];
  initialCapacity: number;
  capacityByLevel: Record<number, number>;
  xpRewards: Record<string, number>;
}

export interface Clan {
  id: string;
  name: string;
  nameLower: string;
  tag: string;
  tagLower: string;
  description: string;
  motto: string;
  emblem: string;
  banner: string;
  leaderUid: string;
  founderUid: string;
  createdAt: number;
  level: number;
  xp: number;
  capacity: number;
  status: "active" | "suspended";
  publicProfile: boolean;
  achievements: string[];
  statistics: {
    wins: number;
    losses: number;
    battles: number;
    missions: number;
    contributions: number;
  };
}

export interface ClanMember {
  id: string;
  clanId: string;
  uid: string;
  role: ClanRole;
  joinedAt: number;
  contribution: number;
  status: "active" | "requested" | "invited";
}

export interface ClanDraft {
  name: string;
  tag: string;
  description: string;
  motto: string;
  emblem: string;
  banner: string;
  feeId: string;
}

export const DEFAULT_CLAN_CAPACITY_BY_LEVEL: Record<number, number> = {
  1: 5,
  2: 7,
  3: 9,
  4: 12,
  5: 15,
  6: 18,
  7: 22,
  8: 26,
  9: 30,
  10: 35,
  15: 45,
  20: 60,
};

export const DEFAULT_CLAN_XP_REWARDS: Record<string, number> = {
  "win-individual": 15,
  "loss-individual": 5,
  "win-3v3": 50,
  "loss-3v3": 15,
  "win-5v5": 75,
  "loss-5v5": 25,
  "daily-mission": 25,
  "weekly-mission": 100,
  "member-milestone": 20,
  "collective-academic": 30,
};

export const DEFAULT_CLAN_CONFIG: ClanConfig = {
  minCreationLevel: 6,
  creationFees: [
    { id: "free", label: "Free", coins: 0 },
    { id: "standard", label: "Standard", coins: 100 },
    { id: "advanced", label: "Advanced", coins: 250 },
    { id: "premium", label: "Premium", coins: 500 },
    { id: "elite", label: "Elite", coins: 1000 },
  ],
  initialCapacity: 5,
  capacityByLevel: DEFAULT_CLAN_CAPACITY_BY_LEVEL,
  xpRewards: DEFAULT_CLAN_XP_REWARDS,
};

export function normalizeClanConfig(raw?: Partial<ClanConfig> | null): ClanConfig {
  const creationFees = Array.isArray(raw?.creationFees) && raw.creationFees.length > 0
    ? raw.creationFees.map((fee) => ({
        id: String(fee?.id ?? "free"),
        label: String(fee?.label ?? "Free"),
        coins: Math.max(0, Number(fee?.coins ?? 0)),
      }))
    : DEFAULT_CLAN_CONFIG.creationFees;

  const capacityByLevel = { ...DEFAULT_CLAN_CAPACITY_BY_LEVEL, ...(raw?.capacityByLevel ?? {}) };
  const xpRewards = { ...DEFAULT_CLAN_XP_REWARDS, ...(raw?.xpRewards ?? {}) };

  return {
    minCreationLevel: Math.max(1, Number(raw?.minCreationLevel ?? DEFAULT_CLAN_CONFIG.minCreationLevel)),
    creationFees,
    initialCapacity: Math.max(1, Number(raw?.initialCapacity ?? DEFAULT_CLAN_CONFIG.initialCapacity)),
    capacityByLevel,
    xpRewards,
  };
}

export function clanCapacityForLevel(level: number, config: ClanConfig = DEFAULT_CLAN_CONFIG): number {
  const normalizedLevel = Math.max(1, Number(level) || 1);
  const configured = config.capacityByLevel?.[normalizedLevel];
  if (typeof configured === "number" && configured > 0) return configured;
  const fallback = DEFAULT_CLAN_CAPACITY_BY_LEVEL[normalizedLevel as keyof typeof DEFAULT_CLAN_CAPACITY_BY_LEVEL];
  return fallback ?? config.initialCapacity ?? DEFAULT_CLAN_CONFIG.initialCapacity;
}

export function clanXpThreshold(level: number): number {
  const num = Math.max(1, Number(level) || 1);
  const base = 150;
  let total = 0;
  for (let i = 1; i < num; i += 1) total += base + (i - 1) * 80;
  return total;
}

export function clanProgress(level: number, xp: number): { currentLevel: number; currentXp: number; nextRequirement: number; progress: number; } {
  const safeLevel = Math.max(1, Number(level) || 1);
  const safeXp = Math.max(0, Number(xp) || 0);
  const currentThreshold = clanXpThreshold(safeLevel);
  const nextThreshold = clanXpThreshold(safeLevel + 1);
  const progress = nextThreshold <= currentThreshold ? 0 : Math.min(100, Math.max(0, ((safeXp - currentThreshold) / (nextThreshold - currentThreshold)) * 100));
  return { currentLevel: safeLevel, currentXp: safeXp, nextRequirement: nextThreshold, progress };
}

export function canCreateClan(
  profile: { level?: number; clanId?: string | null; status?: string; coins?: number } | null | undefined,
  config: ClanConfig = DEFAULT_CLAN_CONFIG,
): boolean {
  if (!profile) return false;
  if (profile.status && profile.status !== "approved") return false;
  if (profile.clanId) return false;
  return (Number(profile.level ?? 0) >= config.minCreationLevel);
}

export function getClanRoleLabel(role: ClanRole): string {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getClanFeeById(config: ClanConfig, feeId: string): ClanCreationFee {
  return config.creationFees.find((fee) => fee.id === feeId) ?? config.creationFees[0] ?? { id: "free", label: "Free", coins: 0 };
}

export function getClanPermissionLabel(role: ClanRole): string {
  switch (role) {
    case "leader":
      return "Full clan control";
    case "co-leader":
      return "Manage members and activities";
    case "general":
      return "Coordinate battles and recruitment";
    case "elite":
      return "Selected leadership actions";
    case "member":
      return "Participate in battles and missions";
    default:
      return "Limited access";
  }
}

export async function getClanConfig(db: FirestoreLike): Promise<ClanConfig> {
  const snap = await getDoc(doc(db, "settings", "clans"));
  return normalizeClanConfig(snap.exists() ? (snap.data() as Partial<ClanConfig>) : undefined);
}

export async function saveClanConfig(db: FirestoreLike, config: ClanConfig): Promise<void> {
  await setDoc(doc(db, "settings", "clans"), normalizeClanConfig(config), { merge: true });
}

export function cleanClanTag(value: string): string {
  const tag = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return tag || "CLAN";
}

export function cleanClanName(value: string): string {
  return value.trim().slice(0, 40);
}

export async function createClanRecord(
  db: FirestoreLike,
  uid: string,
  draft: ClanDraft,
  config: ClanConfig,
  profile: { level?: number; clanId?: string | null; status?: string; coins?: number } | null,
): Promise<Clan> {
  const name = cleanClanName(draft.name);
  const tag = cleanClanTag(draft.tag);
  const tagId = `clan-${tag.toLowerCase()}`;
  const fee = getClanFeeById(config, draft.feeId);

  if (!name) throw new Error("Clan name is required.");
  if (!tag || tag === "CLAN") throw new Error("Use a valid clan tag with letters or numbers.");
  if (!canCreateClan(profile, config)) throw new Error("Only level 6+ players can create a clan.");
  if (profile?.clanId) throw new Error("You are already in a clan.");
  if ((await getDoc(doc(db, "clans", tagId))).exists()) throw new Error("That clan tag is already taken.");

  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data() as Record<string, unknown> | undefined;
  if (!userData) throw new Error("Your player profile could not be loaded.");
  if (String(userData.clanId ?? "").length > 0) throw new Error("You are already in a clan.");
  const coins = Number(userData.coins ?? 0);
  if (fee.coins > 0 && coins < fee.coins) throw new Error(`You need ${fee.coins} Juvora Coins to create a paid clan.`);

  const clan: Clan = {
    id: tagId,
    name,
    nameLower: name.toLowerCase(),
    tag,
    tagLower: tag.toLowerCase(),
    description: draft.description.trim().slice(0, 220) || "A new Juvora clan ready to compete.",
    motto: draft.motto.trim().slice(0, 120) || "Rise together.",
    emblem: draft.emblem || "shield",
    banner: draft.banner || "purple",
    leaderUid: uid,
    founderUid: uid,
    createdAt: Date.now(),
    level: 1,
    xp: 0,
    capacity: clanCapacityForLevel(1, config),
    status: "active",
    publicProfile: true,
    achievements: [],
    statistics: {
      wins: 0,
      losses: 0,
      battles: 0,
      missions: 0,
      contributions: 0,
    },
  };

  await runTransaction(db, async (tx) => {
    const account = await tx.get(doc(db, "users", uid));
    const accountData = account.data() as Record<string, unknown> | undefined;
    if (!accountData) throw new Error("Player account not found.");
    if (String(accountData.clanId ?? "").length > 0) throw new Error("You are already in a clan.");
    if (Number(accountData.level ?? 0) < config.minCreationLevel) throw new Error("Level requirement not met.");

    const feeCoins = fee.coins;
    const currentCoins = Number(accountData.coins ?? 0);
    if (feeCoins > 0 && currentCoins < feeCoins) throw new Error("Not enough Juvora Coins.");

    tx.set(doc(db, "clans", tagId), clan);
    tx.set(doc(db, "clanMembers", `${tagId}_${uid}`), {
      id: `${tagId}_${uid}`,
      clanId: tagId,
      uid,
      role: "leader",
      joinedAt: Date.now(),
      contribution: 0,
      status: "active",
    } satisfies ClanMember);
    tx.update(doc(db, "users", uid), {
      clanId: tagId,
      clanRole: "leader",
      coins: feeCoins > 0 ? currentCoins - feeCoins : currentCoins,
    });
  });

  return clan;
}

export async function requestClanJoin(db: FirestoreLike, clanId: string, uid: string): Promise<void> {
  const membershipId = `${clanId}_${uid}`;
  const membership = await getDoc(doc(db, "clanMembers", membershipId));
  if (membership.exists()) {
    const data = membership.data() as Partial<ClanMember> | undefined;
    if ((data?.status ?? "active") === "active") throw new Error("You are already a member of this clan.");
    await updateDoc(doc(db, "clanMembers", membershipId), { status: "requested", role: "recruit" });
    return;
  }
  await setDoc(doc(db, "clanMembers", membershipId), {
    id: membershipId,
    clanId,
    uid,
    role: "recruit",
    joinedAt: Date.now(),
    contribution: 0,
    status: "requested",
  } satisfies ClanMember);
}

export async function createClanMembershipSnapshot(db: FirestoreLike, clanId: string): Promise<ClanMember[]> {
  const snap = await getDocs(query(collection(db, "clanMembers"), where("clanId", "==", clanId)));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ClanMember, "id">) }));
}

export { getDoc, getDocs, setDoc, updateDoc, doc, query, collection, where, runTransaction } from "firebase/firestore";

type FirestoreLike = {
  toJSON?: () => unknown;
};
