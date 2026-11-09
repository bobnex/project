import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ClipboardList, Clock, History, ListChecks, Search, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Empty, Section } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { useSubjects , getCourseDisplayName, matchesCourse } from "@/lib/subjects";
import { cbtSettings } from "@/lib/cbt-rules";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/cbt/")({
  head: () => pageMeta("CBT Practice", "Take timed computer-based tests on your own, course by course."),
  component: CbtHome,
});

export interface CbtAttempt {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  timeUsedMs: number;
  finishedAt: number;
}

function CbtHome() {
  const { fb, user } = useApp();
  const subjects = useSubjects(fb?.db);
  const [q, setQ] = useState("");
  const [attempts, setAttempts] = useState<CbtAttempt[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    let alive = true;
    getDocs(query(collection(fb.db, "cbt_attempts"), where("userId", "==", user.uid)))
      .then((s) => alive && setAttempts(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CbtAttempt, "id">) })).sort((a, b) => b.finishedAt - a.finishedAt)))
      .catch(() => {});
    return () => { alive = false; };
  }, [fb, user]);

  const courses = useMemo(
    () => subjects.filter((s) => cbtSettings(s).enabled && matchesCourse(s, q)),
    [subjects, q],
  );
  const best = (id: string) => Math.max(-1, ...attempts.filter((a) => a.courseId === id).map((a) => a.percent));

  return (
    <div className="space-y-6">
      <div className="surface-card p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="size-5" /> Solo CBT mode</h2>
        <p className="text-muted-foreground mt-1 text-sm">No waiting for an opponent. Pick a course, beat the clock, and see your score with corrections.</p>
        <div className="relative mt-4">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input className="pl-9" placeholder="Search courses, e.g. CHM101" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Section title="Courses" icon={ListChecks}>
        {courses.length === 0 ? (
          <Empty icon={ClipboardList} title="No courses found" text="An admin needs to add courses and questions first." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => {
              const s = cbtSettings(c);
              const b = best(c.id);
              return (
                <div key={c.id} className="surface-card flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-lg font-bold">{getCourseDisplayName(c)}</div>
                    {b >= 0 && <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-semibold">Best {b}%</span>}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> {s.duration} min</span>
                    <span className="flex items-center gap-1"><ListChecks className="size-3.5" /> {s.questionCount} questions</span>
                    <span className="flex items-center gap-1"><Target className="size-3.5" /> Pass {s.passMark}%</span>
                  </div>
                  <Button asChild><Link to="/cbt/$courseId" params={{ courseId: c.id }}>Start test</Link></Button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="My recent tests" icon={History}>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">You haven't taken a test yet.</p>
        ) : (
          <div className="surface-card divide-y">
            {attempts.slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{a.courseName}</div>
                  <div className="text-muted-foreground text-xs">{new Date(a.finishedAt).toLocaleString()} · {a.correct}/{a.total} correct</div>
                </div>
                <span className={a.passed ? "text-success font-bold" : "text-destructive font-bold"}>{a.percent}%</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
