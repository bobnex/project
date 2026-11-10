import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  Award,
  CalendarDays,
  Crown,
  Flame,
  Gamepad2,
  Percent,
  Settings,
  Swords,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CosmeticAvatar } from "@/components/game/CosmeticPreview";
import { RankBadge } from "@/components/game/RankBadge";
import { TrophyCabinet } from "@/components/game/TrophyCabinet";
import { useApp } from "@/lib/app-context";
import { DEFAULT_COSMETICS, getCardThemeStyle } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/cosmetics-store";
import { useRankedConfig } from "@/lib/ranked-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_player/profile")({
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
}

const BADGES = [
  { id: "first", label: "First battle", icon: Swords, test: (p: { battles: number }) => p.battles >= 1 },
  { id: "win1", label: "First win", icon: Trophy, test: (p: { wins: number }) => p.wins >= 1 },
  { id: "win10", label: "10 wins", icon: Award, test: (p: { wins: number }) => p.wins >= 10 },
  { id: "streak3", label: "3 win streak", icon: Flame, test: (p: { bestStreak: number }) => p.bestStreak >= 3 },
  { id: "lvl5", label: "Level 5", icon: Crown, test: (p: { level: number }) => p.level >= 5 },
];

function Profile() {
  const { fb, user, profile } = useApp();
  const { settings, wallet } = useCosmetics();
  const rankedCfg = useRankedConfig(fb?.db);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    return onSnapshot(query(collection(fb.db, "users", user.uid, "history"), orderBy("at", "desc"), limit(30)), s =>
      setHistory(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<HistoryItem, "id">) })))
    );
  }, [fb, user]);

  if (!profile) return null;
  const winRate = profile.battles ? Math.round((profile.wins / profile.battles) * 100) : 0;

  const equippedCardThemeId = wallet?.equipped?.card;
  const cardTheme =
    settings?.cosmetics?.find(c => c.id === equippedCardThemeId) ||
    DEFAULT_COSMETICS.find(c => c.id === equippedCardThemeId);
  const cardThemeClass = cardTheme?.style ? `cosmetic-${cardTheme.style}` : "";
  const cardThemeInlineStyle = getCardThemeStyle(cardTheme);

  return (
    <div className="space-y-6">
      {user && <TrophyCabinet uid={user.uid} />}
      <div
        className={cn(
          "hero-card flex flex-col items-center p-6 text-center relative overflow-hidden transition-all duration-300",
          cardThemeClass
        )}
        style={cardThemeInlineStyle}
      >
        {cardTheme?.cardDesign?.badgeText && (
          <span
            className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm"
            style={{
              backgroundColor: cardTheme.cardDesign.badgeBg || "rgba(212, 175, 55, 0.9)",
              color: cardTheme.cardDesign.badgeColor || "#000000",
            }}
          >
            {cardTheme.cardDesign.badgeText}
          </span>
        )}

        <CosmeticAvatar name={profile.username} wallet={wallet} size={88} showTitle={true} />
        <h2 className="mt-3 text-2xl font-extrabold">{profile.username}</h2>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <Crown className="text-warning size-4" /> Level {profile.level}
          </span>
        </div>
        <RankBadge state={profile} cfg={rankedCfg} showProgress className="mt-3 w-full max-w-xs" />
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <CalendarDays className="size-3.5" /> Joined {new Date(profile.createdAt).toLocaleDateString()}
        </div>
        <Button asChild variant="glass" size="sm" className="mt-4">
          <Link to="/settings">
            <Settings className="size-4 mr-2" /> Settings & themes
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/shop">
            <Crown className="size-4 mr-2" /> Customize player
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Battles" value={profile.battles} icon={Gamepad2} />
        <Stat label="Wins" value={profile.wins} icon={Trophy} tone="success" />
        <Stat label="Win rate" value={`${winRate}%`} icon={Percent} tone="accent" />
        <Stat label="Best streak" value={profile.bestStreak ?? 0} icon={Flame} tone="warning" />
      </div>

      <section className="space-y-3">
        <h3 className="font-bold">Achievements</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BADGES.map(b => {
            const unlocked = b.test(profile);
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className={cn(
                  "surface-card flex flex-col items-center p-3 text-center transition-all",
                  unlocked ? "border-accent/40 bg-accent/5" : "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border",
                    unlocked ? "bg-accent/20 border-accent text-accent" : "bg-muted"
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <p className="mt-2 text-xs font-bold">{b.label}</p>
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
          <p className="text-muted-foreground py-6 text-center text-sm">No battles yet. Go play!</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div
                key={h.id}
                className="surface-card flex items-center justify-between p-3"
              >
                <div>
                  <p className="text-sm font-semibold">vs {h.opponent}</p>
                  <p className="text-muted-foreground text-xs">{h.subject} · {new Date(h.at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {h.score} - {h.oppScore}
                  </span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-bold uppercase",
                      h.won ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                    )}
                  >
                    {h.won ? "Win" : "Loss"}
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
        <span className="text-muted-foreground text-xs">{label}</span>
        <Icon className={cn("size-4", color)} />
      </div>
      <p className={cn("tabular mt-1 text-2xl font-extrabold", color)}>{value}</p>
    </div>
  );
}
