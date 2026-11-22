import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Check,
  Coins,
  Copy,
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
  standings,
  teamOf,
  teamScore,
  type Match,
  type Team,
} from "@/lib/game-rules";
import { play, setSfxGloballyEnabled } from "@/lib/sfx";
import {
  buildBattleCardData,
  buildCardSummaryText,
  getBattleCardFileName,
  renderBattleCardPreview,
} from "@/lib/battle-card";
import { cn } from "@/lib/utils";
import { usePlayerClan } from "@/lib/clans-store";

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
      if (!s.exists()) {
        setMissing(true);
        return;
      }
      setM({ id: s.id, ...(s.data() as Omit<Match, "id">) });
    });
    return () => unsub();
  }, [fb, matchId]);

  useEffect(() => {
    if (!fb || !m?.questionIds?.length || qs.length === m.questionIds.length) return;
    loadQuestions(fb.db, m.questionIds)
      .then((dict) => {
        const list = m.questionIds.map((id) => dict[id]).filter(Boolean);
        setQs(list);
      })
      .catch(() => {});
  }, [fb, m?.questionIds, qs.length]);

  useEffect(() => {
    if (!fb || !m || !user) return;
    if (m.status !== "waiting" && m.status !== "completed") tick(fb.db, m.id, m);
  }, [fb, m, now, user]);

  if (missing) {
    return (
      <div className="p-10 text-center">
        This battle doesn't exist.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );
  }
  if (!m || !user || !fb) return <FullLoader label="Entering the arena" />;
  if (m.status === "cancelled") {
    return (
      <div className="p-10 text-center">
        This room was closed.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );
  }
  if (!m.playerIds.includes(user.uid)) {
    return (
      <div className="p-10 text-center">
        You're not part of this battle.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );
  }

  const onLeave = async () => {
    await leaveLobby(fb.db, m.id, user.uid);
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

/* ---------------- Lobby (1v1 & Rush 50) ---------------- */
function Lobby({ m, uid, now, onLeave }: { m: Match; uid: string; now: number; onLeave: () => void }) {
  const { fb } = useApp();
  const isHost = m.hostId === uid;
  const left = Math.max(0, Math.ceil((m.lobbyEndsAt - now) / 1000));
  const canStart = isHost && m.playerIds.length >= 2;

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
    const modeName = m.mode === "rush" ? "Rush 50" : "1v1";
    const text = `Join my ${modeName} battle on Juvora with invite code: ${m.code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Juvora Battle Invite", text });
        return;
      } catch {
        // Fallback to copy if share was dismissed or unsupported
      }
    }
    copyCode();
  };

  return (
    <div className="surface-card mx-auto max-w-lg space-y-6 p-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5" /> {m.mode === "rush" ? "Rush 50 lobby" : "Battle lobby"}
      </div>
      <h1 className="text-2xl font-black sm:text-3xl">Waiting for challengers</h1>
      {m.mode === "rush" && (
        <p className="text-muted-foreground text-sm">
          Match starts automatically in <span className="text-foreground font-bold">{left}s</span>, or when {m.maxPlayers} players join.
        </p>
      )}

      {/* Invite Code Card */}
      {m.code && (
        <div className="surface-card rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
            <KeyRound className="size-3.5 text-primary" /> Invite Code
          </div>
          <div className="font-mono text-3xl sm:text-4xl font-black tracking-[0.25em] text-primary select-all">
            {m.code}
          </div>
          <p className="text-xs text-muted-foreground">
            Share this code so friends can enter it in the Battle arena to join this waiting room.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {m.playerIds.map((id) => {
          const p = m.players[id];
          return (
            <div key={id} className="surface-card flex flex-col items-center gap-2 p-3">
              <PlayerAvatar name={p.name} size={48} />
              <span className="w-full truncate text-xs font-semibold">{p.name}</span>
              {id === m.hostId && (
                <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold">HOST</span>
              )}
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

  // Instant optimistic answer state
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Reset optimistic choice when moving to another question
  useEffect(() => {
    setSelectedIdx(null);
  }, [m.currentIndex]);

  const hasChosen = selectedIdx !== null || Boolean(myAnswer);
  const effectiveChoice = selectedIdx !== null ? selectedIdx : myAnswer?.choice;

  const onChoose = async (idx: number) => {
    if (!fb || !q || m.phase !== "question" || hasChosen) return;
    try {
      play("click");
      setSelectedIdx(idx); // Instant 0ms visual feedback
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

  const subjectName = q?.subject || q?.course || "General";
  const topicName = q?.topic?.trim();

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
          {/* Subject & Topic Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-primary/10 text-primary rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
              {subjectName}
            </span>
            {Boolean(topicName) && (
              <span className="bg-muted text-muted-foreground rounded-md px-2.5 py-0.5 text-xs font-medium">
                {topicName}
              </span>
            )}
          </div>
          <span className="tabular text-primary text-xs font-extrabold">
            {Math.ceil(remaining / 1000)}s
          </span>
        </div>
        <h2 className="text-lg font-bold leading-snug sm:text-2xl">{q?.text ?? "Loading question…"}</h2>

        <div className="grid gap-2.5">
          {q?.options.map((opt, idx) => {
            const isMine = effectiveChoice === idx;
            const isCorrect = m.phase === "reveal" && idx === q.correctIndex;
            const isWrongMine = m.phase === "reveal" && isMine && !myAnswer?.correct;

            let variant = "surface-card hover:border-primary/50";
            if (isMine && m.phase === "question") {
              variant = "border-primary bg-primary/15 ring-2 ring-primary/40 font-semibold shadow-sm";
            }
            if (isCorrect) variant = "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold";
            if (isWrongMine) variant = "border-destructive bg-destructive/15 text-destructive font-semibold";

            return (
              <button
                key={idx}
                disabled={m.phase !== "question" || hasChosen}
                onClick={() => onChoose(idx)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all active:scale-[0.99] disabled:cursor-default",
                  variant,
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                      isMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-sm font-medium sm:text-base">{opt}</span>
                </div>
                {isMine && m.phase === "question" && (
                  <span className="text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
                    Locked
                  </span>
                )}
                {isCorrect && <Check className="size-5 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreStrip({ m, uid }: { m: Match; uid: string }) {
  const isRush = m.mode === "rush";
  const ids = isRush ? alivePlayers(m) : m.playerIds;
  return (
    <div className="surface-card flex items-center justify-around gap-2 p-2">
      {ids.slice(0, 4).map((id) => {
        const p = m.players[id];
        const me = id === uid;
        return (
          <div key={id} className={cn("flex items-center gap-2 text-xs", me && "text-primary font-bold")}>
            <PlayerAvatar name={p.name} size={24} />
            <span className="max-w-[70px] truncate">{p.name}</span>
            <span className="tabular font-black">{p.score}</span>
            {isRush && <span className="text-destructive font-bold">{p.wrong}/{RUSH_MAX_WRONG}</span>}
          </div>
        );
      })}
      {ids.length > 4 && <span className="text-muted-foreground text-xs">+{ids.length - 4} more</span>}
    </div>
  );
}

function DuoTeamScoreboard({ m, uid }: { m: Match; uid: string }) {
  const me = m.players[uid];
  const myTeam = me?.team ?? "A";
  const aScore = teamScore(m, "A");
  const bScore = teamScore(m, "B");
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["A", "B"] as Team[]).map((t) => {
        const isMine = t === myTeam;
        const meta = TEAM_META[t];
        const score = t === "A" ? aScore : bScore;
        const members = teamOf(m, t);
        return (
          <div
            key={t}
            className={cn(
              "surface-card rounded-xl border p-3 transition-colors",
              isMine ? "border-primary/60 bg-primary/5" : "border-border/60",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                <span className="text-xs font-bold tracking-wide uppercase">{meta.name}</span>
                {isMine && <span className="text-primary text-[10px] font-semibold">(Your team)</span>}
              </div>
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

/* ---------------- Results Screen ---------------- */
function Results({ m, uid }: { m: Match; uid: string }) {
  const { fb, user, profile, reloadProfile } = useApp();
  const { config: rankedCfg } = useRankedConfig();
  const { membership } = usePlayerClan();
  const [reward, setReward] = useState<MatchRewards | null>(null);
  const [clanWarResult, setClanWarResult] = useState<ClanWarSettleResult | null>(null);
  const applied = useRef(false);
  const isClanWar = Boolean(m.clanWarId);

  useEffect(() => {
    if (!fb || !user || applied.current) return;
    applied.current = true;
    rememberPendingSettle(m.id);

    if (isClanWar && m.clanWarId) {
      settleClanWarMatch(fb.db, m.clanWarId, m.id)
        .then((res) => {
          setClanWarResult(res);
          reloadProfile();
        })
        .catch(() => {});
      return;
    }

    applyResults(fb.db, m.id, user.uid, m, rankedCfg)
      .then((r) => {
        setReward(r);
        reloadProfile();
      })
      .catch(() => {});
  }, [fb, user, m, rankedCfg, isClanWar, reloadProfile]);

  const p = m.players[uid];
  const myResult = resultFor(m, uid);
  const isChallengerClan = Boolean(
    clanWarResult &&
      (clanWarResult.challengerUids?.includes(uid) ||
        (clanWarResult.challengerClanId && membership?.clanId === clanWarResult.challengerClanId)),
  );
  const myClanOutcome = clanWarResult ? (isChallengerClan ? clanWarResult.challengerOutcome : clanWarResult.targetOutcome) : null;
  const myCpGain = clanWarResult ? (isChallengerClan ? clanWarResult.challengerCpGain : clanWarResult.targetCpGain) : 0;
  const myClanXpGain = clanWarResult ? (isChallengerClan ? clanWarResult.challengerXpGain : clanWarResult.targetXpGain) : 0;

  // Rank status & progression calculation
  const currentRp = reward?.ranked?.rpAfter ?? (profile?.rp || 0);
  const rankInfo = rankFor(currentRp, rankedCfg);
  const rankedOutcome = reward?.ranked;
  const isPromoted = rankedOutcome?.change === "promoted";
  const isDemoted = rankedOutcome?.change === "demoted";
  const isShielded = rankedOutcome?.shielded;
  const rpDelta = rankedOutcome?.delta ?? reward?.delta ?? 0;

  return (
    <div className="surface-card mx-auto max-w-lg space-y-6 p-6 text-center">
      {/* Header & Result Banner */}
      <div className="flex flex-col items-center gap-2">
        {isClanWar ? (
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Swords className="size-10" />
          </div>
        ) : (
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Trophy className="size-10" />
          </div>
        )}
        <h1 className="text-3xl font-black capitalize">
          {isClanWar
            ? myClanOutcome === "win"
              ? "Clan Victory!"
              : myClanOutcome === "draw"
                ? "War Draw"
                : "Clan Defeat"
            : `${myResult}!`}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isClanWar
            ? "Your clan duel is finished. Points and XP have been attributed."
            : m.mode === "rush"
              ? "Rush showdown concluded."
              : "Great duel. Here is your post-match breakdown."}
        </p>
      </div>

      {/* Rewards Strip */}
      {isClanWar ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-card flex flex-col items-center gap-1 p-3">
            <Shield className="size-5 text-primary" />
            <span className="text-xs text-muted-foreground font-semibold">Clan CP</span>
            <span className="text-lg font-black text-primary">+{myCpGain} CP</span>
          </div>
          <div className="surface-card flex flex-col items-center gap-1 p-3">
            <Sparkles className="size-5 text-amber-500" />
            <span className="text-xs text-muted-foreground font-semibold">Clan XP</span>
            <span className="text-lg font-black text-amber-500">+{myClanXpGain} XP</span>
          </div>
        </div>
      ) : (
        reward && (
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-card flex flex-col items-center gap-1 p-3">
              <Sparkles className="size-5 text-amber-500" />
              <span className="text-xs text-muted-foreground font-semibold">XP</span>
              <span className="text-lg font-black text-amber-500">+{reward.xpGained}</span>
            </div>
            <div className="surface-card flex flex-col items-center gap-1 p-3">
              <Coins className="size-5 text-yellow-500" />
              <span className="text-xs text-muted-foreground font-semibold">Coins</span>
              <span className="text-lg font-black text-yellow-500">+{reward.coins}</span>
            </div>
            <div className="surface-card flex flex-col items-center gap-1 p-3">
              <TrendingUp className="size-5 text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">RP Delta</span>
              <span className={cn("text-lg font-black", rpDelta >= 0 ? "text-emerald-400" : "text-destructive")}>
                {rpDelta >= 0 ? `+${rpDelta}` : rpDelta}
              </span>
            </div>
          </div>
        )
      )}

      {/* Ranked Tier & Progression Showcase */}
      {!isClanWar && (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-background p-5 text-left shadow-md">
          {/* Promotion Banner */}
          {isPromoted && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-400">
              <Trophy className="size-5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Promotion Achieved!</p>
                <p className="text-sm font-semibold">You advanced to {rankInfo.label}!</p>
              </div>
            </div>
          )}

          {/* Demotion Shield Alert */}
          {isShielded && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-400">
              <Shield className="size-5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Demotion Shield Active</p>
                <p className="text-sm font-semibold">Your rank was protected from falling.</p>
              </div>
            </div>
          )}

          {/* Demotion Notice */}
          {isDemoted && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <Shield className="size-5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Demoted</p>
                <p className="text-sm font-semibold">Demoted to {rankInfo.label}. Win the next duel to bounce back!</p>
              </div>
            </div>
          )}

          {/* Current Rank Badge & RP Info */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex size-12 items-center justify-center rounded-2xl border shadow-inner"
                style={{
                  backgroundColor: `${rankInfo.tier.color}15`,
                  borderColor: `${rankInfo.tier.color}40`,
                }}
              >
                <Shield className="size-7" style={{ color: rankInfo.tier.color, fill: rankInfo.tier.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight">{rankInfo.label}</span>
                  {rankedOutcome && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-black",
                        rpDelta >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {rpDelta >= 0 ? `+${rpDelta} RP` : `${rpDelta} RP`}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs font-medium">
                  {rankedOutcome
                    ? `${rankedOutcome.rpBefore} RP → ${rankedOutcome.rpAfter} RP`
                    : `${currentRp} RP Total`}
                </p>
              </div>
            </div>

            {/* Streak Bonus Pill */}
            {Boolean(rankedOutcome?.streakBonus) && (
              <div className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                <Sparkles className="size-3.5" />
                +{rankedOutcome?.streakBonus} Streak
              </div>
            )}
          </div>

          {/* Progress to Next Tier */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Tier Progress</span>
              <span className="text-muted-foreground font-bold">
                {rankInfo.nextAt === null ? "Apex Rank Reached" : `${rankInfo.nextAt - currentRp} RP to Next Division`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round(rankInfo.progress * 100)}%`,
                  backgroundColor: rankInfo.tier.color,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Standings List */}
      <div className="surface-card divide-y text-left">
        {standings(m).map((id, rank) => {
          const pl = m.players[id];
          const isMe = id === uid;
          return (
            <div key={id} className={cn("flex items-center justify-between p-3", isMe && "bg-primary/5 font-bold")}>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-4 text-xs">{rank + 1}</span>
                <PlayerAvatar name={pl.name} size={32} />
                <span className="text-sm">{pl.name}</span>
                {isMe && <span className="text-primary text-xs">(You)</span>}
              </div>
              <span className="tabular font-black">{pl.score} pts</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/battle">Back to Arena</Link>
        </Button>
      </div>
    </div>
  );
}
