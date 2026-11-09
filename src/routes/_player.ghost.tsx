import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Ghost, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { loadQuestions, type Question } from "@/lib/engine";
import { QUESTION_MS, REVEAL_MS, pointsFor, type Match } from "@/lib/game-rules";
import { ghostReplay, isUsableGhost, type GhostStep } from "@/lib/ghost-rules";
import { pageMeta } from "@/lib/meta";
import { PlayerAvatar } from "@/components/game/Avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_player/ghost")({
  head: () => pageMeta("Ghost Rival", "Battle the recorded answers of a real past player while you wait for live opponents."),
  component: GhostPage,
});

interface Setup { name: string; qs: Question[]; steps: GhostStep[] }

async function findGhost(db: Parameters<typeof loadQuestions>[0], uid: string): Promise<Setup> {
  const snap = await getDocs(query(collection(db, "matches"), where("status", "==", "completed"), where("mode", "==", "classic"), limit(40)));
  const pool: { m: Match; gid: string }[] = [];
  snap.docs.forEach((d) => {
    const m = { id: d.id, ...(d.data() as Omit<Match, "id">) };
    m.playerIds.forEach((gid) => { if (isUsableGhost(gid, uid, m.players[gid]?.answers)) pool.push({ m, gid }); });
  });
  if (!pool.length) throw new Error("No past battles to replay yet. Try again after a few real battles have been played.");
  const { m, gid } = pool[Math.floor(Math.random() * pool.length)];
  const map = await loadQuestions(db, m.questionIds, m.id);
  // Keep each question paired with the ghost's answer at the same original position.
  const all = ghostReplay(m.players[gid].answers, m.questionIds.length);
  const pairs = m.questionIds.map((id, i) => ({ q: map[id], s: all[i] })).filter((p) => p.q && p.s);
  if (!pairs.length) throw new Error("That past battle's questions are no longer available. Please try again.");
  return { name: m.players[gid].name, qs: pairs.map((p) => p.q), steps: pairs.map((p) => p.s) };
}

function GhostPage() {
  const { fb, user, profile, settings } = useApp();
  const navigate = useNavigate();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [mine, setMine] = useState<Record<number, { choice: number; points: number }>>({});
  const [done, setDone] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!fb || !user || loaded.current) return;
    loaded.current = true;
    findGhost(fb.db, user.uid).then((s) => { setSetup(s); setStart(Date.now()); }).catch((e) => setErr((e as Error).message));
  }, [fb, user]);

  useEffect(() => {
    if (!setup || done) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [setup, done]);

  const elapsed = now - start;
  const revealing = elapsed >= QUESTION_MS || (mine[idx] && elapsed >= 0 && (setup?.steps[idx]?.atMs ?? QUESTION_MS) <= elapsed);
  useEffect(() => {
    if (!setup || done || !revealing) return;
    const t = setTimeout(() => {
      if (idx + 1 >= setup.qs.length) setDone(true);
      else { setIdx(idx + 1); setStart(Date.now()); setNow(Date.now()); }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [revealing, idx, setup, done]);

  const myScore = useMemo(() => Object.values(mine).reduce((a, b) => a + b.points, 0), [mine]);
  const ghostScore = useMemo(() => {
    if (!setup) return 0;
    return setup.steps.reduce((a, s, i) => a + (i < idx || (i === idx && !!s && s.atMs !== null && (revealing || s.atMs <= elapsed)) || done ? (s?.points ?? 0) : 0), 0);
  }, [setup, idx, elapsed, revealing, done]);

  if (!settings.ghostEnabled) return <Center><p>Ghost Rivals are turned off right now.</p><Button asChild><Link to="/battle">Back to arena</Link></Button></Center>;
  if (err) return <Center><p>{err}</p><Button asChild><Link to="/battle">Back to arena</Link></Button></Center>;
  if (!setup || !profile) return <Center><Loader2 className="animate-spin" /><p>Summoning a ghost rival…</p></Center>;

  const q = setup.qs[idx];
  const step = setup.steps[idx];
  if (!q || !step) return <Center><Loader2 className="animate-spin" /></Center>;
  const ghostAnswered = step.atMs !== null && (revealing || step.atMs <= elapsed);
  const left = Math.max(0, QUESTION_MS - elapsed);

  if (done) {
    const r = myScore > ghostScore ? "You win!" : myScore < ghostScore ? "Ghost wins" : "Draw";
    return (
      <Center>
        <Ghost className="text-primary size-12" />
        <h2 className="text-3xl font-extrabold">{r}</h2>
        <p className="tabular text-lg">{myScore} — {ghostScore}</p>
        <p className="text-muted-foreground text-sm">Practice battle vs {setup.name}'s past run. No rating change.</p>
        <div className="flex gap-2">
          <Button variant="hero" onClick={() => navigate({ to: "/battle" })}><Swords /> Back to arena</Button>
        </div>
      </Center>
    );
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex items-center justify-between p-3">
        <div className="flex items-center gap-2"><PlayerAvatar name={profile.username} size={36} /><div><div className="text-sm font-bold">You</div><div className="tabular text-lg font-extrabold">{myScore}</div></div></div>
        <div className="text-center"><div className="text-muted-foreground text-xs">Q {idx + 1}/{setup.qs.length}</div><div className="tabular text-xl font-extrabold">{Math.ceil(left / 1000)}s</div></div>
        <div className="flex items-center gap-2 text-right"><div><div className="flex items-center gap-1 text-sm font-bold"><Ghost className="size-3.5" />{setup.name}</div><div className="tabular text-lg font-extrabold">{ghostScore}</div></div><PlayerAvatar name={setup.name} size={36} className="opacity-70" /></div>
      </div>
      <div className="text-muted-foreground text-center text-xs">{ghostAnswered ? `${setup.name}'s ghost has answered` : "Ghost is thinking…"}</div>
      <div className="hero-card p-5 text-lg font-bold">{q.text}</div>
      <div className="grid gap-3">
        {q.options.map((o, i) => {
          const picked = mine[idx]?.choice === i;
          return (
            <button key={i} disabled={!!mine[idx] || !!revealing}
              onClick={() => setMine({ ...mine, [idx]: { choice: i, points: pointsFor(i === q.correctIndex, left) } })}
              className={cn("surface-card pressable p-4 text-left font-semibold",
                revealing && i === q.correctIndex && "border-success bg-success/15",
                revealing && picked && i !== q.correctIndex && "border-destructive bg-destructive/15",
                !revealing && picked && "border-primary")}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">{children}</div>;
}
