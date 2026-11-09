import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Crown, Eye, Gift, Medal, Radio, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/game/ui";
import { PlayerAvatar } from "@/components/game/Avatar";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/game-rules";
import { updateTournament } from "@/lib/tournament-engine";
import { cleanPrizes, knockoutPodium, type Fixture, type Tournament } from "@/lib/tournament-rules";

const PLACES = ["1st", "2nd", "3rd"];

/* ---------- 1. Bracket tree + podium ---------- */

function roundName(round: number, total: number, count: number) {
  if (round === total && count === 1) return "Final";
  if (round === total - 1 && count === 2) return "Semi-finals";
  if (count === 4 && round === total - 2) return "Quarter-finals";
  return `Round ${round}`;
}

export function BracketTree({ fixtures, uid, onWatch }: { fixtures: Fixture[]; uid: string; onWatch: (f: Fixture) => void }) {
  if (!fixtures.length) return <Empty icon={Trophy} title="No bracket yet" />;
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const last = rounds[rounds.length - 1] ?? 1;
  const firstCount = fixtures.filter((f) => f.round === rounds[0]).length;
  return (
    <div className="space-y-4">
      <Podium fixtures={fixtures} />
      <div className="overflow-x-auto pb-2">
        <div className="flex" style={{ minHeight: Math.max(firstCount, 1) * 96 }}>
          {rounds.map((r, ri) => {
            const list = fixtures.filter((f) => f.round === r);
            return (
              <div key={r} className="flex w-52 shrink-0 flex-col">
                <div className="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase">{roundName(r, last, list.length)}</div>
                <div className="flex flex-1 flex-col justify-around">
                  {list.map((f) => (
                    <div key={f.id} className="relative px-3 py-2">
                      {ri > 0 && <span className="bg-border absolute top-1/2 left-0 h-px w-3" />}
                      {ri < rounds.length - 1 && <span className="bg-border absolute top-1/2 right-0 h-px w-3" />}
                      <BracketCard f={f} uid={uid} onWatch={onWatch} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BracketCard({ f, uid, onWatch }: { f: Fixture; uid: string; onWatch: (f: Fixture) => void }) {
  const live = f.status === "ready" && !!f.matchId;
  return (
    <div className={cn("surface-card divide-y text-sm", (f.aId === uid || f.bId === uid) && "border-primary/50", live && "border-destructive/60")}>
      {([["a", f.aId, f.aName, f.scoreA], ["b", f.bId, f.bName || "Bye", f.scoreB]] as const).map(([k, id, name, score]) => (
        <div key={k} className={cn("flex items-center justify-between px-3 py-1.5",
          f.winnerId && f.winnerId === id && "font-bold", f.winnerId && f.winnerId !== id && "text-muted-foreground", id === uid && "bg-primary/10")}>
          <span className="flex min-w-0 items-center gap-1 truncate">
            {f.winnerId === id && <Crown className="text-warning size-3 shrink-0" />}{name}
          </span>
          <span className="tabular">{f.status === "completed" ? score : "–"}</span>
        </div>
      ))}
      {live && (
        <button onClick={() => onWatch(f)} className="text-destructive flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold">
          <Radio className="size-3 animate-pulse" /> Live · Watch
        </button>
      )}
    </div>
  );
}

export function Podium({ fixtures }: { fixtures: Fixture[] }) {
  const p = knockoutPodium(fixtures);
  if (!p.first) return null;
  const spots = [
    { place: 2, names: p.second ? [p.second] : [], h: "h-16", cls: "text-muted-foreground" },
    { place: 1, names: [p.first], h: "h-24", cls: "text-warning" },
    { place: 3, names: p.third, h: "h-12", cls: "text-accent" },
  ];
  return (
    <div className="hero-card p-4">
      <div className="mb-3 flex items-center justify-center gap-2 font-extrabold"><Trophy className="text-warning size-5" /> Champions</div>
      <div className="flex items-end justify-center gap-2">
        {spots.map((s) => (
          <div key={s.place} className="flex w-1/3 max-w-32 flex-col items-center gap-1">
            {s.names.length ? s.names.map((n) => <span key={n} className="w-full truncate text-center text-xs font-semibold">{n}</span>)
              : <span className="text-muted-foreground text-xs">—</span>}
            <div className={cn("bg-muted flex w-full items-start justify-center rounded-t-xl pt-1", s.h)}>
              <Medal className={cn("size-5", s.cls)} />
            </div>
            <span className="text-xs font-bold">{PLACES[s.place - 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 2. Prize pool ---------- */

export function PrizeCard({ t, isAdmin }: { t: Tournament; isAdmin: boolean }) {
  const { fb } = useApp();
  const prizes = cleanPrizes(t.prizes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(["", "", ""]);
  if (!prizes.length && !isAdmin) return null;

  async function save() {
    if (!fb) return;
    try {
      await updateTournament(fb.db, t.id, { prizes: cleanPrizes(draft) });
      toast.success("Prizes saved.");
      setEditing(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save prizes."); }
  }

  return (
    <div className="surface-card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold"><Gift className="text-primary size-4" /> Prize pool</span>
        {isAdmin && !editing && (
          <Button size="sm" variant="outline" onClick={() => { setDraft([0, 1, 2].map((i) => prizes[i] ?? "")); setEditing(true); }}>
            {prizes.length ? "Edit" : "Add prizes"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {PLACES.map((pl, i) => (
            <Input key={pl} placeholder={`${pl} place prize (e.g. ₦5,000 or Champion badge)`} value={draft[i] ?? ""} maxLength={80}
              onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))} />
          ))}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save}><Save className="size-4" /> Save</Button>
          </div>
        </div>
      ) : prizes.length ? (
        <div className="grid grid-cols-3 gap-2">
          {prizes.map((p, i) => p && (
            <div key={i} className="bg-muted rounded-xl p-2 text-center">
              <Medal className={cn("mx-auto size-4", i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-accent")} />
              <div className="text-xs font-bold">{PLACES[i]}</div>
              <div className="text-xs break-words">{p}</div>
            </div>
          ))}
        </div>
      ) : <p className="text-muted-foreground text-sm">No prizes set yet.</p>}
    </div>
  );
}

/** Permanent trophies: every tournament this player has won. */
export function TrophyCabinet({ uid }: { uid: string }) {
  const { fb } = useApp();
  const [wins, setWins] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!fb) return;
    return onSnapshot(query(collection(fb.db, "t_players"), where("uid", "==", uid), where("status", "==", "champion")), (s) => {
      const ids = s.docs.map((d) => d.data().tournamentId as string);
      Promise.all(ids.map((id) => new Promise<{ id: string; name: string }>((res) => {
        const off = onSnapshot(doc(fb.db, "tournaments", id), (t) => { off(); res({ id, name: (t.data()?.name as string) ?? "Tournament" }); }, () => res({ id, name: "Tournament" }));
      }))).then(setWins);
    }, () => {});
  }, [fb, uid]);
  if (!wins.length) return null;
  return (
    <div className="surface-card space-y-2 p-4">
      <div className="flex items-center gap-2 font-bold"><Trophy className="text-warning size-4" /> Trophy cabinet</div>
      <div className="flex flex-wrap gap-2">
        {wins.map((w) => (
          <span key={w.id} className="bg-warning/12 text-warning flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
            <Crown className="size-3" /> {w.name} — Champion
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- 5. Live spectating + opponent alerts ---------- */

export function LiveWatchDialog({ fixture, onClose }: { fixture: Fixture | null; onClose: () => void }) {
  const { fb } = useApp();
  const [m, setM] = useState<Match | null>(null);
  useEffect(() => {
    setM(null);
    if (!fb || !fixture?.matchId) return;
    return onSnapshot(doc(fb.db, "matches", fixture.matchId), (s) => setM(s.exists() ? ({ ...(s.data() as Match), id: s.id }) : null), () => {});
  }, [fb, fixture?.matchId]);

  return (
    <Dialog open={!!fixture} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="size-5" /> Watching live</DialogTitle></DialogHeader>
        {!m ? <p className="text-muted-foreground text-sm">Waiting for the match to start…</p> : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-center text-xs">
              {m.status === "completed" || m.status === "cancelled" ? "Match finished" : m.status === "waiting" || m.status === "countdown" ? "Players getting ready…"
                : `Question ${Math.min(m.currentIndex + 1, m.questionIds.length)} of ${m.questionIds.length}`}
            </p>
            <div className="flex items-center justify-around">
              {m.playerIds.map((id) => {
                const p = m.players[id];
                if (!p) return null;
                const lead = m.playerIds.every((o) => o === id || (m.players[o]?.score ?? 0) < p.score);
                return (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <PlayerAvatar name={p.name} size={56} ring={lead} />
                    <span className="max-w-28 truncate text-sm font-bold">{p.name}</span>
                    <span className="tabular text-2xl font-extrabold">{p.score}</span>
                    <span className="text-muted-foreground text-xs">{p.correct} right · {p.wrong} wrong</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Toasts when the opponent opens one of my fixtures and is waiting in the lobby. */
export function useOpponentReadyAlert(fixtures: Fixture[], uid: string | undefined, onJoin: (f: Fixture) => void) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!uid) return;
    const ready = fixtures.filter((f) => f.status === "ready" && (f.aId === uid || f.bId === uid));
    if (seen.current === null) { seen.current = new Set(ready.map((f) => f.id)); return; }
    for (const f of ready) {
      if (seen.current.has(f.id)) continue;
      seen.current.add(f.id);
      const opp = f.aId === uid ? f.bName : f.aName;
      toast(`${opp} is ready for your match!`, { action: { label: "Join", onClick: () => onJoin(f) }, duration: 15000 });
    }
  }, [fixtures, uid, onJoin]);
}
