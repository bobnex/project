import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { CalendarClock, Crown, Flame, Medal, RefreshCw, Shield, Trophy, Zap } from "lucide-react";
import { RankBadge } from "@/components/game/RankBadge";
import { useRankedConfig } from "@/lib/ranked-store";
import { isRankedPlaced, rankFor, seasonEnds, seasonId, weekKey, type RankedState } from "@/lib/ranked";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerAvatar } from "@/components/game/Avatar";
import { Empty } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/rankings")({
  head: () => pageMeta("Rankings", "See the top Favoje Battle players by rating, wins and streaks."),
  component: Rankings,
});

type Key = "rp" | "weeklyRp" | "rating" | "wins" | "bestStreak";
interface Row extends RankedState { id: string; username: string; rating: number; wins: number; bestStreak: number; level: number }

function Rankings() {
  const { fb, user, profile } = useApp();
  const [key, setKey] = useState<Key>("rp");
  const rankedCfg = useRankedConfig(fb?.db);
  const [rows, setRows] = useState<Row[] | null>(null);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fb) return;
    let alive = true;
    setRows(null);
    const ranked = key === "rp" || key === "weeklyRp";
    getDocs(query(collection(fb.db, "users"), orderBy(key, "desc"), limit(ranked ? 150 : 50)))
      .then((s) => {
        let list = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, "id">) }));
        // Unranked players (still in placement) and stale weeks don't belong on ranked boards.
        if (ranked) list = list.filter((r) => isRankedPlaced(r, rankedCfg) && !r.rankedSuspended);
        if (key === "weeklyRp") list = list.filter((r) => r.weekKey === weekKey(Date.now()) && (r.weeklyRp ?? 0) > 0);
        if (alive) setRows(list.slice(0, 50));
      })
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [fb, key, tick, rankedCfg]);

  const top = rows?.slice(0, 3) ?? [];
  const podium = [top[1], top[0], top[2]];
  const myPos = rows && user ? rows.findIndex((r) => r.id === user.uid) : -1;
  const daysLeft = Math.max(0, Math.ceil((seasonEnds(Date.now()) - Date.now()) / 86400000));
  const unit = key === "rp" || key === "weeklyRp" ? "RP" : key === "rating" ? "SR" : key === "wins" ? "wins" : "streak";
  const placed = profile ? isRankedPlaced(profile, rankedCfg) : false;
  const rp = profile?.rp ?? 0;
  const rank = rankFor(rp, rankedCfg);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)} disabled={rows === null}>
          <RefreshCw className={cn("size-4", rows === null && "animate-spin")} /> Refresh
        </Button>
      </div>
      {profile && (
        <section className="surface-card overflow-hidden">
          <div
            className="p-4 pb-3"
            style={{ background: `radial-gradient(130% 120% at 0% 0%, color-mix(in oklab, ${rank.tier.color} 20%, transparent), transparent 62%)` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="bg-muted grid size-12 shrink-0 place-items-center rounded-2xl border"
                style={{ borderColor: `color-mix(in oklab, ${rank.tier.color} 45%, transparent)`, boxShadow: `0 8px 22px -12px ${rank.tier.color}` }}
              >
                <Shield className="size-6" style={{ color: rank.tier.color, fill: rank.tier.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.18em]">Your rank</div>
                <div className="font-display truncate text-xl font-extrabold leading-tight">{placed ? rank.label : "Unranked"}</div>
              </div>
              <div className="text-muted-foreground shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                {seasonId(Date.now())}
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-3">
              <div className="tabular text-3xl font-extrabold leading-none">
                {rp}
                <span className="text-muted-foreground ml-1.5 text-[11px] font-bold uppercase tracking-wider">RP</span>
              </div>
              <div className="text-muted-foreground text-right text-[11px] font-semibold">
                {placed
                  ? rank.nextAt === null
                    ? "Top rank reached"
                    : `${rank.nextAt - rp} RP to next rank`
                  : `Placement ${profile.placementPlayed ?? 0}/${rankedCfg.placementMatches}`}
              </div>
            </div>
            <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${placed ? Math.round(rank.progress * 100) : 0}%`, background: rank.tier.color }}
              />
            </div>
          </div>

          <div className="border-t">
            <div className="grid grid-cols-3 divide-x">
              <div className="p-3 text-center">
                <div className="tabular flex items-center justify-center gap-1.5 text-lg font-extrabold">
                  <Trophy className="text-warning size-4" />
                  {myPos >= 0 ? `#${myPos + 1}` : "—"}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] font-semibold uppercase">On this board</div>
              </div>
              <div className="p-3 text-center">
                <div className="tabular flex items-center justify-center gap-1.5 text-lg font-extrabold">
                  <Zap className={cn("size-4", (profile.rankedStreak ?? 0) > 0 ? "text-warning" : "text-muted-foreground")} />
                  {profile.rankedStreak ?? 0}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] font-semibold uppercase">Ranked streak</div>
              </div>
              <div className="p-3 text-center">
                <div className="tabular flex items-center justify-center gap-1.5 text-lg font-extrabold">
                  <CalendarClock className="size-4" />
                  {daysLeft}d
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] font-semibold uppercase">Season ends</div>
              </div>
            </div>
          </div>
        </section>
      )}
      <Tabs value={key} onValueChange={(v) => setKey(v as Key)}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="rp"><Shield className="size-4" /><span className="hidden sm:inline"> Ranked</span></TabsTrigger>
          <TabsTrigger value="weeklyRp"><CalendarClock className="size-4" /><span className="hidden sm:inline"> Weekly</span></TabsTrigger>
          <TabsTrigger value="rating"><Trophy className="size-4" /><span className="hidden sm:inline"> Rating</span></TabsTrigger>
          <TabsTrigger value="wins"><Medal className="size-4" /><span className="hidden sm:inline"> Wins</span></TabsTrigger>
          <TabsTrigger value="bestStreak"><Flame className="size-4" /><span className="hidden sm:inline"> Streak</span></TabsTrigger>
        </TabsList>
      </Tabs>

      {rows && rows.length === 0 && <Empty icon={Trophy} title={key === "rp" || key === "weeklyRp" ? "No ranked players yet — finish placement to appear here" : "No players yet"} />}

      {top.length > 0 && (
        <div className="hero-card grid grid-cols-3 items-end gap-2 p-5">
          {podium.map((r, i) =>
            r ? (
              <div key={r.id} className="flex flex-col items-center gap-2 text-center">
                {i === 1 && <Crown className="text-warning size-6" />}
                <PlayerAvatar name={r.username} size={i === 1 ? 68 : 52} ring={i === 1} />
                <div className="w-full truncate text-sm font-bold">{r.username}</div>
                {(key === "rp" || key === "weeklyRp") && <RankBadge state={r} cfg={rankedCfg} className="justify-center text-xs" />}
                <div className={cn("w-full rounded-t-2xl pt-2", i === 1 ? "bg-gradient-primary text-primary-foreground h-20" : "bg-muted h-14")}>
                  <div className="tabular text-lg font-extrabold">{r[key] ?? 0}</div>
                  <div className="text-[10px] uppercase opacity-80">{unit}</div>
                </div>
              </div>
            ) : <div key={i} />,
          )}
        </div>
      )}

      {rows && rows.length > 3 && (
        <div className="surface-card divide-y">
          {rows.slice(3).map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-3 p-3", r.id === user?.uid && "bg-primary/8")}>
              <span className="tabular text-muted-foreground w-6 text-center text-sm font-bold">{i + 4}</span>
              <PlayerAvatar name={r.username} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.username}</div>
                {key === "rp" || key === "weeklyRp" ? <RankBadge state={r} cfg={rankedCfg} showProgress className="text-xs" /> : <div className="text-muted-foreground text-xs">Level {r.level}</div>}
              </div>
              <span className="tabular font-bold">{r[key] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
