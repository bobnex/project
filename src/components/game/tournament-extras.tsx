import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Crown, Eye, Gift, Medal, Radio, Save, Sparkles, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/game/ui";
import { PlayerAvatar } from "@/components/game/Avatar";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/game-rules";
import { loadQuestions, type Question } from "@/lib/engine";
import { updateTournament } from "@/lib/tournament-engine";
import { cleanPrizes, knockoutPodium, type Fixture, type Tournament } from "@/lib/tournament-rules";

const PLACES = ["1st", "2nd", "3rd"];

/* ---------- Confetti Canvas Generator ---------- */

function triggerConfetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const colors = ["#eab308", "#f59e0b", "#fbbf24", "#38bdf8", "#ec4899", "#a855f7", "#ffffff"];
  const pieces = Array.from({ length: 65 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height * 0.5,
    w: Math.random() * 8 + 4,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: Math.random() * 3 + 2,
    vx: (Math.random() - 0.5) * 3,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 8,
  }));
  let frame = 0;
  let reqId: number;
  function draw() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.vr;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 200) {
      reqId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  reqId = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(reqId);
}

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
              <div key={r} className="flex w-56 shrink-0 flex-col">
                <div className="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase">{roundName(r, last, list.length)}</div>
                <div className="flex flex-1 flex-col justify-around">
                  {list.map((f) => {
                    const hasWinner = !!f.winnerId;
                    return (
                      <div key={f.id} className="relative px-3 py-2">
                        {/* Living connecting lines between tournament rounds */}
                        {ri > 0 && (
                          <span
                            className={cn(
                              "absolute top-1/2 left-0 h-0.5 w-3 transition-colors",
                              hasWinner ? "bg-primary shadow-[0_0_6px_var(--primary)]" : "bg-border"
                            )}
                          />
                        )}
                        {ri < rounds.length - 1 && (
                          <span
                            className={cn(
                              "absolute top-1/2 right-0 h-0.5 w-3 transition-colors",
                              hasWinner ? "bg-primary shadow-[0_0_6px_var(--primary)]" : "bg-border"
                            )}
                          />
                        )}
                        <BracketCard f={f} uid={uid} onWatch={onWatch} />
                      </div>
                    );
                  })}
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
  const isMine = f.aId === uid || f.bId === uid;
  const isLive = f.status === "ready" && !!f.matchId;

  return (
    <div
      className={cn(
        "surface-card relative divide-y text-sm transition-all duration-200",
        isMine && "border-primary/50 shadow-sm",
        isLive && "border-warning/70 ring-2 ring-warning/30 shadow-[0_0_14px_rgba(234,179,8,0.25)]"
      )}
    >
      {isLive && (
        <span className="bg-warning text-warning-foreground absolute -top-2.5 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow">
          <span className="size-1.5 animate-ping rounded-full bg-current" /> Live
        </span>
      )}
      {([["a", f.aId, f.aName, f.scoreA], ["b", f.bId, f.bName || "Bye", f.scoreB]] as const).map(([k, id, name, score]) => {
        const isWinner = f.winnerId === id;
        const isLoser = f.winnerId && f.winnerId !== id;
        return (
          <div
            key={k}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 transition-colors",
              isWinner && "font-bold text-foreground bg-primary/5",
              isLoser && "text-muted-foreground opacity-65",
              id === uid && "bg-primary/10"
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {isWinner && <Crown className="text-warning size-3.5 shrink-0 animate-bounce" />}
              <span className="truncate">{name}</span>
            </span>
            <span className={cn("tabular text-xs font-bold", isWinner && "text-primary")}>
              {f.status === "completed" ? score : "–"}
            </span>
          </div>
        );
      })}
      {isLive && (
        <button
          onClick={() => onWatch(f)}
          className="hover:bg-warning/10 text-warning flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition-colors"
        >
          <Radio className="size-3.5 animate-pulse" /> Watch match
        </button>
      )}
    </div>
  );
}

export function Podium({ fixtures }: { fixtures: Fixture[] }) {
  const p = knockoutPodium(fixtures);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (p.first) {
      const cancel = triggerConfetti(canvasRef.current);
      return cancel;
    }
  }, [p.first]);

  if (!p.first) return null;

  const spots = [
    { place: 2, names: p.second ? [p.second] : [], h: "h-20", cls: "text-muted-foreground", delay: "style={{ animationDelay: '100ms' }}" },
    { place: 1, names: [p.first], h: "h-28", cls: "text-warning", delay: "style={{ animationDelay: '300ms' }}" },
    { place: 3, names: p.third, h: "h-14", cls: "text-accent", delay: "style={{ animationDelay: '200ms' }}" },
  ];

  return (
    <div className="hero-card relative overflow-hidden p-5">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
      <div className="mb-4 flex items-center justify-center gap-2 font-display text-lg font-extrabold tracking-wide">
        <Trophy className="text-warning size-6 animate-float" />
        <span className="bg-gradient-to-r from-warning via-amber-200 to-warning bg-clip-text text-transparent">
          Tournament Champions
        </span>
      </div>
      <div className="flex items-end justify-center gap-3 pt-2">
        {spots.map((s) => (
          <div key={s.place} className="flex w-1/3 max-w-32 flex-col items-center gap-1.5">
            {s.names.length ? (
              s.names.map((n) => (
                <span key={n} className="w-full truncate text-center text-xs font-bold">
                  {n}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
            <div
              className={cn(
                "animate-pedestal flex w-full flex-col items-center justify-start rounded-t-2xl border-t border-x border-border/80 pt-2 transition-transform shadow-lg",
                s.place === 1
                  ? "bg-gradient-to-b from-warning/25 to-card/80 border-warning/50 shadow-warning/15"
                  : "bg-muted/70",
                s.h
              )}
            >
              {s.place === 1 ? (
                <Crown className="text-warning size-6 animate-bounce drop-shadow" />
              ) : (
                <Medal className={cn("size-5", s.cls)} />
              )}
              <span className="mt-1 text-[11px] font-black uppercase tracking-wider opacity-80">
                {PLACES[s.place - 1]}
              </span>
            </div>
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save prizes.");
    }
  }

  return (
    <div className="surface-card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          <Gift className="text-primary size-4" /> Prize pool
        </span>
        {isAdmin && !editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft([0, 1, 2].map((i) => prizes[i] ?? ""));
              setEditing(true);
            }}
          >
            {prizes.length ? "Edit" : "Add prizes"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {PLACES.map((pl, i) => (
            <Input
              key={pl}
              placeholder={`${pl} place prize (e.g. ₦5,000 or Champion badge)`}
              value={draft[i] ?? ""}
              maxLength={80}
              onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="size-4" /> Save
            </Button>
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
      ) : (
        <p className="text-muted-foreground text-sm">No prizes set yet.</p>
      )}
    </div>
  );
}

/** Permanent trophies: every tournament this player has won. */
export function TrophyCabinet({ uid }: { uid: string }) {
  const { fb } = useApp();
  const [wins, setWins] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!fb) return;
    return onSnapshot(
      query(collection(fb.db, "t_players"), where("uid", "==", uid), where("status", "==", "champion")),
      (s) => {
        const ids = s.docs.map((d) => d.data().tournamentId as string);
        Promise.all(
          ids.map(
            (id) =>
              new Promise<{ id: string; name: string }>((res) => {
                const off = onSnapshot(
                  doc(fb.db, "tournaments", id),
                  (t) => {
                    off();
                    res({ id, name: (t.data()?.name as string) ?? "Tournament" });
                  },
                  () => res({ id, name: "Tournament" })
                );
              })
          )
        ).then(setWins);
      },
      () => {}
    );
  }, [fb, uid]);

  if (!wins.length) return null;
  return (
    <div className="surface-card space-y-2 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Trophy className="text-warning size-4" /> Trophy cabinet
      </div>
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

/* ---------- 3. Full Live Spectator Mode & Opponent Alerts ---------- */

export function LiveWatchDialog({ fixture, onClose }: { fixture: Fixture | null; onClose: () => void }) {
  const { fb } = useApp();
  const [m, setM] = useState<Match | null>(null);
  const [qs, setQs] = useState<Record<string, Question>>({});

  useEffect(() => {
    setM(null);
    setQs({});
    if (!fb || !fixture?.matchId) return;
    return onSnapshot(
      doc(fb.db, "matches", fixture.matchId),
      (s) => {
        if (s.exists()) {
          const data = { ...(s.data() as Match), id: s.id };
          setM(data);
          if (data.questionIds?.length) {
            loadQuestions(fb.db, data.questionIds, data.id).then(setQs).catch(() => {});
          }
        } else {
          setM(null);
        }
      },
      () => {}
    );
  }, [fb, fixture?.matchId]);

  const currentQId = m?.questionIds?.[m.currentIndex ?? 0];
  const activeQuestion = currentQId ? qs[currentQId] : null;
  const totalQuestions = m?.questionIds?.length ?? 0;
  const currentNum = Math.min((m?.currentIndex ?? 0) + 1, totalQuestions);
  const progressPercent = totalQuestions > 0 ? (currentNum / totalQuestions) * 100 : 0;

  return (
    <Dialog open={!!fixture} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <div className="flex items-center justify-between border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs text-destructive">
                <span className="size-2 animate-ping rounded-full bg-destructive" />
                SPECTATOR LIVE
              </span>
              <span className="text-muted-foreground text-xs font-medium">Tournament Fixture</span>
            </DialogTitle>
            {m && (
              <Badge variant="outline" className="text-xs">
                {m.status === "completed"
                  ? "Final"
                  : m.status === "countdown"
                  ? "Starting..."
                  : `Q ${currentNum}/${totalQuestions}`}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {!m ? (
          <div className="space-y-3 py-6 text-center">
            <Radio className="text-muted-foreground mx-auto size-8 animate-pulse" />
            <p className="text-muted-foreground text-sm">Connecting to live battle stream…</p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Contenders Faceoff Arena */}
            <div className="surface-card bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-4">
                {m.playerIds.slice(0, 2).map((id, idx) => {
                  const p = m.players[id];
                  if (!p) return null;
                  const isLeader = m.playerIds.every((o) => o === id || (m.players[o]?.score ?? 0) < p.score);
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1.5",
                        idx === 0 ? "items-start text-left" : "items-end text-right"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {idx === 1 && isLeader && <Crown className="text-warning size-4 animate-bounce" />}
                        <PlayerAvatar name={p.name} size={48} ring={isLeader} />
                        {idx === 0 && isLeader && <Crown className="text-warning size-4 animate-bounce" />}
                      </div>
                      <span className="max-w-32 truncate text-sm font-extrabold">{p.name}</span>
                      <div className="tabular text-3xl font-black text-primary">{p.score}</div>
                      <span className="text-muted-foreground text-[11px]">
                        {p.correct} right · {p.wrong} wrong
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar across questions */}
              {totalQuestions > 0 && (
                <div className="mt-4 space-y-1">
                  <div className="bg-border/60 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground flex justify-between text-[10px]">
                    <span>Round Progress</span>
                    <span>{progressPercent.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Question Display */}
            {activeQuestion && m.status === "live" ? (
              <div className="surface-card space-y-3 p-4">
                <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  Active Question #{currentNum}
                </div>
                <p className="text-sm font-semibold leading-relaxed">{activeQuestion.text}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {activeQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className="bg-muted/60 border-border/70 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ) : m.status === "completed" ? (
              <div className="bg-success/10 text-success rounded-xl p-3 text-center text-sm font-bold">
                Match concluded! Final results are recorded in the tournament standings.
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-xs">
                {m.status === "waiting" ? "Players are gathering in the arena..." : "Match in progress…"}
              </p>
            )}

            <Button variant="outline" className="w-full" onClick={onClose}>
              Close spectator view
            </Button>
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
    if (seen.current === null) {
      seen.current = new Set(ready.map((f) => f.id));
      return;
    }
    for (const f of ready) {
      if (seen.current.has(f.id)) continue;
      seen.current.add(f.id);
      const opp = f.aId === uid ? f.bName : f.aName;
      toast(`${opp} is ready for your match!`, {
        action: { label: "Join", onClick: () => onJoin(f) },
        duration: 15000,
      });
    }
  }, [fixtures, uid, onJoin]);
}
