import { clearQuestionCache } from "@/lib/question-cache";
import { CosmeticsAdmin } from "@/components/game/CosmeticsAdmin";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Ban,
  BookOpen,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  Crown,
  Database,
  FileJson,
  Gauge,
  Handshake,
  Loader2,
  Plus,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { IMPORT_EXAMPLE, parseQuestionImport } from "@/lib/question-import";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_RANKED, seasonId, type RankedConfig } from "@/lib/ranked";
import { getRankedConfig, saveRankedConfig } from "@/lib/ranked-store";
import { normalizePayment, normalizeSponsors, type Sponsor, type PaymentDetails } from "@/lib/payment";
import { useApp } from "@/lib/app-context";
import { pageMeta } from "@/lib/meta";
import { addSubject, listSubjects, removeSubject, updateSubject, type SubjectDoc } from "@/lib/subjects";

export const Route = createFileRoute("/_player/admin")({
  head: () => pageMeta("Admin Console", "Manage subjects, questions, players, and game settings."),
  component: AdminPage,
});

interface QuestionDoc {
  id: string;
  course: string;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  reported?: boolean;
}

interface UserRow {
  id: string;
  username?: string;
  email?: string;
  role?: string;
  banned?: boolean;
  rankedSuspended?: boolean;
  rating?: number;
  rp?: number;
  coins?: number;
  level?: number;
  createdAt?: number;
}

function AdminPage() {
  const { user, isAdmin } = useApp();

  if (!isAdmin) {
    return (
      <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
        <ShieldAlert className="text-destructive size-10" />
        <div className="text-lg font-bold">Admin access required</div>
        <p className="text-muted-foreground text-sm max-w-sm">
          Signed in as <span className="font-mono text-foreground">{user?.email ?? "anonymous"}</span>. This account is not listed in the admin directory.
        </p>
        <Button asChild variant="outline">
          <Link to="/home">Return home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Admin Console</h1>
        <p className="text-muted-foreground text-sm">Review players, adjust ranked rules, and manage battle questions.</p>
      </div>

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 rounded-xl">
          <TabsTrigger value="questions"><BookOpen className="size-4" /><span className="hidden sm:inline"> Questions</span></TabsTrigger>
          <TabsTrigger value="players"><Users className="size-4" /><span className="hidden sm:inline"> Players</span></TabsTrigger>
          <TabsTrigger value="ranked"><Shield className="size-4" /><span className="hidden sm:inline"> Ranked</span></TabsTrigger>
          <TabsTrigger value="shop"><Wallet className="size-4" /><span className="hidden sm:inline"> Coin Shop</span></TabsTrigger>
          <TabsTrigger value="app"><Settings2 className="size-4" /><span className="hidden sm:inline"> App</span></TabsTrigger>
          <TabsTrigger value="sponsors"><Handshake className="size-4" /><span className="hidden sm:inline"> Sponsors</span></TabsTrigger>
        </TabsList>

        <TabsContent value="questions"><QuestionsTab /></TabsContent>
        <TabsContent value="players"><PlayersTab /></TabsContent>
        <TabsContent value="ranked"><RankedTab /></TabsContent>
        <TabsContent value="shop"><CosmeticsAdmin /></TabsContent>
        <TabsContent value="app"><AppSettingsTab /></TabsContent>
        <TabsContent value="sponsors"><SponsorsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionsTab() {
  const { fb } = useApp();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<QuestionDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!fb) return;
    listSubjects(fb.db).then(setSubjects);
    getCountFromServer(collection(fb.db, "questions"))
      .then((c) => setTotalCount(c.data().count))
      .catch(() => {});
  }, [fb]);

  useEffect(() => {
    if (!fb) return;
    setLoading(true);
    const q = selectedCourse === "all"
      ? query(collection(fb.db, "questions"), limit(100))
      : query(collection(fb.db, "questions"), where("course", "==", selectedCourse), limit(100));

    getDocs(q)
      .then((snap) => {
        setQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestionDoc, "id">) })));
      })
      .finally(() => setLoading(false));
  }, [fb, selectedCourse]);

  const filtered = questions.filter((q) =>
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.course.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string) {
    if (!fb || !confirm("Delete this question?")) return;
    try {
      await deleteDoc(doc(fb.db, "questions", id));
      setQuestions((cur) => cur.filter((q) => q.id !== id));
      toast.success("Question deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleAddSubject() {
    if (!fb || !newSubject.trim()) return;
    try {
      const added = await addSubject(fb.db, newSubject.trim());
      setSubjects((s) => [...s, added]);
      setNewSubject("");
      toast.success(`Subject "${added.name}" added`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Database className="text-primary size-5" />
          <div>
            <div className="font-semibold">Question Repository</div>
            <div className="text-muted-foreground text-xs">
              {totalCount !== null ? `${totalCount} total questions in database` : "Browse and manage questions"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="size-4" /> Bulk import
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedCourse === "all" ? "default" : "outline"}
            onClick={() => setSelectedCourse("all")}
          >
            All subjects
          </Button>
          {subjects.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={selectedCourse === s.name ? "default" : "outline"}
              onClick={() => setSelectedCourse(s.name)}
            >
              {s.name}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Input
            placeholder="Add new subject..."
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
          />
          <Button size="sm" variant="outline" onClick={handleAddSubject}>
            <Plus className="size-4" /> Add subject
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search loaded questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading questions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          No questions found. Click "Add question" or "Bulk import" to create some.
        </div>
      ) : (
        <div className="surface-card divide-y">
          {filtered.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{q.course}</Badge>
                  {q.reported && <Badge variant="destructive" className="text-xs">Reported</Badge>}
                </div>
                <p className="font-medium text-sm">{q.question}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                  {q.options.map((opt, i) => (
                    <div key={i} className={q.answer === i ? "text-primary font-bold" : ""}>
                      {String.fromCharCode(65 + i)}. {opt} {q.answer === i ? "✓" : ""}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(q.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={() => setSelectedCourse("all")} />}
      {creating && <QuestionEditorDialog course={selectedCourse !== "all" ? selectedCourse : ""} onClose={() => setCreating(false)} onSaved={(q) => setQuestions((cur) => [q, ...cur])} />}
      {editing && <QuestionEditorDialog question={editing} onClose={() => setEditing(null)} onSaved={(q) => setQuestions((cur) => cur.map((x) => x.id === q.id ? q : x))} />}
    </div>
  );
}

function QuestionEditorDialog({ question, course, onClose, onSaved }: { question?: QuestionDoc; course?: string; onClose: () => void; onSaved: (q: QuestionDoc) => void }) {
  const { fb } = useApp();
  const [c, setC] = useState(question?.course ?? course ?? "");
  const [text, setText] = useState(question?.question ?? "");
  const [opts, setOpts] = useState<string[]>(question?.options ?? ["", "", "", ""]);
  const [ans, setAns] = useState(question?.answer ?? 0);
  const [exp, setExp] = useState(question?.explanation ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!fb) return;
    if (!c.trim()) return toast.error("Course/subject is required");
    if (!text.trim()) return toast.error("Question text is required");
    if (opts.some((o) => !o.trim())) return toast.error("All 4 options must be filled");

    setSaving(true);
    try {
      const data = {
        course: c.trim(),
        question: text.trim(),
        options: opts.map((o) => o.trim()),
        answer: ans,
        explanation: exp.trim() || null,
        reported: false,
      };

      if (question?.id) {
        await updateDoc(doc(fb.db, "questions", question.id), data);
        onSaved({ id: question.id, ...data, explanation: data.explanation ?? undefined });
        toast.success("Question updated");
      } else {
        const ref = await addDoc(collection(fb.db, "questions"), data);
        onSaved({ id: ref.id, ...data, explanation: data.explanation ?? undefined });
        toast.success("Question created");
      }
      clearQuestionCache();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{question ? "Edit Question" : "New Question"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Course / Subject</Label>
            <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <div className="space-y-1">
            <Label>Question</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type the question..." />
          </div>
          <div className="space-y-2">
            <Label>Options (select the correct radio)</Label>
            {opts.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-answer"
                  checked={ans === i}
                  onChange={() => setAns(i)}
                  className="size-4"
                />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...opts];
                    next[i] = e.target.value;
                    setOpts(next);
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>Explanation (optional)</Label>
            <Textarea rows={2} value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Why is this the answer?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { fb } = useApp();
  const [raw, setRaw] = useState("");
  const [course, setCourse] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleImport() {
    if (!fb) return;
    try {
      const parsed = parseQuestionImport(raw, course);
      if (parsed.length === 0) return toast.error("No valid questions found in payload");
      setBusy(true);

      const batch = writeBatch(fb.db);
      for (const q of parsed) {
        const ref = doc(collection(fb.db, "questions"));
        batch.set(ref, q);
      }
      await batch.commit();
      clearQuestionCache();
      toast.success(`Imported ${parsed.length} questions successfully`);
      onImported();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Questions</DialogTitle>
          <DialogDescription>Paste JSON array or line-delimited format.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Default subject (if not specified in rows)</Label>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Chemistry" />
          </div>
          <div className="space-y-1">
            <Label>Questions JSON / Text</Label>
            <Textarea
              rows={10}
              className="font-mono text-xs"
              placeholder={IMPORT_EXAMPLE}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleImport} disabled={busy || !raw.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : "Import questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayersTab() {
  const { fb } = useApp();
  const [players, setPlayers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!fb) return;
    setLoading(true);
    getDocs(query(collection(fb.db, "users"), orderBy("createdAt", "desc"), limit(100)))
      .then((s) => {
        setPlayers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
      })
      .finally(() => setLoading(false));
  }, [fb]);

  async function toggleBan(p: UserRow) {
    if (!fb) return;
    const next = !p.banned;
    try {
      await updateDoc(doc(fb.db, "users", p.id), { banned: next });
      setPlayers((cur) => cur.map((x) => x.id === p.id ? { ...x, banned: next } : x));
      toast.success(next ? `Banned ${p.username ?? p.id}` : `Unbanned ${p.username ?? p.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleRankedSuspend(p: UserRow) {
    if (!fb) return;
    const next = !p.rankedSuspended;
    try {
      await updateDoc(doc(fb.db, "users", p.id), { rankedSuspended: next });
      setPlayers((cur) => cur.map((x) => x.id === p.id ? { ...x, rankedSuspended: next } : x));
      toast.success(next ? `Suspended ranked access for ${p.username ?? p.id}` : `Restored ranked access`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = players.filter((p) =>
    (p.username ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search players by username, email, or user ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading players...
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">No players match the search.</div>
      ) : (
        <div className="surface-card divide-y">
          {filtered.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{p.username ?? "Anonymous"}</span>
                  {p.role === "admin" && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                  {p.banned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                  {p.rankedSuspended && <Badge variant="outline" className="text-xs border-destructive text-destructive">Ranked suspended</Badge>}
                </div>
                <div className="text-muted-foreground text-xs font-mono">{p.email ?? p.id}</div>
                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span>Rating: {p.rating ?? 0}</span>
                  <span>RP: {p.rp ?? 0}</span>
                  <span>Coins: {p.coins ?? 0}</span>
                  <span>Level: {p.level ?? 1}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={p.rankedSuspended ? "default" : "outline"}
                  onClick={() => toggleRankedSuspend(p)}
                >
                  {p.rankedSuspended ? "Unsuspend Ranked" : "Suspend Ranked"}
                </Button>
                <Button
                  size="sm"
                  variant={p.banned ? "secondary" : "destructive"}
                  onClick={() => toggleBan(p)}
                >
                  {p.banned ? "Unban" : "Ban"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RANKED_NUMBERS: { key: keyof RankedConfig; label: string; hint: string }[] = [
  { key: "winRp", label: "Victory RP", hint: "Added on a win" },
  { key: "lossRp", label: "Defeat RP", hint: "Removed on a loss" },
  { key: "drawRp", label: "Draw RP", hint: "Added on a draw" },
  { key: "placementMatches", label: "Placement matches", hint: "Battles before a rank is given" },
  { key: "placementWinRp", label: "RP per placement win", hint: "Starting RP = wins × this" },
  { key: "mmBaseRange", label: "Match range (RP)", hint: "Starting RP gap allowed" },
  { key: "mmExpandPerSec", label: "Range growth / sec", hint: "Gap widens while waiting" },
  { key: "mmMaxRange", label: "Max match range", hint: "Widest RP gap allowed" },
  { key: "seasonResetPct", label: "Season keep %", hint: "RP kept at season reset" },
  { key: "streakBonusRp", label: "Streak bonus RP", hint: "Extra RP per win on a streak" },
  { key: "streakBonusFrom", label: "Streak starts at", hint: "Wins in a row before bonus" },
  { key: "streakBonusMax", label: "Max streak bonus", hint: "Bonus RP cap per win" },
  { key: "demotionShield", label: "Demotion shield", hint: "Losses forgiven before dropping a rank (0 = off)" },
];

function RankedTab() {
  const { fb } = useApp();
  const [cfg, setCfg] = useState<RankedConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fb) getRankedConfig(fb.db, true).then(setCfg);
  }, [fb]);

  if (!cfg) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading ranked settings…
      </div>
    );
  }

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  async function save() {
    const tiers = cfg!.tiers;
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].min <= tiers[i - 1].min) return toast.error(`${tiers[i].name} must start above ${tiers[i - 1].name}`);
    }
    if (cfg!.placementMatches < 1) return toast.error("Placement matches must be at least 1");
    setSaving(true);
    try {
      await saveRankedConfig(fb!.db, cfg!);
      toast.success("Ranked settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="font-semibold">Ranked RP enabled</div>
          <div className="text-muted-foreground text-xs">When off, ranked battles still count for stats but RP doesn't change.</div>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
      </div>

      {/* Ranked Season Manager */}
      <div className="surface-card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <div className="font-semibold">Ranked Season & Countdown</div>
              <div className="text-muted-foreground text-xs">
                Active: <span className="font-bold text-foreground">{seasonId(Date.now(), cfg)}</span>
                {cfg.seasonEndsAt ? ` · Ends ${new Date(cfg.seasonEndsAt).toLocaleDateString()} (${Math.max(0, Math.ceil((cfg.seasonEndsAt - Date.now()) / 86400000))}d left)` : " · Automatic quarter ends"}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              const nextNum = (cfg.seasonNumber ?? 1) + 1;
              const nextEnd = Date.now() + 30 * 86400000;
              setCfg({
                ...cfg,
                seasonNumber: nextNum,
                seasonName: `Season ${nextNum}`,
                seasonStartedAt: Date.now(),
                seasonEndsAt: nextEnd,
              });
              toast.info(`Pre-filled Season ${nextNum} (30 days). Click "Save ranked settings" to start!`);
            }}
          >
            <Sparkles className="mr-1.5 size-3.5" /> Start next season
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="season-num">Season number</Label>
            <Input
              id="season-num"
              type="number"
              min={1}
              value={cfg.seasonNumber ?? 1}
              onChange={(e) => {
                const n = Math.max(1, Math.round(Number(e.target.value) || 1));
                setCfg({
                  ...cfg,
                  seasonNumber: n,
                  seasonName: !cfg.seasonName || cfg.seasonName.startsWith("Season ") ? `Season ${n}` : cfg.seasonName,
                });
              }}
            />
            <div className="text-muted-foreground text-[11px]">Starts from 1, increments with each new season</div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="season-name">Season display label</Label>
            <Input
              id="season-name"
              placeholder="e.g. Season 1, Season 1: Champions"
              value={cfg.seasonName ?? `Season ${cfg.seasonNumber ?? 1}`}
              onChange={(e) => setCfg({ ...cfg, seasonName: e.target.value })}
            />
            <div className="text-muted-foreground text-[11px]">Shown on player profiles and rankings pill</div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="season-end">Season end date & time</Label>
            <Input
              id="season-end"
              type="datetime-local"
              value={
                cfg.seasonEndsAt
                  ? new Date(cfg.seasonEndsAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setCfg({ ...cfg, seasonEndsAt: undefined });
                } else {
                  setCfg({ ...cfg, seasonEndsAt: new Date(val).getTime() });
                }
              }}
            />
            <div className="text-muted-foreground text-[11px]">Date when season countdown hits 0 and resets</div>
          </div>
        </div>

        {/* Quick end-date presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-muted-foreground text-xs font-medium mr-1">Quick duration:</span>
          {[
            { label: "+14 Days", days: 14 },
            { label: "+30 Days", days: 30 },
            { label: "+60 Days", days: 60 },
            { label: "+90 Days", days: 90 },
          ].map((preset) => (
            <Button
              key={preset.days}
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs px-2.5"
              onClick={() => {
                const end = Date.now() + preset.days * 86400000;
                setCfg({ ...cfg, seasonEndsAt: end });
              }}
            >
              {preset.label}
            </Button>
          ))}
          {cfg.seasonEndsAt && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setCfg({ ...cfg, seasonEndsAt: undefined })}
            >
              Clear end date
            </Button>
          )}
        </div>
      </div>

      <div className="surface-card grid gap-3 p-4 sm:grid-cols-3">
        {RANKED_NUMBERS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`rk-${String(f.key)}`}>{f.label}</Label>
            <Input
              id={`rk-${String(f.key)}`}
              type="number"
              min={0}
              value={cfg[f.key] as number}
              onChange={(e) => setCfg({ ...cfg, [f.key]: num(e.target.value) })}
            />
            <div className="text-muted-foreground text-[11px]">{f.hint}</div>
          </div>
        ))}
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="font-semibold">Tier thresholds (starting RP)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cfg.tiers.map((t, i) => (
            <div key={t.name} className="space-y-1">
              <Label htmlFor={`tier-${i}`} className="flex items-center gap-1.5">
                <Shield className="size-3.5" style={{ color: t.color, fill: t.color }} />
                {t.name}
              </Label>
              <Input
                id={`tier-${i}`}
                type="number"
                min={0}
                disabled={i === 0}
                value={t.min}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    tiers: cfg.tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />} Save ranked settings
        </Button>
        <Button variant="outline" onClick={() => setCfg(DEFAULT_RANKED)}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function AppSettingsTab() {
  const { fb, settings } = useApp();
  const [ghostWaitSeconds, setGhostWaitSeconds] = useState(settings.ghostWaitSeconds ?? 20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGhostWaitSeconds(settings.ghostWaitSeconds ?? 20);
  }, [settings.ghostWaitSeconds]);

  async function saveGhostWait(secs: number) {
    if (!fb) return;
    const clamped = Math.max(5, Math.min(120, secs));
    setSaving(true);
    try {
      await setDoc(doc(fb.db, "settings", "app"), { ghostWaitSeconds: clamped }, { merge: true });
      setGhostWaitSeconds(clamped);
      toast.success(`Ghost rival button will appear after ${clamped}s`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Clock className="text-primary size-5" />
          <div>
            <div className="font-semibold">Ghost Rivals Matchmaking Delay</div>
            <div className="text-muted-foreground text-xs">
              How many seconds a player waits in 1v1 matchmaking before the "Ghost Rival" option pops up.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {[10, 15, 20, 25, 30, 45, 60].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={ghostWaitSeconds === s ? "default" : "outline"}
              onClick={() => saveGhostWait(s)}
              disabled={saving}
            >
              {s}s
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 max-w-xs">
          <Input
            type="number"
            min={5}
            max={120}
            value={ghostWaitSeconds}
            onChange={(e) => setGhostWaitSeconds(Number(e.target.value) || 20)}
          />
          <Button
            size="sm"
            onClick={() => saveGhostWait(ghostWaitSeconds)}
            disabled={saving}
          >
            Save seconds
          </Button>
        </div>
      </div>

      <PaymentDetailsCard />
      <CbtSettingsCard />
    </div>
  );
}

function CbtSettingsCard() {
  const { fb } = useApp();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [sel, setSel] = useState<string>("");

  useEffect(() => {
    if (fb) listSubjects(fb.db).then((s) => { setSubjects(s); if (s[0]) setSel(s[0].id); });
  }, [fb]);

  const curr = subjects.find((s) => s.id === sel);

  return (
    <div className="surface-card space-y-3 p-4">
      <div>
        <div className="font-semibold">CBT Course Settings</div>
        <div className="text-muted-foreground text-xs">Configure exam duration, pass mark, and question counts per subject.</div>
      </div>
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select course..." /></SelectTrigger>
        <SelectContent>
          {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {curr && <CbtSubjectEditor key={curr.id} doc={curr} onSaved={(u) => setSubjects((cur) => cur.map((x) => x.id === u.id ? u : x))} />}
    </div>
  );
}

function CbtSubjectEditor({ doc: d0, onSaved }: { doc: SubjectDoc; onSaved: (u: SubjectDoc) => void }) {
  const { fb } = useApp();
  const [d, setD] = useState({
    duration: d0.cbtDuration ?? 30,
    questionCount: d0.cbtQuestionCount ?? 40,
    passMark: d0.cbtPassMark ?? 50,
    instructions: d0.cbtInstructions ?? "",
  });

  async function save(patch: Partial<SubjectDoc>) {
    if (!fb) return;
    try {
      await updateSubject(fb.db, d0.id, patch);
      onSaved({ ...d0, ...patch });
      toast.success("CBT settings updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Duration (mins)</Label>
          <Input type="number" min={5} value={d.duration} onChange={(e) => setD({ ...d, duration: Number(e.target.value) })} />
        </div>
        <div className="space-y-1">
          <Label>Question count</Label>
          <Input type="number" min={5} value={d.questionCount} onChange={(e) => setD({ ...d, questionCount: Number(e.target.value) })} />
        </div>
        <div className="space-y-1">
          <Label>Pass mark (%)</Label>
          <Input type="number" min={1} max={100} value={d.passMark} onChange={(e) => setD({ ...d, passMark: Number(e.target.value) })} />
        </div>
      </div>
      <Textarea rows={2} placeholder="Instructions shown before the test (optional)" value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} />
      <Button size="sm" onClick={() => save({ cbtDuration: d.duration, cbtQuestionCount: d.questionCount, cbtPassMark: d.passMark, cbtInstructions: d.instructions })}>Save settings</Button>
    </div>
  );
}

function PaymentDetailsCard() {
  const { fb, settings } = useApp();
  const [p, setP] = useState<PaymentDetails>(settings.payment);
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(settings.payment), [settings.payment]);
  const set = (k: keyof PaymentDetails) => (e: { target: { value: string } }) => setP({ ...p, [k]: k === "fee" ? Number(e.target.value) : e.target.value });

  async function save() {
    if (!p.bank.trim() || !p.accountNumber.trim() || !p.accountName.trim()) return toast.error("Bank, account number and account name are required");
    if (!(p.fee >= 0)) return toast.error("Fee must be 0 or more");
    setSaving(true);
    try {
      await setDoc(doc(fb!.db, "settings", "app"), { payment: normalizePayment(p) }, { merge: true });
      toast.success("Payment details saved — new sign-ups will see them");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <div>
        <div className="font-semibold">Payment details</div>
        <div className="text-muted-foreground text-xs">Shown to new players on the sign-up page.</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Bank name</Label>
          <Input value={p.bank} onChange={set("bank")} placeholder="e.g. Kuda, OPay, GTBank" />
        </div>
        <div className="space-y-1">
          <Label>Account number</Label>
          <Input value={p.accountNumber} onChange={set("accountNumber")} placeholder="10-digit number" />
        </div>
        <div className="space-y-1">
          <Label>Account name</Label>
          <Input value={p.accountName} onChange={set("accountName")} placeholder="Account holder name" />
        </div>
        <div className="space-y-1">
          <Label>Registration fee (₦)</Label>
          <Input type="number" min={0} value={p.fee} onChange={set("fee")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Payment note / instructions</Label>
        <Input value={p.note ?? ""} onChange={set("note")} placeholder="e.g. Use your username as transfer narration" />
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : "Save payment details"}
      </Button>
    </div>
  );
}

function SponsorsTab() {
  const { fb, settings } = useApp();
  const [sponsors, setSponsors] = useState<Sponsor[]>(settings.sponsors ?? []);
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setSponsors(settings.sponsors ?? []), [settings.sponsors]);

  async function save(list: Sponsor[]) {
    if (!fb) return;
    setSaving(true);
    try {
      await setDoc(doc(fb.db, "settings", "app"), { sponsors: normalizeSponsors(list) }, { merge: true });
      setSponsors(list);
      toast.success("Sponsors updated");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  function add() {
    if (!next.trim()) return;
    const clean = next.trim();
    if (sponsors.some(s => s.name.toLowerCase() === clean.toLowerCase())) return toast.error("Already in sponsors list");
    const updated = [...sponsors, { id: crypto.randomUUID(), name: clean, tagline: "", url: "", active: true }];
    setNext("");
    save(updated);
  }

  function remove(idx: number) {
    save(sponsors.filter((_, i) => i !== idx));
  }

  return (
    <div className="surface-card space-y-4 p-4">
      <div>
        <div className="font-semibold">Battle Sponsors</div>
        <div className="text-muted-foreground text-xs">Sponsor names cycled on battle loading screens and match banners.</div>
      </div>
      <div className="flex gap-2">
        <Input placeholder="Sponsor brand or individual name..." value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={saving}><Plus className="size-4" /> Add</Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {sponsors.length === 0 ? (
          <span className="text-muted-foreground text-xs">No custom sponsors added yet.</span>
        ) : (
          sponsors.map((s, i) => (
            <Badge key={i} variant="secondary" className="flex items-center gap-1.5 py-1 text-sm">
              {s.name}
              <button type="button" onClick={() => remove(i)} className="hover:text-destructive">
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
