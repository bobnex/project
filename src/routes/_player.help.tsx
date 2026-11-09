import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/help")({
  head: () => pageMeta("Help", "Answers about battles, CBT practice, tournaments, ranks and your account."),
  component: HelpPage,
});

const FAQ: { topic: string; items: [string, string][] }[] = [
  { topic: "Getting started", items: [
    ["Why can't I play yet?", "New accounts must verify their email and be approved by an admin. Check your inbox (and spam) for the verification link."],
    ["How do I change my name or avatar?", "Open Profile to edit your details, and Settings for sound and theme preferences."],
  ]},
  { topic: "Battles", items: [
    ["What game modes are there?", "1v1 quick battles, 2v2 duo rooms and Rush 50 for up to 50 players. Open Battle, pick your courses and start."],
    ["Can I pick more than one course?", "Yes. In the course picker, tick as many courses as you like, or leave it on All courses."],
    ["How do I battle a friend?", "Add them on the Friends page, then invite them or create a private room and share the code."],
    ["Can I talk during a match?", "Yes, turn on voice in the match screen. Your browser will ask for microphone access."],
  ]},
  { topic: "Ranks", items: [
    ["How do I get a rank?", "Finish your placement battles in 1v1, 2v2 or Rush 50. After that, every finished battle moves your RP up or down."],
    ["What is a win streak bonus?", "Winning several battles in a row gives extra RP on each win, up to a limit."],
    ["When do seasons reset?", "Each season lasts a set time. The Rankings page shows how many days are left."],
  ]},
  { topic: "CBT practice", items: [
    ["What is CBT practice?", "Timed solo exams for a course. Each course has its own time, question count and pass mark."],
    ["I don't know a course code", "Course search matches both codes and full course names, so type part of the name."],
  ]},
  { topic: "Tournaments", items: [
    ["How do tournaments work?", "Open Cups, join an open tournament before it starts, then play your fixtures when they appear."],
  ]},
  { topic: "Trouble?", items: [
    ["The app says it's busy or a request failed", "Wait a moment and refresh. If it keeps happening, contact an admin."],
    ["My battle result didn't count", "Results from battles you left early are saved when you return to the app. Reopen it to sync."],
  ]},
];

function HelpPage() {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return FAQ;
    return FAQ.map((g) => ({ ...g, items: g.items.filter(([a, b]) => (a + " " + b).toLowerCase().includes(t)) })).filter((g) => g.items.length);
  }, [q]);

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-3 p-5">
        <h1 className="font-display text-2xl font-extrabold">Help centre</h1>
        <p className="text-muted-foreground text-sm">Find quick answers about playing, ranks and your account.</p>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help…" className="pl-9" />
        </div>
      </section>
      {groups.length === 0 && <p className="text-muted-foreground text-center text-sm">No answers match “{q}”.</p>}
      {groups.map((g) => (
        <section key={g.topic} className="surface-card p-5">
          <h2 className="mb-2 font-display text-lg font-bold">{g.topic}</h2>
          <Accordion type="multiple">
            {g.items.map(([question, answer]) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger className="text-left">{question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
