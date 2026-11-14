import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Check, Coins, Flag, Medal, Sparkles, TrendingUp, Trophy, Volume2, VolumeX, Shield, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayerAvatar } from "@/components/game/Avatar";
import { FullLoader } from "@/components/game/ui";
import { VoiceChat } from "@/components/game/VoiceChat";
import { DuoLobby, TEAM_META } from "@/components/game/DuoLobby";
import { useApp } from "@/lib/app-context";
import { settleClanWarMatch, type ClanWarSettleResult } from "@/lib/clan-war";
import { applyFixtureResult, maybeAdvance } from "@/lib/tournament-engine";
import { RankBadge } from "@/components/game/RankBadge";
import { useRankedConfig } from "@/lib/ranked-store";
import { applyResults, rememberPendingSettle, type MatchRewards, forfeit, hostStart, leaveLobby, loadQuestions, submitAnswer, tick, type Question } from "@/lib/engine";
import { RUSH_MAX_WRONG, alivePlayers, questionMs, resultFor, standings, teamOf, teamScore, type Match, type Team } from "@/lib/game-rules";
import { play, setSfxGloballyEnabled } from "@/lib/sfx";
import { buildBattleCardData, buildCardSummaryText, getBattleCardFileName, renderBattleCardPreview } from "@/lib/battle-card";
import { cn } from "@/lib/utils";
import { useClanMembership } from "@/lib/clans-store";

export const Route = createFileRoute("/_player/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Battle • Juvora" },
      { name: "description", content: "Compete live in head-to-head quiz battles, Duo team clashes, and high-stakes Rush mode on Juvora." },
      { property: "og:title", content: "Live Battle • Juvora" },
      { property: "og:description", content: "Compete live in head-to-head quiz battles on Juvora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchScreen,
});

function MatchScreen() {
  const { matchId } = Route.useParams();
  const { fb, user, settings } = useApp();
  const navigate = useNavigate();
  const [m, setM] = useState<Match | null>(null);
  const [missing, setMissing] = useState(false);
  const [qs, setQs] = useState<Question[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fb) return;
    const unsub = onSnapshot(doc(fb.db, "matches", matchId), (s) => {
      if (!s.exists()) { setMissing(true); return; }
      setM({ id: s.id, ...(s.data() as Omit<Match, "id">) });
    });
    return () => unsub();
  }, [fb, matchId]);

  useEffect(() => {
    if (!fb || !m?.questionIds?.length || qs.length === m.questionIds.length) return;
    loadQuestions(fb.db, m.questionIds).then(setQs).catch(() => {});
  }, [fb, m?.questionIds, qs.length]);

  useEffect(() => {
    if (!fb || !m || !user) return;
    if (m.status !== "waiting" && m.status !== "completed") tick(fb.db, m.id, m);
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

function voiceAvailable(mode: Match["mode"], status: Match["status"]) {
  if (status !== "waiting" && status !== "countdown" && status !== "active") return false;
  return mode === "classic" || mode === "duo";
}

/* ---------------- Lobby ---------------- */
function Lobby({ m, uid, now, onLeave }: { m: Match; uid: string; now: number; onLeave: () => void }) {
  const { fb } = useApp();
  const isHost = m.hostId === uid;
  const left = Math.max(0, Math.ceil((m.lobbyEndsAt - now) / 1000));
  const canStart = isHost && m.playerIds.length >= 2;

  const start = () => { if (fb) hostStart(fb.db, m.id, uid); };

  return (
    <div className="surface-card mx-auto max-w-lg space-y-6 p-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5" /> {m.mode === "rush" ? "Rush lobby" : "Battle lobby"}
      </div>
      <h1 className="text-2xl font-black sm:text-3xl">Waiting for challengers</h1>
      {m.mode === "rush" && (
        <p className="text-muted-foreground text-sm">
          Match starts automatically in <span className="text-foreground font-bold">{left}s</span>, or when {m.maxPlayers} players join.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {m.playerIds.map((id) => {
          const p = m.players[id];
          return (
            <div key={id} className="surface-card flex flex-col items-center gap-2 p-3">
              <PlayerAvatar name={p.name} size={48} />
              <span className="w-full truncate text-xs font-semibold">{p.name}</span>
              {id === m.hostId && <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold">HOST</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {canStart && (
          <Button size="lg" className="w-full sm:w-auto" onClick={start}>
            Start battle ({m.playerIds.length} ready)
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={onLeave}>
          Leave lobby
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Countdown ---------------- */
function Countdown({ m, now }: { m: Match; now: number; uid: string }) {
  const left = Math.max(0, Math.ceil((m.countdownEndsAt - now) / 1000));
  useEffect(() => { play("tick"); }, [left]);
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Get ready</span>
      <div className="text-primary font-black tracking-tight" style={{ fontSize: "6rem", lineHeight: 1 }}>
        {left || "GO!"}
      </div>
      <p className="text-muted-foreground text-sm">First question is loading…</p>
    </div>
  );
}

/* ---------------- Live ---------------- */
function Live({ m, uid, now, qs }: { m: Match; uid: string; now: number; qs: Question[] }) {
  const { fb, settings, updateSettings } = useApp();
  const q = qs[m.currentIndex];
  const p = m.players[uid];
  const myAnswer = p?.answers?.[String(m.currentIndex)];
  const ms = questionMs(m.mode, m.secondsPerQuestion);
  const remaining = m.phase === "question" ? Math.max(0, m.deadline - now) : Math.max(0, m.revealEndsAt - now);
  const progress = m.phase === "question" ? (remaining / ms) * 100 : 0;
  const isDuo = m.mode === "duo";

  const onChoose = async (idx: number) => {
    if (!fb || !q || m.phase !== "question" || myAnswer) return;
    try {
      play("click");
      await submitAnswer(fb.db, m.id, uid, q, idx);
    } catch {
      /* deadline race */
    }
  };

  const onForfeit = async () => {
    if (!fb) return;
    if (confirm("Forfeit this battle? You'll receive a loss.")) {
      await forfeit(fb.db, m.id, uid);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header bar */}
      <div className="surface-card flex items-center justify-between p-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-primary text-xs font-bold uppercase tracking-wider">
            Q{m.currentIndex + 1} of {m.questionIds.length}
          </span>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs font-semibold capitalize">{m.mode}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              const next = !settings.sfxEnabled;
              setSfxGloballyEnabled(next);
              updateSettings({ sfxEnabled: next });
            }}
            title={settings.sfxEnabled ? "Mute sound" : "Unmute sound"}
          >
            {settings.sfxEnabled ? <Volume2 className="size-4" /> : <VolumeX className="text-muted-foreground size-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive h-8 text-xs font-semibold" onClick={onForfeit}>
            <Flag className="mr-1 size-3.5" /> Forfeit
          </Button>
        </div>
      </div>

      {/* Timer line */}
      <Progress value={progress} className="h-1.5" />

      {/* Duo team header */}
      {isDuo && <DuoTeamScoreboard m={m} uid={uid} />}

      {/* Scoreboard strip */}
      {!isDuo && <ScoreStrip m={m} uid={uid} />}

      {/* Question card */}
      <div className="surface-card space-y-5 p-5 sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            {q?.course ?? "General"}
          </span>
          <span className="tabular text-primary text-xs font-extrabold">
            {Math.ceil(remaining / 1000)}s
          </span>
        </div>
        <h2 className="text-lg font-bold leading-snug sm:text-2xl">{q?.text ?? "Loading question…"}</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {q?.options.map((opt, i) => {
            const picked = myAnswer?.choice === i;
            const reveal = m.phase === "reveal";
            const isCorrect = reveal && q.correctIndex === i;
            const isWrong = reveal && picked && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                disabled={Boolean(myAnswer) || m.phase !== "question"}
                onClick={() => onChoose(i)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 text-left font-semibold transition-all select-none",
                  !picked && !reveal && "border-border/60 hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]",
                  picked && !reveal && "border-primary bg-primary/10 text-primary shadow-sm",
                  isCorrect && "border-success bg-success/15 text-success",
                  isWrong && "border-destructive bg-destructive/15 text-destructive",
                  m.phase === "question" && !myAnswer && "cursor-pointer"
                )}
              >
                <span className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black",
                  picked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 text-sm sm:text-base">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreStrip({ m, uid }: { m: Match; uid: string }) {
  const ids = m.playerIds;
  return (
    <div className="surface-card flex items-center justify-around gap-2 p-3">
      {ids.map((id) => {
        const p = m.players[id];
        const isMe = id === uid;
        const ans = p.answers?.[String(m.currentIndex)];
        return (
          <div key={id} className={cn("flex flex-1 items-center gap-2 rounded-xl p-1.5 px-2.5", isMe && "bg-primary/10")}>
            <PlayerAvatar name={p.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{isMe ? "You" : p.name}</div>
              <div className="text-muted-foreground text-[11px]">
                {m.mode === "rush" ? (
                  <span className="text-destructive font-semibold">
                    {"✕".repeat(p.wrong)}
                    <span className="opacity-30">{"✕".repeat(Math.max(0, RUSH_MAX_WRONG - p.wrong))}</span>
                  </span>
                ) : (
                  <span className="tabular font-extrabold text-foreground">{p.score} pts</span>
                )}
              </div>
            </div>
            {ans && (
              <span className={cn("size-2 rounded-full", m.phase === "reveal" ? (ans.correct ? "bg-success" : "bg-destructive") : "bg-primary")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DuoTeamScoreboard({ m, uid }: { m: Match; uid: string }) {
  const myTeam = teamOf(m, uid);
  const scoreA = teamScore(m, "A");
  const scoreB = teamScore(m, "B");
  return (
    <div className="surface-card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as Team[]).map((t) => {
          const meta = TEAM_META[t];
          const isMine = t === myTeam;
          const score = t === "A" ? scoreA : scoreB;
          return (
            <div key={t} className={cn("relative overflow-hidden rounded-2xl border p-3", isMine ? "border-primary/60 bg-primary/5" : "border-border/60 bg-muted/40")}>
              <div className="flex items-center justify-between">
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-black", meta.badge)}>
                  {meta.name}
                </span>
                {isMine && <span className="text-primary text-[10px] font-extrabold uppercase tracking-wider">Your team</span>}
              </div>
              <div className="tabular text-2xl font-black mt-2">{score} pts</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {m.playerIds.map((id) => {
          const p = m.players[id];
          const ans = p.answers?.[String(m.currentIndex)];
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
  const { membership } = useClanMembership(fb?.db, uid);
  const rankedCfg = useRankedConfig(fb?.db);
  const [reward, setReward] = useState<MatchRewards | null>(null);
  const [clanWarSettle, setClanWarSettle] = useState<ClanWarSettleResult | null>(null);
  const applied = useRef(false);

  const clanWarId = (m as Match & { clanWarId?: string }).clanWarId;
  const isClanWar = Boolean(clanWarId);

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
    if (clanWarId) {
      settleClanWarMatch(fb.db, clanWarId, m)
        .then((res) => { if (res) setClanWarSettle(res); })
        .catch(() => {});
    }
  }, [fb, m.id, uid, clanWarId]);

  const result = resultFor(m, uid);
  useEffect(() => { play(result === "win" ? "win" : result === "draw" ? "draw" : "lose"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => standings(m), [m]);
  const place = order.indexOf(uid) + 1;
  const title = isClanWar
    ? (result === "win" ? "Clan War Victory!" : result === "draw" ? "Honorable Draw!" : "Clan War Defeat")
    : (result === "win" ? "Victory!" : result === "draw" ? "Draw" : "Defeat");
  const Icon = result === "win" ? Trophy : result === "draw" ? Medal : Flag;
  const [seed, setSeed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const card = useMemo(() => buildBattleCardData(m, uid, seed), [m, uid, seed]);
  const summary = useMemo(() => buildCardSummaryText(card), [card]);
  useEffect(() => {
    if (canvasRef.current) renderBattleCardPreview(canvasRef.current, card);
  }, [card]);

  // Determine user's clan delta accurately by checking participants roster and membership
  const isChallengerClan = useMemo(() => {
    if (!clanWarSettle) return true;
    if (clanWarSettle.challengerUids?.includes(uid)) return true;
    if (clanWarSettle.targetUids?.includes(uid)) return false;
    if (clanWarSettle.p1Uid === uid) return true;
    if (clanWarSettle.p2Uid === uid) return false;
    if (membership?.clanId) {
      return clanWarSettle.challengerClanId === membership.clanId;
    }
    return true;
  }, [clanWarSettle, uid, membership?.clanId]);

  const myClanCpDelta = clanWarSettle
    ? (isChallengerClan ? clanWarSettle.cpDeltaA : clanWarSettle.cpDeltaB)
    : (result === "win" ? 25 : result === "draw" ? 10 : 0);
  const myClanXpDelta = clanWarSettle
    ? (isChallengerClan ? clanWarSettle.xpDeltaA : clanWarSettle.xpDeltaB)
    : (result === "win" ? 100 : result === "draw" ? 50 : 25);
  const myClanTotalCp = clanWarSettle
    ? (isChallengerClan ? clanWarSettle.newCpA : clanWarSettle.newCpB)
    : null;
  const myClanTag = clanWarSettle
    ? (isChallengerClan ? clanWarSettle.challengerClanTag : clanWarSettle.targetClanTag)
    : "";

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
          await navigator.share({ title: "Juvora Battle", text: summary, files: [file] });
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
        <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {isClanWar
            ? `Final Duel Score: ${m.players[uid]?.score ?? 0} pts`
            : m.mode === "rush" ? `You placed #${place} of ${m.playerIds.length}` : m.mode === "duo" ? `${TEAM_META.A.name} ${teamScore(m, "A")} – ${teamScore(m, "B")} ${TEAM_META.B.name}` : `Final score: ${m.players[uid]?.score ?? 0}`}
        </p>

        {/* Clan War points display */}
        {isClanWar ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Reward icon={Shield} label={myClanTag ? `[${myClanTag}] Points` : "Clan Points"} value={`+${myClanCpDelta} CP`} />
              <Reward icon={Sparkles} label="Clan XP" value={`+${myClanXpDelta} XP`} />
              <Reward icon={Trophy} label="Clan Total" value={myClanTotalCp !== null ? `${myClanTotalCp} CP` : "Updated"} />
            </div>

            {clanWarSettle && (
              <div className="bg-muted/80 rounded-2xl p-4 text-left border border-border/60">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Official Clan War Scoreboard
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className={cn("p-2.5 rounded-xl border flex flex-col justify-between", clanWarSettle.winnerClanId === clanWarSettle.challengerClanId ? "border-warning/50 bg-warning/10 ring-1 ring-warning/30" : "border-border/60 bg-card/60")}>
                    <div>
                      <div className="text-[11px] font-bold text-muted-foreground">[{clanWarSettle.challengerClanTag}]</div>
                      <div className="text-xs font-black truncate">{clanWarSettle.challengerClanName}</div>
                      <div className="text-2xl font-black mt-1 text-primary">{clanWarSettle.scoreA}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] font-bold">
                      <span className="text-primary">+{clanWarSettle.cpDeltaA} CP</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-warning">+{clanWarSettle.xpDeltaA} XP</span>
                    </div>
                  </div>
                  <div className={cn("p-2.5 rounded-xl border flex flex-col justify-between", clanWarSettle.winnerClanId === clanWarSettle.targetClanId ? "border-warning/50 bg-warning/10 ring-1 ring-warning/30" : "border-border/60 bg-card/60")}>
                    <div>
                      <div className="text-[11px] font-bold text-muted-foreground">[{clanWarSettle.targetClanTag}]</div>
                      <div className="text-xs font-black truncate">{clanWarSettle.targetClanName}</div>
                      <div className="text-2xl font-black mt-1 text-primary">{clanWarSettle.scoreB}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] font-bold">
                      <span className="text-primary">+{clanWarSettle.cpDeltaB} CP</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-warning">+{clanWarSettle.xpDeltaB} XP</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal individual battle rewards */
          reward && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Reward icon={Sparkles} label="XP" value={`+${reward.xpGained}`} />
              <Reward icon={Coins} label="Coins" value={`+${reward.coins}`} />
              {reward.ranked ? (
                <Reward icon={TrendingUp} label={reward.ranked.inPlacement ? "Placement" : "RP"} value={reward.ranked.inPlacement ? `${reward.ranked.patch.placementPlayed ?? 0}/${rankedCfg.placementMatches}` : `${reward.ranked.delta >= 0 ? "+" : ""}${reward.ranked.delta}`} />
              ) : (
                <Reward icon={TrendingUp} label="Rating" value={`${reward.delta >= 0 ? "+" : ""}${reward.delta}`} />
              )}
            </div>
          )
        )}

        {!isClanWar && reward?.ranked && (
          <div className="bg-muted mt-3 rounded-2xl p-3 text-left">
            {reward.ranked.placementJustFinished && <div className="text-primary mb-1 text-sm font-extrabold">Placement complete — you start at {reward.ranked.rankAfter}!</div>}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Competitive Tier</span>
              <RankBadge rating={reward.ranked.ratingAfter} rp={reward.ranked.rpAfter} showRP />
            </div>
          </div>
        )}
      </div>

      {/* Shareable battle card preview */}
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Battle summary</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSeed((s) => s + 1)}>
            Change style
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-black/40">
          <canvas ref={canvasRef} className="aspect-[1200/630] w-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={downloadCard}>Download</Button>
          <Button variant="outline" size="sm" onClick={copyResult}>Copy text</Button>
          <Button size="sm" onClick={shareResult}>Share card</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {isClanWar ? (
          <>
            <Button asChild size="lg" className="flex-1 font-bold">
              <Link to="/clan-war/$challengeId" params={{ challengeId: clanWarId! }}>
                <Swords className="mr-2 size-4" /> War Room
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 font-bold">
              <Link to="/clans">
                <Shield className="mr-2 size-4" /> Clan HQ
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="lg" className="flex-1 font-bold">
              <Link to="/battle">Play again</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 font-bold">
              <Link to="/rankings">Rankings</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Reward({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  return (
    <div className="bg-muted rounded-2xl p-3 text-center">
      <Icon className="text-primary mx-auto size-5" />
      <div className="tabular text-lg font-black">{value}</div>
      <div className="text-muted-foreground text-[11px] font-semibold">{label}</div>
    </div>
  );
}
