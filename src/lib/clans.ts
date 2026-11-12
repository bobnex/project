/**
 * Juvora Clans V1 — Core domain types, rules, progression, and calculations.
 */

export type ClanRole = "leader" | "co_leader" | "general" | "elite" | "member" | "recruit";

export const ROLE_HIERARCHY: Record<ClanRole, number> = {
  leader: 6,
  co_leader: 5,
  general: 4,
  elite: 3,
  member: 2,
  recruit: 1,
};

export const ROLE_LABELS: Record<ClanRole, string> = {
  leader: "Clan Leader",
  co_leader: "Co-Leader",
  general: "General",
  elite: "Elite Member",
  member: "Member",
  recruit: "Recruit",
};

export interface ClanMember {
  clanId: string;
  uid: string;
  username: string;
  role: ClanRole;
  joinedAt: number;
  contributionScore: number;
  weeklyContributionXP?: number;
  battlesWon: number;
  battlesPlayed: number;
  questionsAnswered: number;
  missionsCompleted: number;
}

export interface ClanAnnouncement {
  id: string;
  authorUid: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface ClanActivity {
  id: string;
  clanId: string;
  type:
    | "create"
    | "member_joined"
    | "member_left"
    | "battle_won"
    | "battle_lost"
    | "battle_drawn"
    | "mission_completed"
    | "achievement_unlocked"
    | "level_up";
  description: string;
  actorName?: string;
  timestamp: number;
}

export const CLAN_CREATION_MIN_LEVEL = 6;
export const CLAN_CREATION_FEE_COINS = 100;

export interface ClanCreationFeeOption {
  id: string;
  name: string;
  coins: number;
  description: string;
}

export const DEFAULT_FEE_OPTIONS: ClanCreationFeeOption[] = [
  { id: "free", name: "Free", coins: 0, description: "Standard initiation" },
  { id: "standard", name: "Standard", coins: 100, description: "Includes starter banner aura" },
  { id: "advanced", name: "Advanced", coins: 250, description: "Includes bronze clan crest" },
  { id: "premium", name: "Premium", coins: 500, description: "Includes silver gilded emblem" },
  { id: "elite", name: "Elite", coins: 1000, description: "Includes radiant gold insignia" },
];

export interface ClanDoc {
  id: string;
  name: string;
  nameLower: string;
  tag: string;
  tagUpper: string;
  description: string;
  motto: string;
  emblem: string;
  banner: string;
  leaderUid: string;
  leaderName: string;
  coLeaderUids?: string[];
  minTrophyRequirement?: number;
  level: number;
  xp: number;
  competitivePoints: number;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
  suspended?: boolean;
  announcements?: ClanAnnouncement[];
  creationFeeTier: string;
  totalBattlesWon: number;
  totalBattlesLost: number;
  totalTournamentWins: number;
  achievementsUnlockedCount: number;
  createdAt: number;
}

export interface ClanBattleChallenge {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanTag: string;
  targetClanId: string;
  targetClanName: string;
  targetClanTag: string;
  format: "1v1" | "3v3" | "5v5";
  status: "pending" | "accepted" | "rejected" | "starting" | "in_progress" | "completed";
  matchIds?: string[];
  matchId?: string;
  challengerRoster: string[]; // uids
  targetRoster?: string[];
  winnerClanId?: string;
  scores?: Record<string, number>;
  createdAt: number;
  resolvedAt?: number;
}

export interface ClanMission {
  id: string;
  title: string;
  description: string;
  type: "daily" | "weekly";
  targetMetric: "battle_wins" | "questions_answered" | "active_members" | "daily_missions";
  targetCount: number;
  currentCount: number;
  rewardXp: number;
  rewardCoins: number;
  completed: boolean;
  expiresAt: number;
}

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface ClanAchievementDef {
  id: string;
  title: string;
  description: string;
  category: "battle" | "membership" | "progression" | "mission" | "academic" | "tournament" | "teamwork" | "special";
  rarity: AchievementRarity;
  isSecret: boolean;
  rewardType: "coins" | "clan_xp" | "emblem" | "banner" | "title";
  rewardValue: number | string;
  rewardLabel: string;
  targetValue: number;
}

export interface ClanUnlockedAchievement {
  achievementId: string;
  unlockedAt: number;
  claimed: boolean;
  claimedAt?: number;
  claimedByUid?: string;
}

export const CLAN_CAPACITY_BY_LEVEL: Record<number, number> = {
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

export function getMaxMembersForLevel(level: number): number {
  const levels = Object.keys(CLAN_CAPACITY_BY_LEVEL)
    .map(Number)
    .sort((a, b) => b - a);
  for (const l of levels) {
    if (level >= l) return CLAN_CAPACITY_BY_LEVEL[l] ?? 5;
  }
  return 5;
}

export function xpForClanLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.8));
}

export function calculateClanLevel(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  let level = 1;
  while (xp >= xpForClanLevel(level + 1)) {
    level++;
    if (level >= 50) break;
  }
  const currentLevelXp = xpForClanLevel(level);
  const nextLevelXp = xpForClanLevel(level + 1);
  return { level, currentLevelXp, nextLevelXp };
}

export function canPerformClanAction(
  role: ClanRole,
  action: "disband" | "transfer" | "promote" | "kick" | "announce" | "battle" | "claim"
): boolean {
  switch (action) {
    case "disband":
    case "transfer":
      return role === "leader";
    case "promote":
    case "kick":
      return role === "leader" || role === "co_leader";
    case "announce":
      return role === "leader" || role === "co_leader";
    case "battle":
      return role === "leader" || role === "co_leader" || role === "general";
    case "claim":
      return role === "leader" || role === "co_leader";
    default:
      return false;
  }
}

export const CLAN_EMBLEMS = ["🛡️", "⚔️", "👑", "🦅", "🦁", "🐉", "🐺", "🔥", "⚡", "💎", "🌟", "🎯"];
export const CLAN_BANNERS = [
  "linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)",
  "linear-gradient(135deg, #d97706 0%, #451a03 100%)",
  "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
  "linear-gradient(135deg, #dc2626 0%, #450a0a 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #2e1065 100%)",
  "linear-gradient(135deg, #0284c7 0%, #082f49 100%)",
];

export const INITIAL_ACHIEVEMENTS: ClanAchievementDef[] = [
  { id: "first_blood", title: "First Blood", description: "Win the clan's very first battle", category: "battle", rarity: "common", isSecret: false, rewardType: "coins", rewardValue: 150, rewardLabel: "150 Coins", targetValue: 1 },
  { id: "war_machine", title: "War Machine", description: "Win 25 clan battles", category: "battle", rarity: "rare", isSecret: false, rewardType: "clan_xp", rewardValue: 500, rewardLabel: "500 Clan XP", targetValue: 25 },
  { id: "dominators", title: "Dominators", description: "Win 100 clan battles", category: "battle", rarity: "legendary", isSecret: false, rewardType: "banner", rewardValue: "Gold Warcrest", rewardLabel: "Exclusive Banner", targetValue: 100 },
  { id: "united", title: "United Force", description: "Recruit 5 members to your roster", category: "membership", rarity: "common", isSecret: false, rewardType: "coins", rewardValue: 100, rewardLabel: "100 Coins", targetValue: 5 },
  { id: "brotherhood", title: "Brotherhood", description: "Reach 15 clan members", category: "membership", rarity: "rare", isSecret: false, rewardType: "clan_xp", rewardValue: 350, rewardLabel: "350 Clan XP", targetValue: 15 },
  { id: "rising_clan", title: "Rising Clan", description: "Ascend to Clan Level 5", category: "progression", rarity: "uncommon", isSecret: false, rewardType: "coins", rewardValue: 250, rewardLabel: "250 Coins", targetValue: 5 },
  { id: "legendary_order", title: "Legendary Order", description: "Ascend to Clan Level 20", category: "progression", rarity: "mythic", isSecret: false, rewardType: "title", rewardValue: "The Undefeated", rewardLabel: "'The Undefeated' Clan Title", targetValue: 20 },
  { id: "task_force", title: "Task Force", description: "Complete 10 collective clan missions", category: "mission", rarity: "uncommon", isSecret: false, rewardType: "coins", rewardValue: 200, rewardLabel: "200 Coins", targetValue: 10 },
  { id: "intellectual_giants", title: "Intellectual Giants", description: "Answer 1,000 academic questions correctly as a clan", category: "academic", rarity: "epic", isSecret: false, rewardType: "coins", rewardValue: 500, rewardLabel: "500 Coins", targetValue: 1000 },
  { id: "secret_underdogs", title: "The Uprising", description: "Defeat a clan possessing a higher level than yours", category: "special", rarity: "epic", isSecret: true, rewardType: "emblem", rewardValue: "Phoenix Blade", rewardLabel: "Secret Phoenix Emblem", targetValue: 1 },
];
