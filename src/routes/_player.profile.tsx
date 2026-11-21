import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  Award,
  CalendarCheck,
  CalendarDays,
  Crown,
  Flame,
  Gamepad2,
  GraduationCap,
  Handshake,
  Moon,
  Percent,
  Settings,
  Shield,
  Sun,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CosmeticAvatar } from "@/components/game/CosmeticPreview";
import { RankBadge } from "@/components/game/RankBadge";
import { TrophyCabinet } from "@/components/game/tournament-extras";
import { useApp } from "@/lib/app-context";
import { DEFAULT_COSMETICS, getCardThemeStyle } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/cosmetics-store";
import { useRankedConfig } from "@/lib/ranked-store";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_player/profile")({
  head: () =>
    pageMeta(
      "Player profile",
      "Your Juvora rank, cosmetics, trophies and battle history.",
    ),
  component: Profile,
});

interface HistoryItem {
  id: string;
  opponent: string;
  subject: string;
  won: boolean;
  score: number;
  oppScore: number;
  at: number;
  mode?: string;
  cbtScore?: number;
  tournamentId?: string;
  tournamentWon?: boolean;
  friendChallenge?: boolean;
  friendChallengesReceived?: number;
  activityDate?: string;
  subjectWins?: number;
  academicWins?: number;
}

interface AchievementProfile {
  battles: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  level: number;
  rp: number;
  cbtCompleted: number;
  cbtBestScore: number;
  subjectWins: Record<string, number>;
  academicWins: number;
  loginStreak: number;
  activityStreak: number;
  friendChallengesCompleted: number;
  friendChallengesReceived: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
}

interface BadgeDefinition {
  id: string;
  label: string;
  icon: typeof Trophy;
  test: (profile: AchievementProfile, history: HistoryItem[]) => boolean;
}

const BADGES: BadgeDefinition[] = [
  {
    id: "first-blood",
    label: "First Blood",
    icon: Swords,
    test: (profile) => profile.wins >= 1,
  },
  {
    id: "battle-veteran",
    label: "Battle Veteran",
    icon: Shield,
    test: (profile) => profile.battles >= 50,
  },
  {
    id: "century-fighter",
    label: "Century Fighter",
    icon: Trophy,
    test: (profile) => profile.battles >= 100,
  },
  {
    id: "unstoppable",
    label: "Unstoppable",
    icon: Flame,
    test: (profile) => profile.bestStreak >= 5,
  },
  {
    id: "dominator",
    label: "Dominator",
    icon: Zap,
    test: (profile) => profile.bestStreak >= 10,
  },
  {
    id: "rising-scholar",
    label: "Rising Scholar",
    icon: GraduationCap,
    test: (profile) => profile.cbtBestScore >= 80,
  },
  {
    id: "perfectionist",
    label: "Perfectionist",
    icon: Target,
    test: (profile) => profile.cbtBestScore >= 100,
  },
  {
    id: "knowledge-seeker",
    label: "Knowledge Seeker",
    icon: Award,
    test: (profile) => profile.cbtCompleted >= 50,
  },
  {
    id: "subject-specialist",
    label: "Subject Specialist",
    icon: GraduationCap,
    test: (profile) =>
      Object.values(profile.subjectWins).some((wins) => wins >= 10),
  },
  {
    id: "academic-weapon",
    label: "Academic Weapon",
    icon: Crown,
    test: (profile) => profile.academicWins >= 25,
  },
  {
    id: "getting-started",
    label: "Getting Started",
    icon: CalendarCheck,
    test: (profile) => profile.loginStreak >= 3,
  },
  {
    id: "dedicated-scholar",
    label: "Dedicated Scholar",
    icon: CalendarDays,
    test: (profile) => profile.activityStreak >= 7,
  },
  {
    id: "iron-discipline",
    label: "Iron Discipline",
    icon: Shield,
    test: (profile) => profile.activityStreak >= 30,
  },
  {
    id: "early-bird",
    label: "Early Bird",
    icon: Sun,
    test: (_profile, history) =>
      history.some((item) => {
        const hour = new Date(item.at).getHours();
        return item.won && hour < 7;
      }),
  },
  {
    id: "night-owl",
    label: "Night Owl",
    icon: Moon,
    test: (_profile, history) =>
      history.some((item) => {
        const hour = new Date(item.at).getHours();
        return item.won && hour >= 22;
      }),
  },
  {
    id: "challenger",
    label: "Challenger",
    icon: Handshake,
    test: (profile) => profile.friendChallengesCompleted >= 1,
  },
  {
    id: "tournament-rookie",
    label: "Tournament Rookie",
    icon: Users,
    test: (profile) => profile.tournamentsParticipated >= 1,
  },
  {
    id: "champions-crown",
    label: "Champion's Crown",
    icon: Crown,
    test: (profile) => profile.tournamentsWon >= 1,
  },
  {
    id: "crowd-favourite",
    label: "Crowd Favourite",
    icon: Users,
    test: (profile) => profile.friendChallengesReceived >= 20,
  },
  {
    id: "legendary-status",
    label: "Legendary Status",
    icon: Crown,
    test: (profile) => profile.rp >= 4500,
  },
];

function Profile() {
  const { fb, user, profile } = useApp();
  const { settings, wallet } = useCosmetics();
  const rankedCfg = useRankedConfig(fb?.db);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!fb || !user) return;

    return onSnapshot(
      query(
        collection(fb.db, "users", user.uid, "history"),
        orderBy("at", "desc"),
        limit(100),
      ),
      (snapshot) => {
        setHistory(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<HistoryItem, "id">),
          })),
        );
      },
    );
  }, [fb, user]);

  if (!profile) return null;

  const winRate = profile.battles
    ? Math.round((profile.wins / profile.battles) * 100)
    : 0;

  const achievementProfile: AchievementProfile = {
    battles: profile.battles ?? 0,
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
    streak: profile.streak ?? 0,
    bestStreak: profile.bestStreak ?? 0,
    level: profile.level ?? 1,
    rp: profile.rp ?? 0,
    cbtCompleted: profile.cbtCompleted ?? 0,
    cbtBestScore: profile.cbtBestScore ?? 0,
    subjectWins: profile.subjectWins ?? {},
    academicWins: profile.academicWins ?? 0,
    loginStreak: profile.loginStreak ?? 0,
    activityStreak: profile.activityStreak ?? 0,
    friendChallengesCompleted:
      profile.friendChallengesCompleted ?? 0,
    friendChallengesReceived:
      profile.friendChallengesReceived ?? 0,
    tournamentsParticipated:
      profile.tournamentsParticipated ?? 0,
    tournamentsWon: profile.tournamentsWon ?? 0,
  };

  const equippedCardThemeId = wallet?.equipped?.card;
  const cardTheme =
    settings?.cosmetics?.find(
      (cosmetic) => cosmetic.id === equippedCardThemeId,
    ) ||
    DEFAULT_COSMETICS.find(
      (cosmetic) => cosmetic.id === equippedCardThemeId,
    );

  const cardThemeClass = cardTheme?.style
    ? `cosmetic-${cardTheme.style}`
    : "";

  const cardThemeInlineStyle = getCardThemeStyle(cardTheme);

  return (
    <div className="space-y-6">
      {user && <TrophyCabinet uid={user.uid} />}

      <div
        className={cn(
          "hero-card relative flex flex-col items-center overflow-hidden p-6 text-center transition-all duration-300",
          cardThemeClass,
        )}
        style={cardThemeInlineStyle}
      >
        {cardTheme?.cardDesign?.badgeText && (
          <span
            className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
            style={{
              backgroundColor:
                cardTheme.cardDesign.badgeBg ||
                "rgba(212, 175, 55, 0.9)",
              color: cardTheme.cardDesign.badgeColor || "#000000",
            }}
          >
            {cardTheme.cardDesign.badgeText}
          </span>
        )}

        <CosmeticAvatar
          name={profile.username}
          wallet={wallet}
          size={88}
          showTitle
        />

        <h2 className="mt-3 text-2xl font-extrabold">
          {profile.username}
        </h2>

        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <Crown className="text-warning size-4" />
            Level {profile.level}
          </span>
        </div>

        <RankBadge
          state={profile}
          cfg={rankedCfg}
          showProgress
          className="mt-3 w-full max-w-xs"
        />

        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <CalendarDays className="size-3.5" />
          Joined {new Date(profile.createdAt).toLocaleDateString()}
        </div>

        <Button
          asChild
          variant="glass"
          size="sm"
          className="mt-4"
        >
          <Link to="/settings">
            <Settings className="mr-2 size-4" />
            Settings & themes
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-2"
        >
          <Link to="/shop">
            <Crown className="mr-2 size-4" />
            Customize player
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Battles"
          value={profile.battles}
          icon={Gamepad2}
        />
        <Stat
          label="Wins"
          value={profile.wins}
          icon={Trophy}
          tone="success"
        />
        <Stat
          label="Win rate"
          value={`${winRate}%`}
          icon={Percent}
          tone="accent"
        />
        <Stat
          label="Best streak"
          value={profile.bestStreak ?? 0}
          icon={Flame}
          tone="warning"
        />
      </div>

      <section className="space-y-3">
        <h3 className="font-bold">Achievements</h3>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {BADGES.map((badge) => {
            const unlocked = badge.test(
              achievementProfile,
              history,
            );
            const Icon = badge.icon;

            return (
              <div
                key={badge.id}
                className={cn(
                  "surface-card flex flex-col items-center p-3 text-center transition-all",
                  unlocked
                    ? "border-accent/40 bg-accent/5"
                    : "opacity-40",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border",
                    unlocked
                      ? "border-accent bg-accent/20 text-accent"
                      : "bg-muted",
                  )}
                >
                  <Icon className="size-5" />
                </div>

                <p className="mt-2 text-xs font-bold">
                  {badge.label}
                </p>

                <span className="text-muted-foreground text-[10px]">
                  {unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold">Battle history</h3>

        {history.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No battles yet. Go play!
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="surface-card flex items-center justify-between p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    vs {item.opponent}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {item.subject} ·{" "}
                    {new Date(item.at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {item.score} - {item.oppScore}
                  </span>

                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-bold uppercase",
                      item.won
                        ? "bg-success/20 text-success"
                        : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {item.won ? "Win" : "Loss"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Trophy;
  tone?: "success" | "accent" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "accent"
        ? "text-accent"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";

  return (
    <div className="surface-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {label}
        </span>
        <Icon className={cn("size-4", color)} />
      </div>

      <p
        className={cn(
          "tabular mt-1 text-2xl font-extrabold",
          color,
        )}
      >
        {value}
      </p>
    </div>
  );
}
