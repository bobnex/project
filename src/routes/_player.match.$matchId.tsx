import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Check, Coins, Copy, Crown, Flag, Heart, HeartCrack, Home, Loader2, LogOut, Medal, Play, Shield, Skull, Sparkles, Swords, Timer, TrendingUp, Trophy, Users, Wifi, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/game/Avatar";
import { FullLoader } from "@/components/game/ui";
import { VoiceChat } from "@/components/game/VoiceChat";
import { DuoLobby, TEAM_META } from "@/components/game/DuoLobby";
import { useApp } from "@/lib/app-context";
import { settleClanWarMatch } from "@/lib/clan-war";
import { applyFixtureResult, maybeAdvance } from "@/lib/tournament-engine";
import { RankBadge } from "@/components/game/RankBadge";
import { useRankedConfig } from "@/lib/ranked-store";
import { applyResults, rememberPendingSettle, type MatchRewards, forfeit, hostStart, leaveLobby, loadQuestions, submitAnswer, tick, type Question } from "@/lib/engine";
import { RUSH_MAX_WRONG, alivePlayers, questionMs, resultFor, standings, teamOf, teamScore, type Match, type Team } from "@/lib/game-rules";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/meta";
import { voiceAvailable } from "@/lib/voice-rules";
import { buildBattleCardData, buildCardSummaryText, getBattleCardFileName, renderBattleCardPreview } from "@/lib/shareable-battle-card";
import { play } from "@/lib/sfx";

export const Route = createFileRoute("/_player/match/$matchId")({
  head: () => pageMeta("Live battle", "A live Favoje Battle match."),
  component: MatchPage,
});

function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function MatchPage() {
  const { matchId } = Route.useParams();
  const { fb, user, settings } = useApp();
  const navigate = useNavigate();
  const [m, setM] = useState<Match | null>(null);
  const [missing, setMissing] = useState(false);
  const [qs, setQs] = useState<Record<string, Question>>({});
  const now = useNow();

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(
      doc(fb.db, "matches", matchId),
      (s) => (s.exists() ? setM({ id: s.id, ...(s.data() as Omit<Match, "id">) }) : setMissing(true)),
      () => setMissing(true),
    );
  }, [fb, matchId]);

  const qKey = m?.questionIds.join(",");
  useEffect(() => {
    if (fb && m && m.playerIds.includes(user?.uid ?? "")) loadQuestions(fb.db, m.questionIds, m.id).then(setQs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, qKey, m?.playerIds.length]);

  // Any participant can move the match forward when its timers run out.
  const ticking = useRef(false);
  useEffect(() => {
    if (!fb || !m || !user || !m.playerIds.includes(user.uid) || ticking.current) return;
    ticking.current = true;
    tick(fb.db, m.id, m).finally(() => (ticking.current = false));
  }, [fb, m, now, user]);

  if (missing) return <div className="p-10 text-center">This battle doesn't exist. <Link to="/battle" className="text-primary font-semibold">Back to arena</Link></div>;
  if (!m || !user || !fb) return <FullLoader label="Entering the arena" />;
  if (m.status === "cancelled") return <div className="p-10 text-center">This room was closed. <Link to="/battle" className="text-primary font-semibold">Back to arena</Link></div>;
  if (!m.playerIds.includes(user.uid)) return <div className="p-10 text-center">You're not part of this battle. <Link to="/battle" className="text-primary font-semibold">Back to arena</Link></div>;

  const onLeave = async () => { await leaveLobby(fb.db, m.id, user.uid); navigate({ to: "/battle" }); };
  const screen =
    m.status === "waiting" ? m.mode === "duo" ? <DuoLobby db={fb.db} m={m} uid={user.uid} onLeave={onLeave} /> : <Lobby m={m} uid={user.uid} now={now} onLeave={onLeave} /> :
    m.status === "countdown" ? <Countdown m={m} uid={user.uid} now={now} /> :
    m.status === "completed" ? <Results m={m} uid={user.uid} /> :
    <Live m={m} uid={user.uid} now={now} qs={qs} />;
  const voice = voiceAvailable(m.mode, m.status) && settings.voiceChatEnabled;
  return (
    <>
      {screen}
      {voice && <VoiceChat key={m.id} db={fb.db} matchId={m.id} uid={user.uid} playerIds={m.playerIds} />}
    </>
  );
}

/* ---------------- Lobby ---------------- */
function Lobby({ m, uid, now, onLeave }: { m: Match; uid: string; now: number; onLeave: () => void }) {
  const { fb } = useApp();
  const [busy, setBusy] = useState(false);
  const isHost = m.hostId === uid;
  const left = m.lobbyEndsAt ? Math.max(0, Math.ceil((m.lobbyEndsAt - now) / 1000)) : null;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="hero-card p-6 text-center">
        <div className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          {m.mode === "rush" ? "50 Players Rush" : "Classic 1v1"} lobby
        </div>
        {m.code ? (
          <>
            <div className="tabular font-display mt-3 text-5xl font-extrabold tracking-[0.25em]">{m.code}</div>
            <Button variant="glass" size="sm" className="mt-3" onClick={() => { navigator.clipboard.writeText(m.code!); toast.success("Code copied"); }}>
              <Copy /> Copy code
            </Button>
            <p className="text-muted-foreground mt-3 text-sm">Share this code so friends can join from the Battle page.</p>
          </>
        ) : left !== null ? (
          <div className="mt-3">
            <div className="tabular font-display text-5xl font-extrabold">{left}s</div>
            <p className="text-muted-foreground mt-1 text-sm">Rush starts automatically when the timer ends and at least 2 players are in.</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Loader2 className="text-primary size-10 animate-spin" />
            <p className="text-muted-foreground text-sm">Waiting for your opponent — the battle starts as soon as they join.</p>
          </div>
        )}
      </div>

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between text-sm font-bold">
          <span className="flex items-center gap-2"><Users className="text-primary size-4" /> Players</span>
          <span className="tabular">{m.playerIds.length}/{m.maxPlayers}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {m.playerIds.map((id) => (
            <div key={id} className="bg-muted flex items-center gap-2 rounded-xl p-2">
              <PlayerAvatar name={m.players[id].name} size={28} />
              <span className="truncate text-sm font-semibold">{m.players[id].name}</span>
              {id === m.hostId && <Crown className="text-warning ml-auto size-3.5 shrink-0" />}
            </div>
          ))}
          {m.mode === "classic" && m.playerIds.length < 2 && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Waiting…
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onLeave}><LogOut /> Leave</Button>
        {isHost && m.code && (
          <Button variant="hero" size="lg" className="flex-1" disabled={busy || m.playerIds.length < 2}
            onClick={async () => { setBusy(true); try { await hostStart(fb!.db, m.id, uid); } catch (e) { toast.error((e as Error).message); } setBusy(false); }}>
            <Play /> Start battle
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Countdown / versus ---------------- */
function Countdown({ m, uid, now }: { m: Match; uid: string; now: number }) {
  const n = Math.max(1, Math.ceil((m.countdownEndsAt - now) / 1000));
  useEffect(() => { play("countdown"); }, [n]);
  useEffect(() => () => play("go"), []);
  const opp = m.playerIds.find((id) => id !== uid);
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-10">
      {m.mode === "duo" ? (
        <div className="flex w-full max-w-lg items-center justify-between">
          {(["A", "B"] as Team[]).map((t, i) => (
            <div key={t} className={cn("flex flex-col items-center gap-3", i === 0 ? "animate-vs-left order-1" : "animate-vs-right order-3")}>
              <div className="flex -space-x-4">
                {teamOf(m, t).map((id) => <PlayerAvatar key={id} name={m.players[id].name} size={68} ring />)}
              </div>
              <span className={cn("font-extrabold", TEAM_META[t].text)}>{TEAM_META[t].name}</span>
            </div>
          ))}
          <div className="text-primary font-display animate-pop order-2 text-5xl font-extrabold italic">VS</div>
        </div>
      ) : m.mode === "classic" && opp ? (
        <div className="flex w-full max-w-md items-center justify-between">
          <div className="animate-vs-left flex flex-col items-center gap-2">
            <PlayerAvatar name={m.players[uid].name} size={88} ring />
            <span className="font-bold">{m.players[uid].name}</span>
          </div>
          <div className="text-primary font-display animate-pop text-5xl font-extrabold italic">VS</div>
          <div className="animate-vs-right flex flex-col items-center gap-2">
            <PlayerAvatar name={m.players[opp].name} size={88} ring />
            <span className="font-bold">{m.players[opp].name}</span>
          </div>
        </div>
      ) : (
        <div className="animate-pop flex flex-col items-center gap-2">
          <Zap className="text-accent size-14" />
          <div className="text-2xl font-extrabold">{m.playerIds.length} players enter the Rush</div>
        </div>
      )}
      <div key={n} className="font-display text-primary animate-pop text-8xl font-extrabold">{n}</div>
      <p className="text-muted-foreground text-sm">Get ready…</p>
    </div>
  );
}

/* ---------------- Live question ---------------- */
function Live({ m, uid, now, qs }: { m: Match; uid: string; now: number; qs: Record<string, Question> }) {
  const { fb } = useApp();
  const navigate = useNavigate();
  const q = qs[m.questionIds[m.currentIndex]];
  const me = m.players[uid];
  const idx = String(m.currentIndex);
  const mine = me.answers?.[idx];
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => setPending(null), [m.currentIndex]);

  const msLeft = Math.max(0, m.deadline - now);
  const reveal = m.phase === "reveal";
  const alive = alivePlayers(m).length;
  const opp = m.mode === "classic" ? m.playerIds.find((id) => id !== uid) : undefined;
  const secLeft = Math.ceil(msLeft / 1000);
  useEffect(() => {
    if (!reveal && !mine && secLeft > 0 && secLeft <= 5) play("tick");
  }, [secLeft]); // eslint-disable-line react-hooks/exhaustive-deps
  const revealKey = reveal ? `${m.currentIndex}` : "";
  useEffect(() => {
    if (revealKey && mine) play(mine.correct ? "correct" : "wrong");
  }, [revealKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(i: number) {
    if (!q || mine || pending !== null || reveal || me.eliminated) return;
    setPending(i);
    play("tap");
    try {
      await submitAnswer(fb!.db, m.id, uid, q, i);
    } catch (e) {
      setPending(null);
      toast.error((e as Error).message);
    }
  }

  async function quit() {
    const msg = m.mode === "classic"
      ? "Surrender this battle? It counts as a loss."
      : m.mode === "duo"
        ? "Surrender this battle? Your whole team loses."
        : "Leave the Rush? You'll be eliminated.";
    if (!confirm(msg)) return;
    await forfeit(fb!.db, m.id, uid).catch(() => {});
    if (m.mode === "rush") { rememberPendingSettle(m.id); navigate({ to: "/battle" }); }
  }

  const chosen = mine?.choice ?? pending;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-muted flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
          {m.mode === "rush" ? <Zap className="text-accent size-3.5" /> : <Swords className="text-primary size-3.5" />}
          {m.mode === "rush" ? "RUSH" : m.mode === "duo" ? "2V2" : "1V1"}
        </div>
        <div className="tabular text-sm font-bold">Q {m.currentIndex + 1}/{m.questionIds.length}</div>
        <div className="text-success ml-auto flex items-center gap-1 text-xs"><Wifi className="size-3.5" /> Live</div>
        <Button size="sm" variant="ghost" onClick={quit} aria-label="Surrender"><Flag /></Button>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <Timer className={cn("size-5", msLeft < 5000 && !reveal ? "text-destructive" : "text-primary")} />
        <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", msLeft < 5000 ? "bg-destructive" : "bg-gradient-primary")}
            style={{ width: `${reveal ? 0 : (msLeft / questionMs(m.mode)) * 100}%` }}
          />
        </div>
        <span className="tabular w-8 text-right text-sm font-bold">{reveal ? "–" : Math.ceil(msLeft / 1000)}</span>
      </div>

      {/* Players */}
      {m.mode === "duo" ? (
        <DuoBoard m={m} uid={uid} idx={idx} />
      ) : opp ? (
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard name={me.name} score={me.score} answered={!!mine} you />
          <ScoreCard name={m.players[opp].name} score={m.players[opp].score} answered={!!m.players[opp].answers?.[idx]} />
        </div>
      ) : (
        <div className="surface-card flex items-center gap-4 p-3">
          <div className="flex items-center gap-2"><Users className="text-accent size-5" /><span className="tabular text-lg font-extrabold">{alive}</span><span className="text-muted-foreground text-xs">alive</span></div>
          <div className="flex items-center gap-1">
            {Array.from({ length: RUSH_MAX_WRONG }).map((_, i) =>
              i < RUSH_MAX_WRONG - me.wrong ? <Heart key={i} className="text-destructive fill-destructive size-5" /> : <HeartCrack key={i} className="text-muted-foreground size-5" />,
            )}
          </div>
          <div className="ml-auto text-right"><div className="tabular font-extrabold">{me.score}</div><div className="text-muted-foreground text-xs">points</div></div>
        </div>
      )}

      {me.eliminated ? (
        <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
          <Skull className="text-destructive size-12" />
          <div className="text-xl font-extrabold">You've been eliminated</div>
          <p className="text-muted-foreground text-sm">You can keep watching until the Rush ends. {alive} players remain.</p>
        </div>
      ) : !q ? (
        <FullLoader label="Loading question" />
      ) : (
        <div key={m.currentIndex} className="animate-page space-y-4">
          <div className="surface-card p-5">
            <div className="text-primary mb-2 text-xs font-bold tracking-wide uppercase">{q.subject}{q.topic ? ` · ${q.topic}` : ""}</div>
            <p className="text-lg leading-relaxed font-semibold sm:text-xl">{q.text}</p>
          </div>
          <div className="grid gap-3">
            {q.options.map((opt, i) => {
              const isChosen = chosen === i;
              const isCorrect = reveal && i === q.correctIndex;
              const isWrong = reveal && isChosen && i !== q.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={!!mine || pending !== null || reveal}
                  className={cn(
                    "pressable surface-card flex min-h-14 items-center gap-3 p-4 text-left font-semibold transition-colors",
                    !mine && !reveal && "hover:border-primary",
                    isChosen && !reveal && "border-primary bg-primary/10",
                    isCorrect && "border-success bg-success/15",
                    isWrong && "border-destructive bg-destructive/15",
                  )}
                >
                  <span className={cn("bg-muted grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold", isChosen && "bg-primary text-primary-foreground", isCorrect && "bg-success text-success-foreground", isWrong && "bg-destructive text-destructive-foreground")}>
                    {isCorrect ? <Check className="size-4" /> : isWrong ? <X className="size-4" /> : "ABCD"[i]}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
          <div className="text-muted-foreground h-5 text-center text-sm">
            {reveal
              ? mine?.correct ? <span className="text-success font-bold">Correct! +{mine.points}{mine.sync && " · Sync bonus!"}</span> : <span className="text-destructive font-bold">{mine ? "Wrong — " + mine.points + " points" : "Answer review"}</span>
              : mine ? "Answer locked — waiting for others…" : pending !== null ? "Submitting…" : "Tap your answer"}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ name, score, answered, you }: { name: string; score: number; answered: boolean; you?: boolean }) {
  return (
    <div className={cn("surface-card flex items-center gap-2 p-3", you && "border-primary/50")}>
      <PlayerAvatar name={name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{you ? "You" : name}</div>
        <div className="tabular text-lg font-extrabold">{score}</div>
      </div>
      {answered && <Check className="text-success size-4" />}
    </div>
  );
}

function DuoBoard({ m, uid, idx }: { m: Match; uid: string; idx: string }) {
  const myTeam = m.players[uid].team;
  const a = teamScore(m, "A"), b = teamScore(m, "B");
  const share = a + b === 0 ? 50 : (a / (a + b)) * 100;
  return (
    <div className="surface-card space-y-3 p-3">
      <div className="flex items-center justify-between text-sm font-extrabold">
        <span className={TEAM_META.A.text}>{TEAM_META.A.name}{myTeam === "A" && " (you)"} · <span className="tabular">{a}</span></span>
        <span className={TEAM_META.B.text}><span className="tabular">{b}</span> · {TEAM_META.B.name}{myTeam === "B" && " (you)"}</span>
      </div>
      <div className="bg-accent flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full transition-[width] duration-500" style={{ width: `${share}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(["A", "B"] as Team[]).flatMap((t) => teamOf(m, t)).map((id) => {
          const p = m.players[id];
          const ans = p.answers?.[idx];
          return (
            <div key={id} className={cn("relative flex flex-col items-center gap-1 rounded-xl p-2", TEAM_META[p.team ?? "A"].soft)}>
              <PlayerAvatar name={p.name} size={30} />
              <span className="w-full truncate text-center text-[11px] font-semibold">{id === uid ? "You" : p.name}</span>
              <span className="tabular text-xs font-bold">{p.score}</span>
              {ans && <Check className="text-success absolute top-1 right-1 size-3.5" />}
              {ans?.sync && <Sparkles className="text-warning absolute top-1 left-1 size-3.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Results ---------------- */
function Results({ m, uid }: { m: Match; uid: string }) {
  const { fb, profile } = useApp();
  const rankedCfg = useRankedConfig(fb?.db);
  const [reward, setReward] = useState<MatchRewards | null>(null);
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !fb) return;
    applied.current = true;
    const attempt = (n: number) => applyResults(fb.db, m.id, uid).then((r) => { if (r) setReward(r); }).catch(() => {
      if (n < 4) setTimeout(() => attempt(n + 1), 1500 * (n + 1));
      else rememberPendingSettle(m.id);
    });
    attempt(0);
    if (m.fixtureId && m.tournamentId) {
      const tid = m.tournamentId;
      applyFixtureResult(fb.db, m.fixtureId).then(() => maybeAdvance(fb.db, tid)).catch(() => {});
    }
    const clanWarId = (m as Match & { clanWarId?: string }).clanWarId;
    if (clanWarId) settleClanWarMatch(fb.db, clanWarId, m).catch(() => {});
  }, [fb, m.id, uid]);

  const result = resultFor(m, uid);
  useEffect(() => { play(result === "win" ? "win" : result === "draw" ? "draw" : "lose"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => standings(m), [m]);
  const place = order.indexOf(uid) + 1;
  const title = result === "win" ? "Victory!" : result === "draw" ? "Draw" : "Defeat";
  const Icon = result === "win" ? Trophy : result === "draw" ? Medal : Flag;
  const [seed, setSeed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const card = useMemo(() => buildBattleCardData(m, uid, seed), [m, uid, seed]);
  const summary = useMemo(() => buildCardSummaryText(card), [card]);
  useEffect(() => {
    if (canvasRef.current) renderBattleCardPreview(canvasRef.current, card);
  }, [card]);

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = getBattleCardFileName(card);
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Card downloaded");
  }
  async function copyResult() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Battle summary copied");
    } catch {
      toast.error("Copy failed in this browser");
    }
  }
  async function shareResult() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    try {
      if (blob) {
        const file = new File([blob], getBattleCardFileName(card), { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: "Favoje Battle", text: summary, files: [file] });
          return;
        }
      }
      await navigator.clipboard.writeText(summary);
      toast.success("Sharing isn't supported here — summary copied instead");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Unable to share result");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="hero-card relative overflow-hidden p-6 text-center">
        {result === "win" && <Sparkles className="text-warning animate-float absolute top-4 right-6 size-8" />}
        <div className={cn("animate-pop mx-auto grid size-20 place-items-center rounded-3xl", result === "win" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted")}>
          <Icon className="size-10" />
        </div>
        <h2 className="mt-4 text-4xl font-extrabold">{title}</h2>
        <p className="text-muted-foreground mt-1">
          {m.mode === "rush" ? `You placed #${place} of ${m.playerIds.length}` : m.mode === "duo" ? `${TEAM_META.A.name} ${teamScore(m, "A")} – ${teamScore(m, "B")} ${TEAM_META.B.name}` : `Final score: ${m.players[uid].score}`}
        </p>
        {reward && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Reward icon={Sparkles} label="XP" value={`+${reward.xpGained}`} />
            <Reward icon={Coins} label="Coins" value={`+${reward.coins}`} />
            {reward.ranked ? (
              <Reward icon={TrendingUp} label={reward.ranked.inPlacement ? "Placement" : "RP"} value={reward.ranked.inPlacement ? `${reward.ranked.patch.placementPlayed ?? 0}/${rankedCfg.placementMatches}` : `${reward.ranked.delta >= 0 ? "+" : ""}${reward.ranked.delta}`} />
            ) : (
              <Reward icon={TrendingUp} label="Rating" value={`${reward.delta >= 0 ? "+" : ""}${reward.delta}`} />
            )}
          </div>
        )}
        {reward?.ranked && (
          <div className="bg-muted mt-3 rounded-2xl p-3 text-left">
            {reward.ranked.placementJustFinished && <div className="text-primary mb-1 text-sm font-extrabold">Placement complete — you start at {reward.ranked.rankAfter}!</div>}
            {reward.ranked.streakBonus > 0 && <div className="text-warning mb-1 text-sm font-bold">Win streak bonus +{reward.ranked.streakBonus} RP</div>}
            {reward.ranked.shielded && <div className="text-primary mb-1 text-sm font-bold">Demotion shield saved your rank!</div>}
            {reward.ranked.change === "promoted" && <div className="text-success mb-1 text-sm font-extrabold">Promoted to {reward.ranked.rankAfter}!</div>}
            {reward.ranked.change === "demoted" && <div className="text-destructive mb-1 text-sm font-extrabold">Demoted to {reward.ranked.rankAfter}</div>}
            <RankBadge state={{ ...(profile ?? {}), ...reward.ranked.patch }} cfg={rankedCfg} showProgress />
          </div>
        )}
      </div>

      <section className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-widest">Share your result</h3>
          <Button variant="outline" size="sm" onClick={() => setSeed((v) => v + 1)}><Sparkles /> New look</Button>
        </div>
        <div className="overflow-hidden rounded-3xl border">
          <canvas ref={canvasRef} width={1200} height={1500} className="block h-auto w-full" aria-label="Battle result card" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="hero" onClick={shareResult}>Share</Button>
          <Button variant="glass" onClick={downloadCard}>Download</Button>
          <Button variant="outline" onClick={copyResult}><Copy /> Copy</Button>
        </div>
      </section>

      {m.mode === "duo" && (
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as Team[]).map((t) => {
            const other = teamScore(m, t === "A" ? "B" : "A");
            const mine = teamScore(m, t);
            return (
              <div key={t} className={cn("surface-card p-4 text-center", mine > other && "border-warning")}>
                <Shield className={cn("mx-auto size-5", TEAM_META[t].text)} />
                <div className={cn("text-xs font-bold", TEAM_META[t].text)}>{TEAM_META[t].name}</div>
                <div className="tabular text-2xl font-extrabold">{mine}</div>
                {mine > other && <Crown className="text-warning mx-auto mt-1 size-4" />}
              </div>
            );
          })}
        </div>
      )}

      <div className="surface-card divide-y">
        {order.slice(0, 50).map((id, i) => {
          const p = m.players[id];
          return (
            <div key={id} className={cn("flex items-center gap-3 p-3", id === uid && "bg-primary/8")}>
              <span className="tabular text-muted-foreground w-6 text-center text-sm font-bold">{i + 1}</span>
              <PlayerAvatar name={p.name} size={32} />
              <span className="flex-1 truncate text-sm font-semibold">{p.name}{id === uid && " (you)"}</span>
              {m.winnerIds.includes(id) && <Crown className="text-warning size-4" />}
              <span className="text-muted-foreground tabular text-xs">{p.correct}✓</span>
              <span className="tabular w-12 text-right text-sm font-bold">{p.score}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="outline" size="lg"><Link to="/home"><Home /> Home</Link></Button>
        <Button asChild variant="hero" size="lg"><Link to="/battle"><Swords /> Play again</Link></Button>
      </div>
    </div>
  );
}

function Reward({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return (
    <div className="bg-muted rounded-2xl p-3">
      <Icon className="text-primary mx-auto size-4" />
      <div className="tabular mt-1 font-extrabold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
