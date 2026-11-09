import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getSubjectQuestions } from "@/lib/question-cache";
import { ArrowLeft, ArrowRight, Check, Clock, Flag, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FullLoader, Empty } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { useSubjects } from "@/lib/subjects";
import { shuffleOptions, type Question } from "@/lib/engine";
import { CBT_LEVELS, cbtSettings, formatClock, pickCbtPool, scoreCbt, testDuration, timeLeftMs, topicsOf, type CbtLevel, type CbtResult } from "@/lib/cbt-rules";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_player/cbt/$courseId")({
  head: () => pageMeta("CBT Exam", "A timed solo computer-based test."),
  component: CbtExam,
});

interface Session {
  questions: Question[];
  answers: (number | null)[];
  flags: boolean[];
  startedAt: number;
  endsAt: number;
  current: number;
  topic?: string | null;
  level?: CbtLevel | null;
}

function shuffled<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function CbtExam() {
  const { courseId } = Route.useParams();
  const { fb, user } = useApp();
  const navigate = useNavigate();
  const subjects = useSubjects(fb?.db);
  const course = subjects.find((s) => s.id === courseId);
  const settings = course ? cbtSettings(course) : null;
  const key = user ? `cbt:${user.uid}:${courseId}` : "";

  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<CbtResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reviewOnly, setReviewOnly] = useState<"all" | "wrong">("all");
  const submitted = useRef(false);
  const [pool, setPool] = useState<Question[] | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [level, setLevel] = useState<CbtLevel | null>(null);
  const topics = useMemo(() => topicsOf(pool ?? []), [pool]);
  const available = useMemo(() => pickCbtPool(pool ?? [], topic, level).length, [pool, topic, level]);
  const levelCount = (l: CbtLevel | null) => pickCbtPool(pool ?? [], topic, l).length;

  // Load the course's questions once so topics can be listed.
  useEffect(() => {
    if (!fb || !course) return;
    let alive = true;
    getSubjectQuestions(fb.db, course.name)
      .then((rows) => alive && setPool(rows))
      .catch(() => alive && setPool([]));
    return () => { alive = false; };
  }, [fb, course?.name]);

  // Resume an unfinished test after a refresh.
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, [key]);

  useEffect(() => {
    if (session && !result && key) localStorage.setItem(key, JSON.stringify(session));
  }, [session, result, key]);

  useEffect(() => {
    if (!session || result) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [session, result]);

  const submit = useCallback(async (s: Session, auto = false) => {
    if (submitted.current || !fb || !user || !course || !settings) return;
    submitted.current = true;
    const r = scoreCbt(s.questions.map((q) => q.correctIndex), s.answers, settings.passMark);
    setResult(r);
    localStorage.removeItem(key);
    if (auto) toast.info("Time's up! Your test was submitted.");
    try {
      await addDoc(collection(fb.db, "cbt_attempts"), {
        userId: user.uid,
        courseId,
        courseName: course.name,
        topic: s.topic ?? null,
        difficulty: s.level ?? null,
        correct: r.correct,
        total: r.total,
        percent: r.percent,
        passed: r.passed,
        timeUsedMs: Math.min(Date.now(), s.endsAt) - s.startedAt,
        finishedAt: Date.now(),
      });
    } catch {
      toast.error("Your score couldn't be saved to your history.");
    }
  }, [fb, user, course, settings, courseId, key]);

  const left = session ? timeLeftMs(session.endsAt, now) : 0;
  useEffect(() => {
    if (session && !result && left === 0) submit(session, true);
  }, [left, session, result, submit]);

  async function start() {
    if (!fb || !course || !settings) return;
    setStarting(true);
    try {
      const picked = pickCbtPool(pool ?? [], topic, level);
      const seed = crypto.randomUUID();
      const qs = shuffled(picked).slice(0, settings.questionCount).map((q) => shuffleOptions(q, seed));
      if (!qs.length) throw new Error(level ? `No ${level} questions here yet. Try another level.` : topic ? "This topic has no questions yet." : "This course has no questions yet.");
      const t = Date.now();
      submitted.current = false;
      setResult(null);
      setNow(t);
      setSession({ questions: qs, answers: qs.map(() => null), flags: qs.map(() => false), startedAt: t, endsAt: t + testDuration(settings, qs.length) * 60_000, current: 0, topic, level });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setStarting(false);
  }

  const answered = useMemo(() => session?.answers.filter((a) => a !== null).length ?? 0, [session]);

  if (!fb || !user || subjects.length === 0) return <FullLoader />;
  if (!course || !settings) return <Empty icon={X} title="Course not found" text="It may have been removed."><Button asChild variant="outline"><Link to="/cbt">Back to courses</Link></Button></Empty>;

  // Intro
  if (!session)
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/cbt" className="text-muted-foreground flex items-center gap-1 text-sm"><ArrowLeft className="size-4" /> Courses</Link>
        <div className="surface-card space-y-4 p-6">
          <h2 className="text-2xl font-bold">{course.name}</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Info label="Duration" value={`${topic || level ? testDuration(settings, Math.min(settings.questionCount, available)) : settings.duration} min`} />
            <Info label="Questions" value={`up to ${settings.questionCount}`} />
            <Info label="Pass mark" value={`${settings.passMark}%`} />
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-bold uppercase">Difficulty</div>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Difficulty">
              {([null, ...CBT_LEVELS] as (CbtLevel | null)[]).map((l) => {
                const n = pool ? levelCount(l) : 0;
                return (
                  <button key={l ?? "all"} type="button" role="radio" aria-checked={level === l} disabled={!!pool && l !== null && n === 0}
                    onClick={() => setLevel(l)}
                    className={cn("pressable rounded-xl border px-2 py-2 text-center text-sm font-semibold capitalize transition-colors disabled:opacity-40",
                      level === l ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    {l ?? "Mixed"}
                    {pool && <div className="text-muted-foreground text-[10px] font-normal">{n} Qs</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-bold uppercase">Choose what to practise</div>
            {pool === null ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Loading topics…</div>
            ) : (
              <div className="grid gap-2">
                <TopicOption active={topic === null} onClick={() => setTopic(null)} name="Whole course" count={pool.length} />
                {topics.map((t) => (
                  <TopicOption key={t.name} active={topic === t.name} onClick={() => setTopic(t.name)} name={t.name} count={t.count} />
                ))}
              </div>
            )}
          </div>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {settings.instructions && <li className="text-foreground whitespace-pre-line">{settings.instructions}</li>}
            <li>Topic and difficulty tests get time in proportion to their number of questions.</li>
            <li>The timer is for the whole test. When it hits zero, your test is submitted automatically.</li>
            <li>Move freely between questions, change answers and flag ones to revisit.</li>
            <li>Questions and options are shuffled for every attempt.</li>
            <li>If you refresh, your test continues where you left off.</li>
          </ul>
          <Button className="w-full" size="lg" onClick={start} disabled={starting || !available}>{starting && <Loader2 className="animate-spin" />} Start {level ? `${level} ` : ""}{topic ? `${topic} test` : "full test"}</Button>
        </div>
      </div>
    );

  const total = session.questions.length;

  // Result + review
  if (result)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="surface-card space-y-3 p-6 text-center">
          <div className="text-muted-foreground text-sm">{course.name}{session.topic ? ` · ${session.topic}` : ""}</div>
          <div className={cn("text-5xl font-black", result.passed ? "text-success" : "text-destructive")}>{result.percent}%</div>
          <div className="font-semibold">{result.passed ? "Passed 🎉" : "Not passed yet"}</div>
          <div className="grid grid-cols-3 gap-2">
            <Info label="Correct" value={result.correct} />
            <Info label="Wrong" value={result.wrong} />
            <Info label="Skipped" value={result.unanswered} />
          </div>
          <div className="text-muted-foreground text-xs">Time used: {formatClock(Math.min(Date.now(), session.endsAt) - session.startedAt)}</div>
          <div className="flex justify-center gap-2">
            <Button onClick={() => { setSession(null); setResult(null); }}><RotateCcw /> Try again</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/cbt" })}>All courses</Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={reviewOnly === "all" ? "default" : "outline"} onClick={() => setReviewOnly("all")}>All answers</Button>
          <Button size="sm" variant={reviewOnly === "wrong" ? "default" : "outline"} onClick={() => setReviewOnly("wrong")}>Mistakes only</Button>
        </div>
        {session.questions.map((q, i) => {
          const a = session.answers[i];
          if (reviewOnly === "wrong" && a === q.correctIndex) return null;
          return (
            <div key={q.id} className="surface-card space-y-2 p-4">
              <div className="text-sm font-semibold">{i + 1}. {q.text}</div>
              {q.options.map((o, j) => (
                <div key={j} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                  j === q.correctIndex ? "bg-success/15 text-success" : j === a ? "bg-destructive/15 text-destructive" : "bg-muted")}>
                  {j === q.correctIndex ? <Check className="size-4" /> : j === a ? <X className="size-4" /> : <span className="w-4" />}
                  {o}
                </div>
              ))}
              {a === null && <div className="text-warning text-xs">Not answered</div>}
            </div>
          );
        })}
      </div>
    );

  // Exam
  const i = session.current;
  const q = session.questions[i];
  const set = (patch: Partial<Session>) => setSession({ ...session, ...patch });
  const choose = (j: number) => { const ans = [...session.answers]; ans[i] = j; set({ answers: ans }); };
  const toggleFlag = () => { const f = [...session.flags]; f[i] = !f[i]; set({ flags: f }); };
  const finish = () => {
    const missing = total - answered;
    if (confirm(missing ? `You have ${missing} unanswered question${missing > 1 ? "s" : ""}. Submit anyway?` : "Submit your test?")) submit(session);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="glass sticky top-0 z-20 flex items-center gap-3 rounded-xl border p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{course.name}{session.topic ? ` · ${session.topic}` : ""}</div>
          <div className="text-muted-foreground text-xs">{answered}/{total} answered</div>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-lg font-bold tabular", left < 60_000 ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-muted")}>
          <Clock className="size-4" /> {formatClock(left)}
        </div>
        <Button size="sm" onClick={finish}>Submit</Button>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full"><div className="bg-primary h-full transition-all" style={{ width: `${(answered / total) * 100}%` }} /></div>

      <div className="surface-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-semibold">Question {i + 1} of {total}</span>
          <Button size="sm" variant={session.flags[i] ? "default" : "outline"} onClick={toggleFlag}><Flag /> {session.flags[i] ? "Flagged" : "Flag"}</Button>
        </div>
        <p className="text-lg font-semibold">{q.text}</p>
        <div className="grid gap-2">
          {q.options.map((o, j) => (
            <button key={j} onClick={() => choose(j)}
              className={cn("pressable flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", session.answers[i] === j ? "border-primary bg-primary/10" : "hover:bg-muted")}>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold", session.answers[i] === j ? "bg-primary text-primary-foreground" : "bg-muted")}>{"ABCDEFGH"[j]}</span>
              {o}
            </button>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" disabled={i === 0} onClick={() => set({ current: i - 1 })}><ArrowLeft /> Previous</Button>
          {i < total - 1 ? <Button onClick={() => set({ current: i + 1 })}>Next <ArrowRight /></Button> : <Button onClick={finish}>Submit test</Button>}
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="text-muted-foreground mb-2 text-xs font-bold uppercase">Question map</div>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {session.questions.map((_, j) => (
            <button key={j} onClick={() => set({ current: j })}
              className={cn("relative h-9 rounded-lg text-sm font-semibold",
                j === i ? "ring-primary ring-2" : "",
                session.answers[j] !== null ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {j + 1}
              {session.flags[j] && <span className="bg-warning absolute -top-1 -right-1 size-2.5 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground mt-2 flex gap-4 text-xs"><span>■ Answered</span><span className="text-warning">● Flagged</span></div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted rounded-xl p-2">
      <div className="font-bold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function TopicOption({ name, count, active, onClick }: { name: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("pressable flex items-center justify-between rounded-xl border p-3 text-left text-sm font-semibold transition-colors", active ? "border-primary bg-primary/10" : "hover:bg-muted")}>
      <span>{name}</span>
      <span className="text-muted-foreground text-xs">{count} question{count === 1 ? "" : "s"}</span>
    </button>
  );
}
