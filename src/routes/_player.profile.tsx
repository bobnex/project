import { TrophyCabinet } from "@/components/game/tournament-extras";
import { CosmeticAvatar } from "@/components/game/CosmeticPreview";
import { useCosmetics } from "@/lib/cosmetics-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Award, CalendarDays, Crown, Flame, Gamepad2, History, Percent, Settings, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, Section, Stat } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { pageMeta } from "@/lib/meta";
import { RankBadge } from "@/components/game/RankBadge";
import { useRankedConfig } from "@/lib/ranked-store";
import { HistoryRow, type HistoryItem } from "@/components/game/HistoryRow";

export const Route = createFileRoute("/_player/profile")({
  head: () => pageMeta("Profile", "Your player card, achievements and battle history."),
  component: Profile,
});

const BADGES = [
  { id: "first", label: "First battle", icon: Swords, test: (p: { battles: number }) => p.battles >= 1 },
  { id: "win1", label: "First win", icon: Trophy, test: (p: { wins: number }) => p.wins >= 1 },
  { id: "win10", label: "10 wins", icon: Award, test: (p: { wins: number }) => p.wins >= 10 },
  { id: "streak3", label: "3 win streak", icon: Flame, test: (p: { bestStreak: number }) => p.bestStreak >= 3 },
  { id: "lvl5", label: "Level 5", icon: Crown, test: (p: { level: number }) => p.level >= 5 },
];

function Profile() {
  const { fb, user, profile } = useApp();
  const { wallet } = useCosmetics();
  const rankedCfg = useRankedConfig(fb?.db);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    return onSnapshot(query(collection(fb.db, "users", user.uid, "history"), orderBy("at", "desc"), limit(30)), (s) =>
      setHistory(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryItem, "id">) }))), () => {});
  }, [fb, user]);

  if (!profile) return null;
  const winRate = profile.battles ? Math.round((profile.wins / profile.battles) * 100) : 0;

  return (
    <div className="space-y-6">
      {user && <TrophyCabinet uid={user.uid} />}
      <div className="hero-card flex flex-col items-center p-6 text-center">
        <CosmeticAvatar name={profile.username} wallet={wallet} size={88} showTitle={true} />
        <h2 className="mt-3 text-2xl font-extrabold">{profile.username}</h2>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1"><Crown className="text-warning size-4" /> Level {profile.level}</span>
        </div>
        <RankBadge state={profile} cfg={rankedCfg} showProgress className="mt-3 w-full max-w-xs" />
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs"><CalendarDays className="size-3.5" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</div>
        <Button asChild variant="glass" size="sm" className="mt-4"><Link to="/settings"><Settings className="size-4 mr-2" /> Settings & themes</Link></Button>
        <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/shop"><Crown className="size-4 mr-2" /> Customize player</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Battles" value={profile.battles} icon={Gamepad2} />
        <Stat label="Wins" value={profile.wins} icon={Trophy} tone="success" />
        <Stat label="Win rate" value={`${winRate}%`} icon={Percent} tone="accent" />
        <Stat label="Best streak" value={profile.bestStreak ?? 0} icon={Flame} tone="warning" />
      </div>

      <Section title="Achievements" icon={Award}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {BADGES.map((b) => {
            const on = b.test(profile);
            return (
              <div key={b.id} className={`surface-card flex flex-col items-center gap-2 p-3 text-center ${on ? "" : "opacity-40"}`}>
                <div className={`grid size-10 place-items-center rounded-xl ${on ? "bg-gradient-primary text-primary-foreground" : "bg-muted"}`}><b.icon className="size-5" /></div>
                <span className="text-xs font-semibold">{b.label}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Battle history" icon={History}>
        {history.length === 0 ? <Empty icon={Swords} title="No battles yet" /> : <div className="space-y-2">{history.map((h) => <HistoryRow key={h.id} h={h} />)}</div>}
      </Section>
    </div>
  );
}
