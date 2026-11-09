import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Award, CalendarClock, Loader2, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { pageMeta } from "@/lib/meta";
import { useSubjects } from "@/lib/subjects";
import { CourseMultiSelect } from "@/components/game/course-multiselect";
import { coursePickLabel, formatCoursePick, parseCoursePick } from "@/lib/course-pick";
import { createTournament, DAY_MS, type TournamentDraft } from "@/lib/tournament-engine";
import { FORMAT_LABELS, STATUS_LABEL, type Tournament, type TournamentFormat } from "@/lib/tournament-rules";

export const Route = createFileRoute("/_player/tournaments/")({
  head: () => pageMeta("Tournaments", "Join knockout cups, group stages and leagues with seasons, promotion and relegation."),
  component: Tournaments,
});

function Tournaments() {
  const { fb, isAdmin } = useApp();
  const [list, setList] = useState<Tournament[] | null>(null);
  const [tab, setTab] = useState<"open" | "live" | "done">("open");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fb) return;
    let alive = true;
    setList(null);
    getDocs(query(collection(fb.db, "tournaments"), orderBy("createdAt", "desc")))
      .then((s) => alive && setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, "id">) }))))
      .catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [fb, tick]);

  const shown = (list ?? []).filter((t) =>
    tab === "open" ? t.status === "registration" : tab === "live" ? t.status === "running" : t.status === "completed" || t.status === "cancelled");

  return (
    <div className="space-y-5">
      <div className="hero-card flex items-center gap-4 p-5">
        <div className="bg-gradient-primary text-primary-foreground shadow-glow grid size-14 shrink-0 place-items-center rounded-2xl">
          <Award className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">Tournaments</h1>
          <p className="text-muted-foreground text-sm">Knockout cups, group stages and leagues with promotion and relegation.</p>
        </div>
        <Button size="icon" variant="outline" aria-label="Refresh tournaments" onClick={() => setTick((t) => t + 1)} disabled={list === null}>
          <RefreshCw className={list === null ? "size-4 animate-spin" : "size-4"} />
        </Button>
        {isAdmin && <CreateTournament />}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="done">Finished</TabsTrigger>
        </TabsList>
      </Tabs>

      {list === null ? (
        <div className="text-muted-foreground flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <Empty icon={Award} title="No tournaments here yet" text={isAdmin ? "Create one with the New button above." : "Check back soon — admins announce new tournaments here."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((t) => (
            <Link key={t.id} to="/tournaments/$tournamentId" params={{ tournamentId: t.id }} className="surface-card pressable block space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold">{t.name}</div>
                <Badge variant={t.status === "running" ? "default" : "secondary"}>{STATUS_LABEL[t.status]}</Badge>
              </div>
              {t.description && <p className="text-muted-foreground line-clamp-2 text-sm">{t.description}</p>}
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>{FORMAT_LABELS[t.format]}{t.format === "league" ? ` · Season ${t.season}` : ""}</span>
                <span className="flex items-center gap-1"><Users className="size-3" />{t.participantCount}/{t.maxParticipants}</span>
                <span>{coursePickLabel(parseCoursePick(t.subject))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTournament() {
  const { fb, user } = useApp();
  const subjects = useSubjects(fb?.db);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "", description: "", format: "elimination" as TournamentFormat, courses: [] as string[],
    requireApproval: false, maxParticipants: 16, questionsPerMatch: 10,
    pointsWin: 3, pointsDraw: 1, pointsLoss: 0,
    divisionCount: 2, divisionNames: "", promoteSlots: 2, relegateSlots: 2, gameweekDays: 2,
    groupSize: 4, qualifiers: 2, durationDays: 14,
  });
  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fb || !user || !f.name.trim()) return;
    setBusy(true);
    try {
      const draft: TournamentDraft = {
        ...f,
        subject: formatCoursePick(f.courses),
        gameweekDays: f.format === "league" ? f.gameweekDays : f.durationDays,
        tiebreakers: ["diff", "won", "for", "name"],
        divisionNames: f.divisionNames.split(",").map((s) => s.trim()).filter(Boolean),
        seasonEndsAt: Date.now() + Math.max(1, f.durationDays) * DAY_MS,
      };
      const id = await createTournament(fb.db, user.uid, draft);
      toast.success("Tournament created — registration is open.");
      setOpen(false);
      navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" />New</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New tournament</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Weekend Cup" /></Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select value={f.format} onValueChange={(v) => setF({ ...f, format: v as TournamentFormat })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((k) => <SelectItem key={k} value={k}>{FORMAT_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Courses">
              <CourseMultiSelect value={f.courses} onChange={(v) => setF({ ...f, courses: v })} subjects={subjects} />
            </Field>
            <Field label="Max players"><Input type="number" min={2} max={256} value={f.maxParticipants} onChange={num("maxParticipants")} /></Field>
            <Field label="Questions per match"><Input type="number" min={3} max={40} value={f.questionsPerMatch} onChange={num("questionsPerMatch")} /></Field>
          </div>

          {f.format !== "elimination" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Win pts"><Input type="number" value={f.pointsWin} onChange={num("pointsWin")} /></Field>
              <Field label="Draw pts"><Input type="number" value={f.pointsDraw} onChange={num("pointsDraw")} /></Field>
              <Field label="Loss pts"><Input type="number" value={f.pointsLoss} onChange={num("pointsLoss")} /></Field>
            </div>
          )}

          {f.format === "groups" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Players per group"><Input type="number" min={2} value={f.groupSize} onChange={num("groupSize")} /></Field>
              <Field label="Qualify per group"><Input type="number" min={1} value={f.qualifiers} onChange={num("qualifiers")} /></Field>
            </div>
          )}

          {f.format === "league" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Divisions"><Input type="number" min={1} max={8} value={f.divisionCount} onChange={num("divisionCount")} /></Field>
                <Field label="Days per gameweek"><Input type="number" min={1} value={f.gameweekDays} onChange={num("gameweekDays")} /></Field>
                <Field label="Promoted per division"><Input type="number" min={0} value={f.promoteSlots} onChange={num("promoteSlots")} /></Field>
                <Field label="Relegated per division"><Input type="number" min={0} value={f.relegateSlots} onChange={num("relegateSlots")} /></Field>
              </div>
              <Field label="Division names (optional, comma separated)"><Input value={f.divisionNames} onChange={(e) => setF({ ...f, divisionNames: e.target.value })} placeholder="Premier Division, Championship" /></Field>
            </div>
          ) : (
            <Field label="Days to play each round"><Input type="number" min={1} value={f.durationDays} onChange={num("durationDays")} /></Field>
          )}

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Admin approves each sign-up</span>
            <Switch checked={f.requireApproval} onCheckedChange={(v) => setF({ ...f, requireApproval: v })} />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}Create tournament
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

