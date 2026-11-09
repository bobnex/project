import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import {
  Activity, Bell, Crown, Flame, Gamepad2, Handshake, History, Megaphone, MailWarning, Percent, Swords, Target, TrendingUp, Trophy, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayerAvatar } from "@/components/game/Avatar";
import { Empty, Section, Stat } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { xpForLevel } from "@/lib/game-rules";
import { RankBadge } from "@/components/game/RankBadge";
import { useRankedConfig } from "@/lib/ranked-store";
import { HistoryRow, type HistoryItem } from "@/components/game/HistoryRow";
import { SponsorStrip } from "@/components/game/SponsorStrip";

export const Route = createFileRoute("/_player/home")({
  head: () => ({
    meta: [
      { title: "Home — JUVORA" },
      { name: "description", content: "Your JUVORA battle dashboard: stats, invitations, recent results and rankings." },
      { property: "og:title", content: "Home — JUVORA" },
      { property: "og:description", content: "Your JUVORA battle dashboard: stats, invitations, recent results and rankings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

interface Leader { id: string; username: string; rating: number; level: number }
interface Invite { id: string; fromName: string; code: string; matchId: string }

function Home() {
  const { fb, user, profile, settings } = useApp();
  const rankedCfg = useRankedConfig(fb?.db);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    const a = onSnapshot(query(collection(fb.db, "users", user.uid, "history"), orderBy("at", "desc"), limit(5)), (s) =>
      setHistory(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryItem, "id">) }))), () => {});
    const b = onSnapshot(query(collection(fb.db, "users"), orderBy("rating", "desc"), limit(5)), (s) =>
      setLeaders(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Leader, "id">) }))), () => {});
    const c = onSnapshot(query(collection(fb.db, "users", user.uid, "notifications"), where("read", "==", false), limit(10)), (s) =>
      setInvites(s.docs.filter((d) => d.data().type === "challenge").map((d) => ({ id: d.id, ...(d.data() as Omit<Invite, "id">) }))), () => {});
    return () => { a(); b(); c(); };
  }, [fb, user]);

  if (!profile) return null;
  const floor = xpForLevel(profile.level);
  const next = xpForLevel(profile.level + 1);
  const pct = Math.round(((profile.xp - floor) / (next - floor)) * 100);
  const winRate = profile.battles ? Math.round((profile.wins / profile.battles) * 100) : 0;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {user && !(profile?.emailVerified ?? user.emailVerified) && (
        <div className="surface-card border-warning/40 flex items-center gap-3 p-3 text-sm">
          <MailWarning className="text-warning size-5 shrink-0" />
          <span className="flex-1">Please verify your email to secure your account.</span>
          <Button size="sm" variant="outline" onClick={() => sendEmailVerification(user).then(() => toast.success("Verification email sent")).catch(() => toast.error("Try again in a minute"))}>
            Resend
          </Button>
        </div>
      )}

      {settings.announcement && (
        <div className="surface-card flex items-start gap-3 p-3 text-sm">
          <Megaphone className="text-accent mt-0.5 size-5 shrink-0" />
          <span>{settings.announcement}</span>
        </div>
      )}

      {profile.status === "pending" && (
        <div className="surface-card flex items-center gap-3 p-3 text-sm">
          <Bell className="text-warning size-5" /> Your account is waiting for admin approval. You can look around, but battles unlock once approved.
        </div>
      )}

      {/* Hero */}
      <div className="hero-card relative overflow-hidden p-5 sm:p-7">
        <Swords className="text-primary/10 absolute -right-6 -bottom-8 size-48 rotate-12" />
        <div className="relative flex items-center gap-4">
          <PlayerAvatar name={profile.username} size={56} ring />
          <div className="min-w-0">
            <div className="text-muted-foreground text-sm">{greet},</div>
            <div className="truncate text-2xl font-extrabold">{profile.username}</div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              <Crown className="text-warning size-3.5" /> Level {profile.level}
            </div>
          </div>
        </div>
        <RankBadge state={profile} cfg={rankedCfg} showProgress className="relative mt-4" />
        <div className="relative mt-4">
          <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
            <span>XP {profile.xp}</span>
            <span>{next - profile.xp} to level {profile.level + 1}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/battle"><Swords /> 1v1 Battle</Link>
          </Button>
          <Button asChild variant="glass" size="lg">
            <Link to="/battle"><Zap /> Rush 50</Link>
          </Button>
        </div>
      </div>

      <SponsorStrip sponsors={settings.sponsors} dismissible />


      {invites.length > 0 && (
        <Section title="Battle invitations" icon={Handshake}>
          {invites.map((i) => (
            <div key={i.id} className="surface-card flex items-center gap-3 p-3">
              <PlayerAvatar name={i.fromName} size={36} />
              <div className="flex-1 text-sm"><b>{i.fromName}</b> challenged you</div>
              <Button asChild size="sm" variant="hero"><Link to="/notifications">Open</Link></Button>
            </div>
          ))}
        </Section>
      )}

      <Section title="Your stats" icon={Activity}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Battles" value={profile.battles} icon={Gamepad2} />
          <Stat label="Wins" value={profile.wins} icon={Trophy} tone="success" />
          <Stat label="Losses" value={profile.losses} icon={X} tone="destructive" />
          <Stat label="Draws" value={profile.draws} icon={Handshake} tone="warning" />
          <Stat label="Win rate" value={`${winRate}%`} icon={Percent} tone="accent" />
          <Stat label="Streak" value={profile.streak} icon={Flame} tone="warning" />
          <Stat label="XP" value={profile.xp} icon={Target} />
          <Stat label="Rating" value={profile.rating} icon={TrendingUp} tone="accent" />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Recent results" icon={History} action={<Link to="/profile" className="text-primary text-sm font-semibold">All</Link>}>
          {history.length === 0 ? (
            <Empty icon={Swords} title="No battles yet" text="Your results will appear here after your first battle." />
          ) : (
            <div className="space-y-2">{history.map((h) => <HistoryRow key={h.id} h={h} />)}</div>
          )}
        </Section>

        <Section title="Top players" icon={Trophy} action={<Link to="/rankings" className="text-primary text-sm font-semibold">Rankings</Link>}>
          {leaders.length === 0 ? (
            <Empty icon={Trophy} title="No rankings yet" />
          ) : (
            <div className="surface-card divide-y">
              {leaders.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 p-3">
                  <span className="tabular text-muted-foreground w-5 text-center text-sm font-bold">{i + 1}</span>
                  <PlayerAvatar name={l.username} size={32} />
                  <span className="flex-1 truncate text-sm font-semibold">{l.username}</span>
                  <span className="tabular text-sm font-bold">{l.rating}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

