import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Check, CircleSlash, ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, FullLoader, Section } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { loadQuestions, type Question } from "@/lib/engine";
import type { Match } from "@/lib/game-rules";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/review/$matchId")({
  head: () => pageMeta("Battle review", "Review every question, your answer and the correct answer from a past battle."),
  component: Review,
});

function Review() {
  const { matchId } = Route.useParams();
  const { fb, user } = useApp();
  const [match, setMatch] = useState<Match | null>(null);
  const [qs, setQs] = useState<Record<string, Question>>({});
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!fb) return;
    (async () => {
      try {
        const s = await getDoc(doc(fb.db, "matches", matchId));
        if (!s.exists()) return setState("missing");
        const m = { id: s.id, ...(s.data() as Omit<Match, "id">) };
        setMatch(m);
        setQs(await loadQuestions(fb.db, m.questionIds, m.id));
        setState("ok");
      } catch {
        setState("missing");
      }
    })();
  }, [fb, matchId]);

  if (state === "loading") return <FullLoader label="Loading review" />;
  const back = <Button asChild variant="ghost" size="sm"><Link to="/profile"><ArrowLeft /> Back</Link></Button>;
  if (state === "missing" || !match || !user) return <div className="space-y-4">{back}<Empty icon={ClipboardList} title="Review not available" text="This battle could not be found." /></div>;

  const me = match.players[user.uid];
  const asked = match.questionIds.slice(0, match.currentIndex + 1);
  const correctCount = asked.filter((_, i) => me?.answers?.[String(i)]?.correct).length;

  return (
    <div className="space-y-6">
      {back}
      <Section title={`Question review · ${correctCount}/${asked.length} correct`} icon={ClipboardList}>
        <div className="space-y-3">
          {asked.map((qid, i) => {
            const q = qs[qid];
            const a = me?.answers?.[String(i)];
            if (!q) return null;
            return (
              <div key={qid + i} className="surface-card space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <span className="tabular text-muted-foreground text-sm font-bold">{i + 1}.</span>
                  <p className="flex-1 text-sm font-semibold">{q.text}</p>
                  {!a ? <CircleSlash className="text-muted-foreground size-5 shrink-0" /> : a.correct ? <Check className="text-success size-5 shrink-0" /> : <X className="text-destructive size-5 shrink-0" />}
                </div>
                <div className="grid gap-2">
                  {q.options.map((o, oi) => {
                    const isRight = oi === q.correctIndex;
                    const isMine = a?.choice === oi;
                    const cls = isRight ? "border-success bg-success/12" : isMine ? "border-destructive bg-destructive/12" : "border-border";
                    return (
                      <div key={oi} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="flex-1">{o}</span>
                        {isMine && <span className="text-muted-foreground text-xs">Your answer</span>}
                        {isRight && <Check className="text-success size-4" />}
                      </div>
                    );
                  })}
                </div>
                {!a && <p className="text-muted-foreground text-xs">Not answered</p>}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
