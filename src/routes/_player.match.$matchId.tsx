import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Check,
  Coins,
  Copy,
  Crown,
  Flag,
  KeyRound,
  Medal,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  Shield,
  Swords,
  UserPlus,
} from "lucide-react";
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
import { rankFor } from "@/lib/ranked";
import { ThreeAvatarCanvas } from "@/components/avatar/ThreeAvatarCanvas";
import { usePlayerAvatar } from "@/lib/avatar";
import {
  applyResults,
  rememberPendingSettle,
  type MatchRewards,
  forfeit,
  hostStart,
  leaveLobby,
  loadQuestions,
  roomCode,
  submitAnswer,
  tick,
  type Question,
} from "@/lib/engine";
import {
  RUSH_MAX_WRONG,
  alivePlayers,
  questionMs,
  resultFor,
  teamOf,
  type Match,
  type MatchPlayer,
  type Team,
} from "@/lib/game-rules";
import { play } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import {
  buildBattleCardData,
  buildCardSummaryText,
  getBattleCardFileName,
  renderBattleCardPreview,
} from "@/lib/shareable-battle-card";

export const Route = createFileRoute("/_player/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Battle • Juvora" },
      {
        name: "description",
        content: "Compete live in head-to-head quiz battles, Duo team clashes, and high-stakes Rush mode on Juvora.",
      },
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
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();

  const [m, setMatch] = useState<Match | null>(null);
  const [qs, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Firestore listener
  useEffect(() => {
    if (!fb) return;
    const ref = doc(fb.db, "matches", matchId);
    const unsub = onSnapshot(ref, (snap) => {
      setLoading(false);
      if (!snap.exists()) {
        setMatch(null);
        return;
      }
      setMatch({ id: snap.id, ...(snap.data() as Omit<Match, "id">) });
    });
    return () => unsub();
  }, [fb, matchId]);

  // Load questions once match is available
  useEffect(() => {
    if (!fb || !m || qs.length > 0) return;
    loadQuestions(fb.db, m.questionIds).then(setQuestions);
  }, [fb, m, qs.length]);

  // Clock tick every 250ms for smooth client-side timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Drive phase transitions via engine tick
  useEffect(() => {
    if (!fb || !m) return;
    tick(fb.db, m, now);
  }, [fb, m, now]);

  if (loading) return <FullLoader text="Entering match room…" />;
  if (!m || !user) {
    return (
      <div className="surface-card mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">Match not found</h1>
        <p className="text-muted-foreground text-sm">This match has either concluded or does not exist.</p>
        <Button onClick={() => navigate({ to: "/battle" })}>Back to Arena</Button>
      </div>
    );
  }

  const inMatch = m.playerIds.includes(user.uid);
  if (!inMatch) {
    return (
      <div className="surface-card mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">You are not in this match</h1>
        <p className="text-muted-foreground text-sm">You need an invite code to join this room.</p>
        <Button onClick={() => navigate({ to: "/battle" })}>Back to Arena</Button>
      </div>
    );
  }

  const onLeave = () => {
    if (!fb) return;
    leaveLobby(fb.db, m.id, user.uid);
    navigate({ to: "/battle" });
  };

  const screen =
    m.status === "waiting" ? (
      m.mode === "duo" ? (
        <DuoLobby db={fb.db} m={m} uid={user.uid} onLeave={onLeave} />
      ) : (
        <Lobby m={m} uid={user.uid} now={now} onLeave={onLeave} />
      )
    ) : m.status === "countdown" ? (
      <Countdown m={m} uid={user.uid} now={now} />
    ) : m.status === "completed" ? (
      <Results m={m} uid={user.uid} />
    ) : (
      <Live m={m} uid={user.uid} now={now} qs={qs} />
    );

  const voice = voiceAvailable(m.mode, m.status) && true;
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

/* ---------------- 3D Lobby Player Card ---------------- */
function LobbyAvatarCard({
  id,
  player,
  isHost,
  isMe,
  compact = false,
}: {
  id: string;
  player: MatchPlayer;
  isHost: boolean;
  isMe: boolean;
  compact?: boolean;
}) {
  const { fb } = useApp();
  const avatar = usePlayerAvatar(fb?.db, id);

  return (
    <div className="surface-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-primary/20 bg-card/60 p-3 text-center transition-all hover:border-primary/50 shadow-lg">
      <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-primary/15 via-background/40 to-black/60">
        <ThreeAvatarCanvas
          customization={avatar}
          interactive={true}
          showControls={false}
          height={compact ? 160 : 230}
          spinSpeed={0.005}
          className="w-full"
        />

        {/* Status tags */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none">
          {isHost && (
            <span className="bg-amber-500/90 text-black font-black flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm">
              <Crown className="size-3 fill-black text-black" /> Host
            </span>
          )}
          {isMe && (
            <span className="bg-primary/90 text-primary-foreground font-black rounded-md px-2 py-0.5 text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm">
              You
            </span>
          )}
        </div>

        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-md pointer-events-none">
          Drag to spin
        </div>
      </div>

      <div className="mt-3 w-full min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <PlayerAvatar name={player.name} size={22} />
          <span className="truncate text-sm font-extrabold">{player.name}</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-400">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Ready for battle
        </div>
      </div>
    </div>
  );
}

/* ---------------- Lobby (1v1 Classic & Rush 50) ---------------- */
function Lobby({ m, uid, now, onLeave }: { m: Match; uid: string; now: number; onLeave: () => void }) {
  const { fb } = useApp();
  const isHost = m.hostId === uid;
  const left = Math.max(0, Math.ceil((m.lobbyEndsAt - now) / 1000));
  const canStart = isHost && m.playerIds.length >= 2;
  const is1v1 = m.mode === "classic" || m.mode === "ranked";

  // Auto-generate room code if opened without one
  useEffect(() => {
    if (fb && isHost && !m.code && m.status === "waiting") {
      const code = roomCode();
      updateDoc(doc(fb.db, "matches", m.id), { code, lobbyKey: `code_${code}` }).catch(() => {});
    }
  }, [fb, isHost, m.code, m.status, m.id]);

  const start = () => {
    if (fb) hostStart(fb.db, m.id, uid);
  };

  const copyCode = async () => {
    if (!m.code) return;
    try {
      await navigator.clipboard.writeText(m.code);
      toast.success("Room invite code copied!");
    } catch {
      toast.error("Could not copy automatically. Select the code to copy.");
    }
  };

  const shareCode = async () => {
    if (!m.code) return;
    const modeName = m.mode === "rush" ? "Rush 50" : "1v1 Duel";
    const text = `Join my ${modeName} battle on Juvora with invite code: ${m.code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Juvora Battle Invite", text });
        return;
      } catch {}
    }
    copyCode();
  };

  return (
    <div className="surface-card mx-auto max-w-3xl space-y-6 p-4 sm:p-6 text-center">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
          <Sparkles className="size-3.5" /> {m.mode === "rush" ? "Rush 50 Arena Lobby" : "1v1 Duel Waiting Room"}
        </div>
        <h1 className="text-2xl font-black sm:text-3xl tracking-tight">Waiting for challengers</h1>
        {m.mode === "rush" ? (
          <p className="text-muted-foreground text-sm">
            Match starts automatically in <span className="text-foreground font-bold">{left}s</span>, or when {m.maxPlayers} players join.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {m.playerIds.length >= 2 ? "Both duelists are ready! Host may initiate combat." : "Awaiting an opponent to enter the arena."}
          </p>
        )}
      </div>

      {/* Invite Code Card */}
      {m.code && (
        <div className="surface-card rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
            <KeyRound className="size-3.5 text-primary" /> Room Invite Code
          </div>
          <div className="font-mono text-3xl sm:text-4xl font-black tracking-[0.25em] text-primary select-all">
            {m.code}
          </div>
          <p className="text-xs text-muted-foreground">
            Share this invite code so opponents can join your match directly from the Battle arena.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={copyCode}>
              <Copy className="mr-1.5 size-3.5" /> Copy Code
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={shareCode}>
              <Share2 className="mr-1.5 size-3.5" /> Share Invite
            </Button>
          </div>
        </div>
      )}

      {/* 3D Battle Arena View */}
      {is1v1 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch relative">
          {/* Player 1 (Host or Current Player) */}
          {m.playerIds[0] ? (
            <LobbyAvatarCard
              id={m.playerIds[0]}
              player={m.players[m.playerIds[0]]}
              isHost={m.playerIds[0] === m.hostId}
              isMe={m.playerIds[0] === uid}
            />
          ) : null}

          {/* Player 2 (Challenger or Waiting Pod) */}
          {m.playerIds[1] ? (
            <LobbyAvatarCard
              id={m.playerIds[1]}
              player={m.players[m.playerIds[1]]}
              isHost={m.playerIds[1] === m.hostId}
              isMe={m.playerIds[1] === uid}
            />
          ) : (
            <div className="surface-card flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-center min-h-[300px]">
              <div className="relative mb-4">
                <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-primary opacity-20" />
                <div className="relative grid size-16 place-items-center rounded-full bg-primary/10 text-primary border border-primary/30">
                  <UserPlus className="size-7" />
                </div>
              </div>
              <h3 className="font-extrabold text-base">Awaiting Opponent</h3>
              <p className="text-muted-foreground text-xs max-w-xs mt-1 mb-4">
                Share your invite code above or wait for public matchmaking to pair an opponent.
              </p>
              <Button variant="outline" size="sm" onClick={shareCode}>
                <Share2 className="size-3.5 mr-1.5" /> Invite Friend
              </Button>
            </div>
          )}

          {/* VS Badge in Middle */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-12 items-center justify-center rounded-full bg-background border-2 border-primary shadow-xl font-black italic text-primary z-10">
            VS
          </div>
        </div>
      ) : (
        /* Rush 50 3D Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {m.playerIds.map((id) => {
            const p = m.players[id];
            return (
              <LobbyAvatarCard
                key={id}
                id={id}
                player={p}
                isHost={id === m.hostId}
                isMe={id === uid}
                compact={true}
              />
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
        {canStart && (
          <Button size="lg" className="w-full sm:w-auto font-bold" onClick={start}>
            <Swords className="size-4 mr-2" /> Start battle ({m.playerIds.length} ready)
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
  useEffect(() => {
    play("tick");
  }, [left]);
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

/* ---------------- Streak Calculation ---------------- */
function computeLiveStreak(answers?: Record<string, { correct?: boolean }>, currentIndex = 0): number {
  if (!answers) return 0;
  let s = 0;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (answers[String(i)]?.correct) {
      s++;
    } else {
      break;
    }
  }
  return s;
}

/* ---------------- Live Battle ---------------- */
function Live({ m, uid, now, qs }: { m: Match; uid: string; now: number; qs: Question[] }) {
  const { fb, settings, updateSettings } = useApp();
  const q = qs[m.currentIndex];
  const p = m.players[uid];
  const myAnswer = p?.answers?.[String(m.currentIndex)];
  const ms = questionMs(m.mode, m.secondsPerQuestion);
  const remaining = m.phase === "question" ? Math.max(0, m.deadline - now) : Math.max(0, m.revealEndsAt - now);
  const progress = m.phase === "question" ? (remaining / ms) * 100 : 0;
  const isDuo = m.mode === "duo";

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIdx(null);
  }, [m.currentIndex]);

  const hasChosen = selectedIdx !== null || Boolean(myAnswer);
  const effectiveChoice = selectedIdx !== null ? selectedIdx : myAnswer?.choice;

  const onChoose = async (idx: number) => {
    if (!fb || !q || m.phase !== "question" || hasChosen) return;
    try {
      play("click");
      setSelectedIdx(idx);
      await submitAnswer(fb.db, m.id, uid, m.currentIndex, idx, q.answer, now, m.secondsPerQuestion);
    } catch {
      setSelectedIdx(null);
    }
  };

  const onForfeit = () => {
    if (!fb) return;
    if (confirm("Are you sure you want to forfeit this battle?")) {
      forfeit(fb.db, m.id, uid);
    }
  };

  if (!q) return <FullLoader text="Loading battle questions…" />;

  const isRevealing = m.phase === "reveal";
  const isCorrect = effectiveChoice === q.answer;
  const streakVal = computeLiveStreak(p?.answers, m.currentIndex);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* HUD Top Bar */}
      <div className="surface-card flex items-center justify-between gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="font-display text-primary text-xl font-black">
            Q{m.currentIndex + 1}
            <span className="text-muted-foreground text-xs font-semibold">/{m.totalQuestions}</span>
          </div>
          {/* Subject & Topic Badges */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            {q.course && (
              <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                {q.course}
              </span>
            )}
            {q.topic && (
              <span className="bg-muted text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-full truncate max-w-[140px]">
                {q.topic}
              </span>
            )}
          </div>
          {streakVal >= 2 && (
            <span className="animate-pop inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-500">
              🔥 {streakVal} Streak
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="tabular text-lg font-black">{p?.score ?? 0}</div>
            <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Score</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => updateSettings({ soundEffectsEnabled: !settings.soundEffectsEnabled })}
          >
            {settings.soundEffectsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive size-8" onClick={onForfeit}>
            <Flag className="size-4" />
          </Button>
        </div>
      </div>

      {/* Timer Bar */}
      <Progress value={progress} className="h-2 w-full transition-all duration-200" />

      {/* Question Card */}
      <div className="surface-card p-6 sm:p-8 text-center space-y-4">
        <div className="flex sm:hidden justify-center gap-1.5 pb-1">
          {q.course && (
            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
              {q.course}
            </span>
          )}
          {q.topic && (
            <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-[140px]">
              {q.topic}
            </span>
          )}
        </div>
        <h2 className="text-lg sm:text-2xl font-bold leading-relaxed">{q.text}</h2>
      </div>

      {/* Answer Options */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.options.map((opt, idx) => {
          const isSelected = effectiveChoice === idx;
          const isAnswerCorrect = isRevealing && idx === q.answer;
          const isWrongPick = isRevealing && isSelected && !isCorrect;

          let btnClass = "border border-border/80 hover:border-primary/50 bg-card hover:bg-card/80 text-foreground";
          if (isAnswerCorrect) {
            btnClass = "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold";
          } else if (isWrongPick) {
            btnClass = "border-destructive bg-destructive/20 text-destructive font-bold";
          } else if (isSelected) {
            btnClass = "border-primary bg-primary/20 text-primary font-bold shadow-md shadow-primary/20";
          }

          return (
            <button
              key={idx}
              disabled={hasChosen || isRevealing}
              onClick={() => onChoose(idx)}
              className={cn(
                "group relative flex items-center justify-between p-4 rounded-xl text-left transition-all duration-150 active:scale-[0.98]",
                btnClass
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-background/60 text-xs font-bold uppercase">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm font-semibold">{opt}</span>
              </div>
              {isSelected && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">
                  {isRevealing ? (isCorrect ? "Correct" : "Wrong") : "Locked"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Live Standings Panel */}
      <LiveStandings m={m} uid={uid} isDuo={isDuo} />
    </div>
  );
}

function LiveStandings({ m, uid, isDuo }: { m: Match; uid: string; isDuo: boolean }) {
  if (isDuo) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as Team[]).map((t) => {
          const meta = TEAM_META[t];
          const members = teamOf(m, t);
          const score = members.reduce((s, id) => s + (m.players[id]?.score ?? 0), 0);
          return (
            <div key={t} className={cn("surface-card p-3 rounded-xl border", meta.soft, meta.border)}>
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-black uppercase", meta.text)}>{meta.name}</span>
                <span className="tabular text-lg font-black">{score}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {members.map((id) => (
                  <div key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PlayerAvatar name={m.players[id]?.name ?? "Player"} size={18} />
                    <span className="max-w-[70px] truncate">{m.players[id]?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const ids = alivePlayers(m);

  return (
    <div className="surface-card flex items-center justify-around p-3 rounded-xl">
      {ids.slice(0, 4).map((id) => {
        const p = m.players[id];
        const me = id === uid;
        return (
          <div key={id} className={cn("flex items-center gap-2 text-xs", me && "text-primary font-bold")}>
            <PlayerAvatar name={p?.name ?? "Player"} size={22} />
            <span className="truncate max-w-[80px]">{p?.name}</span>
            <span className="tabular font-black">{p?.score ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Post-Battle Results ---------------- */
function Results({ m, uid }: { m: Match; uid: string }) {
  const { fb, profile } = useApp();
  const rankedCfg = useRankedConfig(fb?.db);
  const isClanWar = Boolean(m.clanWar);
  const [rewards, setRewards] = useState<MatchRewards | null>(null);
  const [clanWarResult, setClanWarResult] = useState<ClanWarSettleResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!fb || applied) return;
    setApplied(true);

    if (isClanWar) {
      settleClanWarMatch(fb.db, m, uid)
        .then((res) => {
          if (res) setClanWarResult(res);
        })
        .catch(console.error);
      return;
    }

    applyResults(fb.db, m, uid, profile?.rankedSeason ?? rankedCfg.seasonName, rankedCfg).then((rew) => {
      if (rew) {
        setRewards(rew);
        rememberPendingSettle(m.id);
      }
    });

    if (m.tournamentId && m.tournamentFixtureId) {
      const p = m.players[uid];
      const otherId = m.playerIds.find((id) => id !== uid);
      const otherScore = otherId ? m.players[otherId]?.score ?? 0 : 0;
      const winnerId = (p?.score ?? 0) > otherScore ? uid : otherId ?? uid;
      applyFixtureResult(fb.db, m.tournamentId, m.tournamentFixtureId, winnerId).then(() => {
        if (fb) maybeAdvance(fb.db, m.tournamentId!);
      });
    }
  }, [fb, m, uid, applied, isClanWar, profile?.rankedSeason, rankedCfg]);

  const p = m.players[uid];
  const outcome = resultFor(m, uid);
  const isWin = outcome === "win";
  const isDraw = outcome === "draw";

  const effectiveRp = rewards?.rpAfter ?? (profile?.rp || 0);
  const rankInfo = rankFor(effectiveRp, rankedCfg);
  const rpChange = rewards?.rpDelta ?? 0;

  const handleShareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const otherId = m.playerIds.find((id) => id !== uid);
      const cardData = buildBattleCardData(
        m,
        uid,
        p?.name ?? "Player",
        profile?.rp ?? 0,
        otherId ? m.players[otherId]?.name : undefined,
        otherId ? m.players[otherId]?.score : undefined
      );

      const blob = await renderBattleCardPreview(cardData);
      const fileName = getBattleCardFileName(cardData);
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "My Juvora Battle Result",
          text: buildCardSummaryText(cardData),
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Battle Card saved to downloads!");
      }
    } catch {
      toast.error("Failed to share Battle Card.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="surface-card mx-auto max-w-lg space-y-6 p-6 text-center">
      <div className="space-y-2">
        <span className="text-4xl">{isWin ? "🏆" : isDraw ? "🤝" : "💥"}</span>
        <h1 className="text-3xl font-black uppercase tracking-tight">
          {isWin ? "Victory!" : isDraw ? "Match Tied" : "Defeat"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isWin ? "Outstanding combat performance!" : isDraw ? "Evenly matched warriors." : "Keep training, challenger."}
        </p>
      </div>

      {/* Rewards Card */}
      <div className="surface-card flex items-center justify-around p-4 rounded-xl border border-primary/20">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-semibold uppercase">Battle Score</div>
          <div className="tabular text-2xl font-black">{p?.score ?? 0} pts</div>
        </div>
        <div className="h-8 w-px bg-border/60" />
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-semibold uppercase">Coins Earned</div>
          <div className="tabular text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
            <Coins className="size-5" /> +{rewards?.coins ?? 0}
          </div>
        </div>
      </div>

      {/* Ranked RP Breakdown */}
      <div className="surface-card space-y-3 p-4 rounded-xl border border-primary/20 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RankBadge tier={rankInfo.tier} division={rankInfo.division} size={28} />
            <div>
              <div className="text-sm font-bold">{rankInfo.name}</div>
              <div className="text-muted-foreground text-xs">{effectiveRp} Total RP</div>
            </div>
          </div>
          <div
            className={cn(
              "px-3 py-1 rounded-full text-xs font-black",
              rpChange > 0 ? "bg-emerald-500/20 text-emerald-400" : rpChange < 0 ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
            )}
          >
            {rpChange > 0 ? `+${rpChange} RP` : `${rpChange} RP`}
          </div>
        </div>
      </div>

      {/* Standings List */}
      <div className="surface-card divide-y divide-border/60 rounded-xl overflow-hidden text-left">
        {m.playerIds
          .slice()
          .sort((a, b) => (m.players[b]?.score ?? 0) - (m.players[a]?.score ?? 0))
          .map((id, rank) => {
            const pl = m.players[id];
            const isMe = id === uid;
            return (
              <div key={id} className={cn("flex items-center justify-between p-3", isMe && "bg-primary/5 font-bold")}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground w-4 text-xs font-semibold">{rank + 1}</span>
                  <PlayerAvatar name={pl.name} size={32} />
                  <span className="truncate text-sm font-semibold">{pl.name}</span>
                </div>
                <div className="tabular font-black">{pl.score} pts</div>
              </div>
            );
          })}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={handleShareCard} disabled={sharing}>
          <Share2 className="mr-2 size-4" /> {sharing ? "Generating card…" : "Share Battle Card"}
        </Button>
        <Link to="/battle">
          <Button size="lg" className="w-full sm:w-auto font-bold">
            Back to Arena
          </Button>
        </Link>
      </div>
    </div>
  );
}
