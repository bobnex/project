import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  Check,
  Coins,
  Crown,
  Flame,
  Home,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullLoader } from "@/components/game/ui";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { RankBadge } from "@/components/game/RankBadge";
import { useApp } from "@/lib/app-context";
import {
  applyResults,
  forfeit,
  hostStart,
  leaveLobby,
  rememberPendingSettle,
  submitAnswer,
  tick,
  type MatchRewards,
} from "@/lib/engine";
import { settleClanWarMatch } from "@/lib/clan-war";
import {
  computeWinners,
  isEliminated,
  playerOrder,
  progressOf,
  questionMs,
  type Match,
  type Mode,
  type Team,
} from "@/lib/game-rules";
import {
  countsForRank,
  useRankedConfig,
  type RankedState,
} from "@/lib/ranked-store";
import { useSFX } from "@/lib/sfx";
import { useVoiceSession, voiceAvailable } from "@/lib/voice";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  course: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export const Route = createFileRoute("/_player/match/$matchId")({
  component: MatchRoom,
  head: () => ({
    title: "Battle Arena | Juvora Esports",
    meta: [{ name: "description", content: "Compete live in the arena." }],
  }),
});

function MatchRoom() {
  const { matchId } = Route.useParams();
  const { fb, user, profile, settings } = useApp();
  const navigate = useNavigate();
  const [m, setM] = useState<Match | null>(null);
  const [qs, setQs] = useState<Record<string, Question>>({});
  const [now, setNow] = useState(Date.now());
  const [missing, setMissing] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(doc(fb.db, "matches", matchId), (s) => {
      if (!s.exists()) {
        setMissing(true);
        return;
      }
      setM({ id: s.id, ...(s.data() as Omit<Match, "id">) });
    });
  }, [fb, matchId]);

  useEffect(() => {
    if (!fb || !m || !m.questionIds?.length) return;
    const missingIds = m.questionIds.filter((id) => !qs[id]);
    if (!missingIds.length) return;
    Promise.all(missingIds.map((id) => getDoc(doc(fb.db, "questions", id)))).then((snaps) => {
      const add: Record<string, Question> = {};
      snaps.forEach((s) => {
        if (s.exists()) add[s.id] = { id: s.id, ...(s.data() as Omit<Question, "id">) };
      });
      setQs((cur) => ({ ...cur, ...add }));
    });
  }, [fb, m, qs]);

  useEffect(() => {
    if (!fb || !m || !user || !m.playerIds.includes(user.uid) || ticking.current) return;
    ticking.current = true;
    tick(fb.db, m.id, m).finally(() => (ticking.current = false));
  }, [fb, m, now, user]);

  if (missing)
    return (
      <div className="p-10 text-center">
        This battle doesn't exist.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );
  if (!m || !user || !fb) return <FullLoader label="Entering the arena" />;
  if (m.status === "cancelled")
    return (
      <div className="p-10 text-center">
        This room was closed.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );
  if (!m.playerIds.includes(user.uid))
    return (
      <div className="p-10 text-center">
        You're not part of this battle.{" "}
        <Link to="/battle" className="text-primary font-semibold">
          Back to arena
        </Link>
      </div>
    );

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
      {voice && <VoiceBar db={fb.db} matchId={m.id} uid={user.uid} username={profile?.username ?? "Player"} />}
    </>
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

    const attempt = (n: number) =>
      applyResults(fb.db, m.id, uid)
        .then((r) => {
          if (r) setReward(r);
          if (m.clanWarId) {
            settleClanWarMatch(fb.db, m.clanWarId, m).catch(() => {});
          }
        })
        .catch(() => {
          if (n < 4) setTimeout(() => attempt(n + 1), 1500 * (n + 1));
          else rememberPendingSettle(m.id);
        });

    attempt(0);
  }, [fb, m, uid]);

  const p = m.players[uid];
  const order = playerOrder(m);
  const won = m.winnerIds.includes(uid);
  const draw = m.winnerIds.length > 1 && won;
  const isDuo = m.mode === "duo";

  const duoTeams: Record<Team, { players: string[]; score: number }> = {
    A: { players: [], score: 0 },
    B: { players: [], score: 0 },
  };

  if (isDuo) {
    m.playerIds.forEach((id) => {
      const pl = m.players[id];
      if (pl?.team) {
        duoTeams[pl.team].players.push(id);
        duoTeams[pl.team].score += pl.score;
      }
    });
  }

  const myTeam = p?.team;
  const teamWon = myTeam && m.winnerIds.some((id) => m.players[id]?.team === myTeam);

  return (
    <div className="mx-auto max-w-xl space-y-5 text-center">
      {m.clanWarId && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-center">
          <div className="flex items-center justify-center gap-2 font-black text-primary text-sm">
            <Shield className="size-4" />
            Clan War Match Completed
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This duel result has been applied toward your clan's overall war clash.
          </p>
        </div>
      )}

      <div className="hero-card space-y-3 p-8">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-primary/10 text-primary">
          {won || teamWon ? (
            <Crown className="size-10 text-warning" />
          ) : (
            <TrophyIcon className="size-10" />
          )}
        </div>
        <h1 className="text-3xl font-extrabold">
          {isDuo
            ? teamWon
              ? "Your team won!"
              : "Defeat"
            : draw
              ? "It's a draw!"
              : won
                ? "Victory!"
                : "Defeat"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isDuo
            ? `Team ${myTeam} scored ${myTeam ? duoTeams[myTeam].score : 0} points`
            : `You scored ${p?.score ?? 0} points (${p?.correct ?? 0} correct)`}
        </p>

        {reward && (
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Reward icon={Sparkles} label="XP Gained" value={`+${reward.xpGained}`} />
            <Reward icon={Coins} label="Coins" value={`+${reward.coins}`} />
            {reward.ranked && (
              <div className="col-span-2">
                <Reward
                  icon={TrophyIcon}
                  label="Ranked RP"
                  value={reward.ranked.delta >= 0 ? `+${reward.ranked.delta} RP` : `${reward.ranked.delta} RP`}
                />
              </div>
            )}
          </div>
        )}

        {reward?.ranked && (
          <div className="bg-muted mt-3 rounded-2xl p-3 text-left">
            {reward.ranked.placementJustFinished && (
              <div className="text-primary mb-1 text-sm font-extrabold">
                Placement complete — you start at {reward.ranked.rankAfter}!
              </div>
            )}
            {reward.ranked.streakBonus > 0 && (
              <div className="text-warning mb-1 text-sm font-bold">
                Win streak bonus +{reward.ranked.streakBonus} RP
              </div>
            )}
            {reward.ranked.shielded && (
              <div className="text-primary mb-1 text-sm font-bold">
                Demotion shield saved your rank!
              </div>
            )}
            {reward.ranked.change === "promoted" && (
              <div className="text-success mb-1 text-sm font-extrabold">
                Promoted to {reward.ranked.rankAfter}!
              </div>
            )}
            {reward.ranked.change === "demoted" && (
              <div className="text-destructive mb-1 text-sm font-extrabold">
                Demoted to {reward.ranked.rankAfter}
              </div>
            )}
            <RankBadge
              state={{ ...(profile ?? {}), ...reward.ranked.patch }}
              cfg={rankedCfg}
              showProgress
            />
          </div>
        )}
      </div>

      <div className="surface-card divide-y">
        {order.slice(0, 50).map((id, i) => {
          const pl = m.players[id];
          return (
            <div
              key={id}
              className={cn("flex items-center gap-3 p-3", id === uid && "bg-primary/8")}
            >
              <span className="tabular text-muted-foreground w-6 text-center text-sm font-bold">
                {i + 1}
              </span>
              <PlayerAvatar name={pl.name} size={32} />
              <span className="flex-1 truncate text-sm font-semibold">
                {pl.name}
                {id === uid && " (you)"}
              </span>
              {m.winnerIds.includes(id) && <Crown className="text-warning size-4" />}
              <span className="text-muted-foreground tabular text-xs">{pl.correct}✓</span>
              <span className="tabular w-12 text-right text-sm font-bold">{pl.score}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {m.clanWarId ? (
          <>
            <Button asChild variant="outline" size="lg">
              <Link to="/clans">
                <Shield className="mr-2 size-4" /> Clan HQ
              </Link>
            </Button>
            <Button asChild variant="hero" size="lg">
              <Link to="/clan-war/$challengeId" params={{ challengeId: m.clanWarId }}>
                <Swords className="mr-2 size-4" /> War Room
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="lg">
              <Link to="/home">
                <Home /> Home
              </Link>
            </Button>
            <Button asChild variant="hero" size="lg">
              <Link to="/battle">
                <Swords /> Play again
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Reward({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted rounded-2xl p-3">
      <Icon className="text-primary mx-auto size-4" />
      <div className="text-muted-foreground mt-1 text-xs font-semibold">{label}</div>
      <div className="tabular text-base font-extrabold">{value}</div>
    </div>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

/* ---------------- Lobby ---------------- */
function Lobby({
  m,
  uid,
  now,
  onLeave,
}: {
  m: Match;
  uid: string;
  now: number;
  onLeave: () => void;
}) {
  const isHost = m.hostId === uid;
  const canStart = isHost && m.playerIds.length >= 2;
  const leftSec = Math.max(0, Math.ceil((m.lobbyEndsAt - now) / 1000));
  const { fb } = useApp();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="hero-card space-y-3 p-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <Radio className="size-3 animate-pulse" />
          {m.code ? `Room Code: ${m.code}` : "Matchmaking Lobby"}
        </div>
        <h1 className="text-3xl font-extrabold capitalize">{m.mode} Arena</h1>
        <p className="text-muted-foreground text-sm">
          {m.playerIds.length} / {m.maxPlayers} players joined
          {m.lobbyEndsAt > 0 && ` • Starting in ${leftSec}s`}
        </p>

        {isHost && (
          <Button
            size="lg"
            className="w-full font-bold"
            disabled={!canStart}
            onClick={() => fb && hostStart(fb.db, m.id, uid)}
          >
            {canStart ? "Start Match Now" : "Waiting for players…"}
          </Button>
        )}
      </div>

      <div className="surface-card divide-y">
        {m.playerIds.map((id) => (
          <div key={id} className="flex items-center gap-3 p-3">
            <PlayerAvatar name={m.players[id]?.name ?? "Player"} size={36} />
            <span className="font-semibold text-sm">
              {m.players[id]?.name}
              {id === uid && " (you)"}
            </span>
            {id === m.hostId && (
              <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Host
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onLeave}>
          Leave Room
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Duo Lobby ---------------- */
function DuoLobby({
  db,
  m,
  uid,
  onLeave,
}: {
  db: Firestore;
  m: Match;
  uid: string;
  onLeave: () => void;
}) {
  const isHost = m.hostId === uid;
  const canStart = isHost && m.playerIds.length >= 2;

  const setTeam = async (targetTeam: Team) => {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "matches", m.id);
      const s = await tx.get(ref);
      if (!s.exists()) return;
      tx.update(ref, { [`players.${uid}.team`]: targetTeam });
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="hero-card space-y-3 p-8 text-center">
        <h1 className="text-3xl font-extrabold">2v2 Duo Team Setup</h1>
        <p className="text-muted-foreground text-sm">Choose your team side</p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {(["A", "B"] as const).map((t) => (
            <Button
              key={t}
              variant={m.players[uid]?.team === t ? "default" : "outline"}
              onClick={() => void setTeam(t)}
            >
              Join Team {t}
            </Button>
          ))}
        </div>

        {isHost && (
          <Button
            size="lg"
            className="w-full font-bold mt-4"
            disabled={!canStart}
            onClick={() => hostStart(db, m.id, uid)}
          >
            Start Duo Match
          </Button>
        )}
      </div>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onLeave}>
          Leave Match
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Countdown ---------------- */
function Countdown({ m, now }: { m: Match; uid: string; now: number }) {
  const left = Math.max(0, Math.ceil((m.countdownEndsAt - now) / 1000));
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center p-6">
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">Get Ready</div>
        <div className="text-8xl font-black text-primary animate-pulse">{left || "GO!"}</div>
        <div className="text-sm text-muted-foreground">The duel is about to commence!</div>
      </div>
    </div>
  );
}

/* ---------------- Live Match ---------------- */
function Live({
  m,
  uid,
  now,
  qs,
}: {
  m: Match;
  uid: string;
  now: number;
  qs: Record<string, Question>;
}) {
  const { fb } = useApp();
  const sfx = useSFX();
  const qId = m.questionIds[m.currentIndex];
  const q = qId ? qs[qId] : null;
  const p = m.players[uid];
  const idx = String(m.currentIndex);
  const myAnswer = p?.answers?.[idx];

  const totalMs = questionMs(m.mode, m.secondsPerQuestion);
  const leftMs = Math.max(0, m.deadline - now);
  const progress = progressOf(m, now);

  const onAnswer = async (choice: number) => {
    if (!fb || !q || myAnswer) return;
    try {
      await submitAnswer(fb.db, m.id, uid, q, choice);
      if (choice === q.correctIndex) sfx.correct();
      else sfx.wrong();
    } catch {
      // Ignored
    }
  };

  const onForfeit = async () => {
    if (!fb) return;
    await forfeit(fb.db, m.id, uid);
  };

  if (!q) return <FullLoader label="Preparing next question…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="surface-card flex items-center justify-between p-3 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span>
            Question {m.currentIndex + 1} of {m.questionIds.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-warning" />
          <span className="tabular">{Math.ceil(leftMs / 1000)}s</span>
        </div>
      </div>

      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="hero-card p-6 sm:p-8 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {q.course}
        </div>
        <h2 className="text-lg sm:text-xl font-bold leading-relaxed">{q.question}</h2>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const selected = myAnswer?.choice === i;
          const isCorrect = m.phase === "reveal" && i === q.correctIndex;
          const isWrong = m.phase === "reveal" && selected && !myAnswer?.correct;

          return (
            <button
              key={i}
              type="button"
              disabled={!!myAnswer || m.phase !== "question"}
              onClick={() => void onAnswer(i)}
              className={cn(
                "p-4 rounded-xl border text-left font-semibold text-sm transition-all",
                selected && "border-primary bg-primary/10",
                isCorrect && "border-success bg-success/15 text-success font-bold",
                isWrong && "border-destructive bg-destructive/15 text-destructive",
                !selected && !isCorrect && !isWrong && "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span className="mr-2 inline-block size-6 rounded-full border text-center text-xs leading-5">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      <div className="text-center pt-2">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onForfeit}>
          Forfeit Battle
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Voice Bar ---------------- */
function VoiceBar({
  db,
  matchId,
  uid,
  username,
}: {
  db: Firestore;
  matchId: string;
  uid: string;
  username: string;
}) {
  const { connected, peers, muted, deafened, toggleMute, toggleDeafen } = useVoiceSession(
    db,
    matchId,
    uid,
    username,
  );

  if (!connected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border/80 bg-background/90 p-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-success">
        <Radio className="size-3 animate-pulse" />
        <span>Voice ({peers.length + 1})</span>
      </div>
      <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={toggleMute}>
        {muted ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={toggleDeafen}>
        {deafened ? <VolumeX className="size-4 text-destructive" /> : <Volume2 className="size-4" />}
      </Button>
    </div>
  );
}
