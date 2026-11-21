import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import {
  Bolt,
  Brain,
  Check,
  ChevronRight,
  Flame,
  Flag,
  RotateCcw,
  Share2,
  SkipForward,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Empty, FullLoader } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { getSubjectQuestions, type CachedQuestion } from "@/lib/question-cache";
import { useSubjects } from "@/lib/subjects";
import { pageMeta } from "@/lib/meta";
import { play } from "@/lib/sfx";

export const Route = createFileRoute("/_player/speed-demon")({
  head: () =>
    pageMeta("Speed Demon", "Race the clock and answer as many Juvora questions as possible."),
  component: SpeedDemon,
});

interface SpeedResult {
  id: string;
  uid: string;
  username: string;
  course: string;
  score: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  avgResponseMs: number;
  bestStreak: number;
  durationMs: number;
  verified: boolean;
  createdAt: number;
}

interface MatchConfig {
  enabled: boolean;
  durationSeconds: number;
  correctPoints: number;
  maxSpeedBonus: number;
  minimumQuestions: number;
}

const DEFAULT_CONFIG: MatchConfig = {
  enabled: true,
  durationSeconds: 60,
  correctPoints: 10,
  maxSpeedBonus: 5,
  minimumQuestions: 20,
};

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function cleanConfig(value: Partial<MatchConfig> | undefined): MatchConfig {
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  return {
    enabled: value?.enabled !== false,
    durationSeconds: num(value?.durationSeconds, 60, 15, 600),
    correctPoints: num(value?.correctPoints, 10, 0, 100),
    maxSpeedBonus: num(value?.maxSpeedBonus, 5, 0, 50),
    minimumQuestions: num(value?.minimumQuestions, 20, 4, 500),
  };
}

function scoreAnswer(correct: boolean, elapsedMs: number, durationMs: number, config: MatchConfig) {
  if (!correct) return 0;
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedMs / durationMs));
  return config.correctPoints + Math.round(config.maxSpeedBonus * remainingRatio);
}

export function speedDemonScore(
  correct: boolean,
  elapsedMs: number,
  durationMs: number,
  config: Partial<MatchConfig> = {}
) {
  return scoreAnswer(correct, elapsedMs, durationMs, cleanConfig(config));
}

function SpeedDemon() {
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();
  const subjects = useSubjects(fb?.db);
  const [course, setCourse] = useState("all");
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG);
  const [phase, setPhase] = useState<"lobby" | "loading" | "playing" | "results">("lobby");
  const [questions, setQuestions] = useState<CachedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [leftMs, setLeftMs] = useState(60_000);
  const [startedAt, setStartedAt] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [personalBest, setPersonalBest] = useState<SpeedResult | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(
      doc(fb.db, "settings", "speedDemon"),
      (snap) => {
        setConfig(cleanConfig(snap.exists() ? (snap.data() as Partial<MatchConfig>) : undefined));
      },
      () => setConfig(DEFAULT_CONFIG)
    );
  }, [fb]);

  useEffect(() => {
    if (!fb || !user) return;
    getDocs(
      query(collection(fb.db, "speedDemon_results"), where("uid", "==", user.uid), limit(50))
    )
      .then((snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SpeedResult, "id">),
        })) as SpeedResult[];
        rows.sort((a, b) => b.score - a.score);
        setPersonalBest(rows[0] ?? null);
      })
      .catch(() => {});
  }, [fb, user]);

  const attempted = correct + wrong + skipped;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  const durationMs = config.durationSeconds * 1000;

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
      setLeftMs(remaining);
      if (remaining === 0) void finishMatch();
    }, 100);
    return () => clearInterval(timer);
  }, [phase, startedAt, durationMs]);

  async function finishMatch() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setPhase("results");
    setLocked(true);
    play("gameover");

    if (!fb || !user || !profile) return;

    const attemptedNow = correct + wrong + skipped;
    const avg = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    const payload = {
      uid: user.uid,
      username: profile.username,
      course,
      score,
      attempted: attemptedNow,
      correct,
      wrong,
      skipped,
      accuracy: attemptedNow ? Math.round((correct / attemptedNow) * 100) : 0,
      avgResponseMs: avg,
      bestStreak,
      durationMs,
      verified: false,
      createdAt: Date.now(),
      serverVerifiedAt: null,
    };

    try {
      const ref = await addDoc(collection(fb.db, "speedDemon_results"), payload);
      await runTransaction(fb.db, async (tx) => {
        const userRef = doc(fb.db, "users", user.uid);
        const u = await tx.get(userRef);
        if (!u.exists()) return;
        const data = u.data();
        const xpGain = correct * 4 + Math.round(score / 10);
        const xp = (data.xp ?? 0) + xpGain;
        const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
        tx.update(userRef, {
          xp,
          level,
          speedDemonMatches: increment(1),
          speedDemonCorrect: increment(correct),
          speedDemonBestStreak: Math.max(data.speedDemonBestStreak ?? 0, bestStreak),
          speedDemonPersonalBest: Math.max(data.speedDemonPersonalBest ?? 0, score),
        });
        tx.update(doc(fb.db, "speedDemon_results", ref.id), {
          verified: true,
          serverVerifiedAt: Date.now(),
        });
      });
      const final = { id: ref.id, ...payload, verified: true } as SpeedResult;
      setResult(final);
      if (!personalBest || score > personalBest.score) setPersonalBest(final);
    } catch (error) {
      toast.error((error as Error).message || "Could not save this verified match.");
    }
  }

  async function startMatch() {
    if (!fb || !user) return;
    if (!config.enabled) {
      toast.error("Speed Demon is disabled right now.");
      return;
    }
    setPhase("loading");
    submittedRef.current = false;
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setSkipped(0);
    setStreak(0);
    setBestStreak(0);
    setResponseTimes([]);
    setLocked(false);
    setResult(null);

    try {
      const subject = course === "all" ? undefined : subjects.find((s) => s.id === course)?.name;
      let pool = await getSubjectQuestions(fb.db, subject);
      pool = shuffle(pool).filter(
        (q) => q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4
      );
      if (pool.length < config.minimumQuestions) {
        setPhase("lobby");
        toast.error(
          `This mode needs at least ${config.minimumQuestions} valid questions. An admin must add more questions.`
        );
        return;
      }
      setQuestions(pool.slice(0, Math.max(config.minimumQuestions, 100)));
      const now = Date.now();
      setStartedAt(now);
      setQuestionStartedAt(now);
      setLeftMs(config.durationSeconds * 1000);
      play("found");
      setPhase("playing");
    } catch (error) {
      setPhase("lobby");
      toast.error((error as Error).message);
    }
  }

  function nextQuestion(responseMs: number, isCorrect: boolean, isSkip = false) {
    if (locked || phase !== "playing") return;
    setLocked(true);

    if (!isSkip) {
      setResponseTimes((v) => [...v, responseMs]);
      if (isCorrect) {
        play("correct");
        const points = scoreAnswer(true, responseMs, durationMs, config);
        setScore((v) => v + points);
        setCorrect((v) => v + 1);
        setStreak((v) => {
          const next = v + 1;
          setBestStreak((old) => Math.max(old, next));
          return next;
        });
      } else {
        play("wrong");
        setWrong((v) => v + 1);
        setStreak(0);
      }
    } else {
      play("click");
      setSkipped((v) => v + 1);
      setStreak(0);
    }

    window.setTimeout(() => {
      setIndex((v) => (v + 1 < questions.length ? v + 1 : 0));
      setQuestionStartedAt(Date.now());
      setLocked(false);
    }, 180);
  }

  async function shareResults() {
    const text = `I scored ${result?.score ?? score} in Speed Demon — ${correct} correct, ${accuracy}% accuracy!`;
    try {
      if (navigator.share) await navigator.share({ title: "Juvora Speed Demon", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Results copied to clipboard");
      }
    } catch {
      // User cancelled share
    }
  }

  const current = questions[index];
  const seconds = Math.ceil(leftMs / 1000);
  const progress = Math.max(0, Math.min(100, (leftMs / durationMs) * 100));

  if (phase === "loading") return <FullLoader label="Preparing Speed Demon" />;

  if (phase === "results") {
    const avg = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    const finalScore = result?.score ?? score;
    const isNewBest = !!personalBest && finalScore >= personalBest.score;

    const stats: [string, string | number, ComponentType<{ className?: string }>][] = [
      ["Attempted", correct + wrong + skipped, Brain],
      ["Correct", correct, Check],
      ["Incorrect", wrong, X],
      ["Skipped", skipped, SkipForward],
      ["Accuracy", `${accuracy}%`, Flag],
      ["Avg. response", `${(avg / 1000).toFixed(1)}s`, Bolt],
      ["Best streak", bestStreak, Flame],
      ["PB", personalBest?.score ?? 0, Trophy],
    ];

    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="hero-card overflow-hidden p-6 text-center">
          <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full border border-primary/40 bg-primary/10 shadow-glow">
            <Zap className="size-8 text-primary" />
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.35em] text-primary">
            Match complete
          </div>
          <h1 className="mt-2 text-5xl font-black tabular-nums">{finalScore}</h1>
          {isNewBest && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning">
              <Trophy className="size-3.5" /> Personal best
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, val, Icon]) => (
            <div key={label} className="surface-card p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Icon className="size-3.5 text-primary" /> {label}
              </div>
              <div className="mt-2 text-xl font-black tabular-nums">{val}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="hero" onClick={() => void startMatch()}>
            <RotateCcw className="size-4" /> Play Again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/battle">
              <ChevronRight className="size-4" /> Return to Arena
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void shareResults()}>
            <Share2 className="size-4" /> Share Results
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "playing" && current) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="surface-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-destructive">
                Speed Demon
              </div>
              <div
                className={`mt-1 text-5xl font-black tabular-nums leading-none ${
                  seconds <= 10 ? "text-destructive animate-pulse" : "text-foreground"
                }`}
              >
                {seconds}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Score
              </div>
              <div className="text-3xl font-black tabular-nums text-primary">{score}</div>
            </div>
          </div>
          <Progress
            value={progress}
            className={`mt-4 h-2 ${seconds <= 10 ? "[&>div]:bg-destructive" : ""}`}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="surface-card p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">Answered</div>
            <div className="text-xl font-black tabular-nums">{attempted}</div>
          </div>
          <div className="surface-card p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">Correct</div>
            <div className="text-xl font-black tabular-nums text-success">{correct}</div>
          </div>
          <div className="surface-card p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">Accuracy</div>
            <div className="text-xl font-black tabular-nums">{accuracy}%</div>
          </div>
        </div>

        <div
          key={current.id}
          className="surface-card animate-in fade-in slide-in-from-right-4 p-5 sm:p-7"
        >
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-primary">
              Question {attempted + 1}
            </span>
            {streak > 1 && (
              <span className="inline-flex items-center gap-1 font-bold text-warning">
                <Flame className="size-4" /> {streak} streak
              </span>
            )}
          </div>
          <h2 className="text-xl font-black leading-snug sm:text-2xl">{current.text}</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {current.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                disabled={locked}
                onClick={() =>
                  nextQuestion(Date.now() - questionStartedAt, optionIndex === current.correctIndex)
                }
                className="pressable flex min-h-16 items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-left text-sm font-bold transition-all hover:border-primary/70 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-xs text-primary">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="mt-4 w-full text-muted-foreground"
            disabled={locked}
            onClick={() => nextQuestion(Date.now() - questionStartedAt, false, true)}
          >
            <SkipForward className="size-4" /> Skip question
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="hero-card relative overflow-hidden p-6 sm:p-8">
        <Zap className="absolute -bottom-8 -right-8 size-40 text-primary/10" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-primary">
            <Bolt className="size-3.5" /> Competitive mode
          </div>
          <h1 className="mt-4 text-4xl font-black sm:text-5xl">Speed Demon</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Answer quickly and accurately. Every correct answer earns {config.correctPoints} points,
            with up to {config.maxSpeedBonus} extra points for speed.
          </p>
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Choose courses
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCourse("all")}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
              course === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 hover:bg-muted"
            }`}
          >
            All courses
          </button>
          {subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => setCourse(subject.id)}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                course === subject.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 hover:bg-muted"
              }`}
            >
              {subject.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="surface-card p-3 text-center">
          <div className="text-2xl font-black tabular-nums">{config.durationSeconds}s</div>
          <div className="text-[10px] uppercase text-muted-foreground">Duration</div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-2xl font-black tabular-nums">{config.correctPoints}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Base points</div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-2xl font-black tabular-nums">+{config.maxSpeedBonus}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Speed bonus</div>
        </div>
      </div>

      {!config.enabled ? (
        <Empty
          icon={Zap}
          title="Speed Demon is paused"
          text="An administrator has disabled this mode for now."
        />
      ) : (
        <Button
          variant="hero"
          size="lg"
          className="w-full"
          onClick={() => void startMatch()}
        >
          <Zap className="size-5" /> Start Speed Demon
        </Button>
      )}

      {personalBest && (
        <div className="surface-card flex items-center justify-between p-4">
          <div>
            <div className="text-xs text-muted-foreground">Personal best</div>
            <div className="text-xl font-black">{personalBest.score} points</div>
          </div>
          <Trophy className="size-6 text-warning" />
        </div>
      )}
    </div>
  );
}
