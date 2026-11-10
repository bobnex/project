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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerAvatar } from "@/components/game/Avatar";
import { Empty, Stat } from "@/components/game/ui";
import { useApp, type Profile } from "@/lib/app-context";
import { SEED_QUESTIONS } from "@/lib/seed-questions";
import { cleanSubjectFullName, getCourseDisplayName, registerSubjects, subjectKey, useSubjects, type Subject } from "@/lib/subjects";
import { cbtSettings } from "@/lib/cbt-rules";
import { THEMES } from "@/lib/themes";
import { adminCancelMatch, adminEndMatch, type Question } from "@/lib/engine";
import type { Match } from "@/lib/game-rules";
import { pageMeta } from "@/lib/meta";
import { DEFAULT_PAYMENT, newSponsor, normalizePayment, normalizeSponsors, type PaymentDetails, type Sponsor } from "@/lib/payment";
import { getRankedConfig, saveRankedConfig } from "@/lib/ranked-store";
import { DEFAULT_RANKED, type RankedConfig } from "@/lib/ranked";
import { generateQuestionPack } from "@/lib/ai";

export const Route = createFileRoute("/_player/admin")({
  head: () => pageMeta("Admin Centre", "Manage questions, players and app settings."),
  component: AdminDashboard,
});

export function AdminDashboard() {
  const { isAdmin } = useApp();
  if (!isAdmin)
    return <Empty icon={ShieldAlert} title="Admins only" text="You need an admin role to open this page." />;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 gap-2 rounded-xl sm:grid-cols-5">
        <TabsTrigger value="overview"><Gauge className="size-4" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
        <TabsTrigger value="questions"><BookOpen className="size-4" /><span className="hidden sm:inline">Questions</span></TabsTrigger>
        <TabsTrigger value="cbt"><ClipboardList className="size-4" /><span className="hidden sm:inline">CBT</span></TabsTrigger>
        <TabsTrigger value="users"><Users className="size-4" /><span className="hidden sm:inline">Players</span></TabsTrigger>
        <TabsTrigger value="payments"><Wallet className="size-4" /><span className="hidden sm:inline">Payments</span></TabsTrigger>
        <TabsTrigger value="shop"><Sparkles className="size-4" /><span className="hidden sm:inline">Coin shop</span></TabsTrigger>
        <TabsTrigger value="sponsors"><Handshake className="size-4" /><span className="hidden sm:inline">Sponsors</span></TabsTrigger>
        <TabsTrigger value="battles"><Swords className="size-4" /><span className="hidden sm:inline">Battles</span></TabsTrigger>
        <TabsTrigger value="ranked"><Shield className="size-4" /><span className="hidden sm:inline">Ranked</span></TabsTrigger>
        <TabsTrigger value="settings"><Settings2 className="size-4" /><span className="hidden sm:inline">Settings</span></TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><Overview /></TabsContent>
      <TabsContent value="questions"><Questions /></TabsContent>
      <TabsContent value="cbt"><CbtCourses /></TabsContent>
      <TabsContent value="users"><Players /></TabsContent>
      <TabsContent value="payments"><Payments /></TabsContent>
      <TabsContent value="shop"><CosmeticsAdmin /></TabsContent>
      <TabsContent value="sponsors"><SponsorsTab /></TabsContent>
      <TabsContent value="battles"><Battles /></TabsContent>
      <TabsContent value="ranked"><RankedTab /></TabsContent>
      <TabsContent value="settings"><AppSettingsTab /></TabsContent>
    </Tabs>
  );
}

function Admin() {
  return <AdminDashboard />;
}

const PAYMENT_STATUS_VALUES = ["pending", "confirmed", "rejected"] as const;

type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

async function updateUserPaymentStatus(fb: NonNullable<ReturnType<typeof useApp>["fb"]>, userId: string, paymentStatus: PaymentStatus) {
  const updates: Record<string, unknown> = { paymentStatus };
  if (paymentStatus === "confirmed") updates.status = "approved";
  else if (paymentStatus === "rejected") updates.status = "rejected";
  else updates.status = "pending";
  await updateDoc(doc(fb.db, "users", userId), updates);
}

function Overview() {
  const { fb } = useApp();
  const [c, setC] = useState({ users: 0, questions: 0, matches: 0, pendingPayments: 0, confirmedPayments: 0 });

  useEffect(() => {
    if (!fb) return;

    const count = (q: Parameters<typeof getCountFromServer>[0]) =>
      getCountFromServer(q).then((s) => s.data().count).catch(() => 0);
    const users = collection(fb.db, "users");
    let alive = true;
    Promise.all([
      count(users),
      count(collection(fb.db, "questions")),
      count(collection(fb.db, "matches")),
      count(query(users, where("paymentStatus", "==", "pending"))),
      count(query(users, where("paymentStatus", "==", "rejected"))),
    ]).then(([u, questions, matches, pending, rejected]) => {
      if (alive) setC({ users: u, questions, matches, pendingPayments: pending, confirmedPayments: Math.max(0, u - pending - rejected) });
    });
    return () => { alive = false; };
  }, [fb]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat label="Players" value={c.users} icon={Users} />
      <Stat label="Questions" value={c.questions} icon={BookOpen} tone="accent" />
      <Stat label="Battles" value={c.matches} icon={Swords} tone="success" />
      <Stat label="Pending payments" value={c.pendingPayments} icon={Wallet} tone="warning" />
      <Stat label="Confirmed" value={c.confirmedPayments} icon={Check} tone="success" />
    </div>
  );
}

function Payments() {
  const { fb } = useApp();
  const [rows, setRows] = useState<(Profile & { id: string })[]>([]);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(query(collection(fb.db, "users"), where("paymentStatus", "==", "pending"), limit(50)), (s) => {
      setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Profile) })).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)));
    }, () => {});
  }, [fb]);

  const pending = rows;

  async function setPayment(userId: string, nextStatus: PaymentStatus) {
    if (!fb) return;
    try {
      await updateUserPaymentStatus(fb, userId, nextStatus);
      toast.success(`Payment marked as ${nextStatus}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <PaymentDetailsCard />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Pending" value={pending.length} icon={Wallet} tone="warning" />
      </div>

      <div className="surface-card divide-y">
        {rows.length === 0 && <div className="text-muted-foreground p-4 text-sm">No pending payments. You are all caught up.</div>}
        {rows.map((u) => {
          const paymentStatus = u.paymentStatus ?? "confirmed";
          return (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
              <PlayerAvatar name={u.username} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{u.username}</div>
                <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                <div className="text-muted-foreground mt-1 text-[11px]">
                  Sender: {u.paymentSender ?? "—"} · Ref: {u.paymentRef || "—"} · Amount: ₦{u.paymentAmount ?? "0"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  paymentStatus === "pending" ? "bg-yellow-500/15 text-yellow-600" :
                  paymentStatus === "confirmed" ? "bg-emerald-500/15 text-emerald-600" :
                  "bg-red-500/15 text-red-600"
                }`}>
                  {paymentStatus}
                </span>
                <Button size="sm" variant="outline" onClick={() => setPayment(u.id, "confirmed")} disabled={paymentStatus === "confirmed"}><Check className="size-3.5" /> Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setPayment(u.id, "rejected")} disabled={paymentStatus === "rejected"}><X className="size-3.5" /> Reject</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Questions() {
  const { fb } = useApp();
  const [items, setItems] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);
  const subjects = useSubjects(fb?.db);
  const empty = { text: "", options: ["", "", "", ""], correctIndex: 0, subject: "", topic: "", difficulty: "medium" as const };
  const [f, setF] = useState(empty);
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (!fb || !items.length) return;
    registerSubjects(fb.db, subjects, items.map((q) => q.subject)).catch(() => {});
  }, [fb, items, subjects]);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(query(collection(fb.db, "questions"), limit(300)), (s) => {
      setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Question, "id">) })));
    }, () => {});
  }, [fb]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.text.trim() || !f.subject.trim() || f.options.some((o) => !o.trim())) {
      return toast.error("Fill the question, subject and all four options.");
    }
    const { canonicalName } = await registerSubjects(fb!.db, subjects, [f.subject]);
    await addDoc(collection(fb!.db, "questions"), { ...f, subject: canonicalName(f.subject), active: true, createdAt: Date.now() });
    clearQuestionCache();
    setF(empty);
    toast.success("Question added");
  }

  async function generateAndAdd() {
    if (!fb) return;
    const subject = (aiSubject || f.subject || "General Knowledge").trim();
    const topic = (aiTopic || f.topic || "General").trim();
    if (!subject) return toast.error("Choose or enter a course/subject for the AI-generated questions.");
    setAiBusy(true);
    try {
      const generated = await generateQuestionPack({
        subject,
        topic,
        prompt: aiPrompt || `Create ${aiCount} multiple-choice questions for ${subject} in ${topic}.`,
        count: aiCount,
      });
      const { canonicalName } = await registerSubjects(fb.db, subjects, [subject]);
      const batch = writeBatch(fb.db);
      generated.forEach((q) => {
        const canonicalSubject = canonicalName(subject);
        batch.set(doc(collection(fb.db, "questions")), {
          subject: canonicalSubject,
          topic: q.topic || topic,
          difficulty: q.difficulty,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          active: true,
          createdAt: Date.now(),
        });
      });
      await batch.commit();
      clearQuestionCache();
      setAiPrompt("");
      setAiSubject("");
      setAiTopic("");
      toast.success(`Generated and saved ${generated.length} AI questions.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    try {
      const { canonicalName } = await registerSubjects(fb!.db, subjects, SEED_QUESTIONS.map((q) => q.subject));
      const b = writeBatch(fb!.db);
      SEED_QUESTIONS.forEach((q) => b.set(doc(collection(fb!.db, "questions")), { ...q, subject: canonicalName(q.subject), active: true, createdAt: Date.now() }));
      await b.commit();
      clearQuestionCache();
      toast.success(`Added ${SEED_QUESTIONS.length} starter questions`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <BulkImport />
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold"><Sparkles className="size-4" /> AI generate questions</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Course / subject" value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} />
          <Input placeholder="Topic (optional)" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
          <Input type="number" min={1} max={10} value={aiCount} onChange={(e) => setAiCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <Textarea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Optional custom prompt, e.g. 'Create beginner-level biology questions with exam-style wording'" />
        <Button onClick={generateAndAdd} disabled={aiBusy}>{aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} {aiBusy ? "Generating..." : "Generate with AI"}</Button>
      </div>
      <form onSubmit={add} className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Add a question</h3>
          <Button type="button" variant="outline" size="sm" onClick={seed} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Database />} Load {SEED_QUESTIONS.length} starter questions
          </Button>
        </div>
        <Textarea placeholder="Question text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          {f.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={f.correctIndex === i} onChange={() => setF({ ...f, correctIndex: i })} aria-label={`Option ${"ABCD"[i]} is correct`} className="accent-primary" />
              <Input placeholder={`Option ${"ABCD"[i]}`} value={o} onChange={(e) => { const opts = [...f.options]; opts[i] = e.target.value; setF({ ...f, options: opts }); }} />
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input list="subject-options" placeholder="Subject (pick or type new)" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <datalist id="subject-options">{subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          <Input placeholder="Topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          <Button type="submit"><Plus /> Add question</Button>
        </div>
        <p className="text-muted-foreground text-xs">Pick the radio button next to the correct answer.</p>
      </form>

      <div className="surface-card divide-y">
        {items.length === 0 && <div className="text-muted-foreground p-4 text-sm">No questions yet. Load the starter set or add your own.</div>}
        {items.map((q) => (
          <div key={q.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{q.text}</div>
              <div className="text-muted-foreground text-xs">{q.subject} · Answer: {q.options[q.correctIndex]}</div>
            </div>
            <Switch checked={q.active} onCheckedChange={(v) => updateDoc(doc(fb!.db, "questions", q.id), { active: v })} aria-label="Active" />
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => confirm("Delete this question?") && deleteDoc(doc(fb!.db, "questions", q.id))}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkImport() {
  const { fb } = useApp();
  const subjects = useSubjects(fb?.db);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setRaw(await file.text());
    e.target.value = "";
  }

  async function run() {
    const { questions, errors } = parseQuestionImport(raw);
    if (errors.length) toast.error(`${errors.length} skipped: ${errors.slice(0, 3).join("; ")}`);
    if (!questions.length) return;
    setBusy(true);
    try {
      const { added, canonicalName } = await registerSubjects(fb!.db, subjects, questions.map((q) => q.subject));
      questions.forEach((q) => (q.subject = canonicalName(q.subject)));
      if (added.length) toast.success(`New subjects added: ${added.map((a) => a.name).join(", ")}`);
      for (let i = 0; i < questions.length; i += 450) {
        const b = writeBatch(fb!.db);
        questions.slice(i, i + 450).forEach((q) => b.set(doc(collection(fb!.db, "questions")), { ...q, active: true, createdAt: Date.now() }));
        await b.commit();
        clearQuestionCache();
      }
      toast.success(`Imported ${questions.length} questions`);
      setRaw("");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><FileJson className="size-4" /> Bulk import (JSON)</h3>
        <Button asChild variant="outline" size="sm">
          <label className="cursor-pointer"><Upload /> Choose file<input type="file" accept=".json,application/json" className="hidden" onChange={onFile} /></label>
        </Button>
      </div>
      <Textarea rows={8} className="font-mono text-xs" placeholder={IMPORT_EXAMPLE} value={raw} onChange={(e) => setRaw(e.target.value)} />
      <p className="text-muted-foreground text-xs">Each item needs "course", "topic", "question", "options" and "answer" (option number starting at 0, or the option text). "difficulty" is optional.</p>
      <Button onClick={run} disabled={busy || !raw.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Import questions</Button>
    </div>
  );
}

function Players() {
  const { fb } = useApp();
  const [rows, setRows] = useState<(Profile & { id: string })[]>([]);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(query(collection(fb.db, "users"), orderBy("createdAt", "desc"), limit(25)), (s) => {
      setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Profile) })));
    }, () => {});
  }, [fb]);

  const updateStatus = async (id: string, status: Profile["status"]) => {
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, "users", id), { status });
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateEmailVerification = async (id: string, verified: boolean) => {
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, "users", id), { emailVerified: verified });
      toast.success(verified ? "Email marked as verified." : "Email marked as unverified.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updatePayment = async (id: string, nextStatus: PaymentStatus) => {
    if (!fb) return;
    try {
      await updateUserPaymentStatus(fb, id, nextStatus);
      toast.success(`Payment status updated to ${nextStatus}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="surface-card divide-y">
      {rows.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
          <PlayerAvatar name={u.username} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{u.username}</div>
            <div className="text-muted-foreground truncate text-xs">{u.email} · {u.battles} battles · {u.rating} SR</div>
            <div className="text-muted-foreground mt-1 text-[11px]">
              Payment: {u.paymentStatus ?? "confirmed"} · Sender: {u.paymentSender ?? "—"} · Ref: {u.paymentRef || "—"} · Amount: ₦{u.paymentAmount ?? "0"}
            </div>
            <div className="mt-1 text-[11px] font-medium">
              <span className={u.emailVerified ? "text-success" : "text-warning"}>
                {u.emailVerified ? "Email verified" : "Email pending verification"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Verify
              <Switch checked={!!u.emailVerified} onCheckedChange={(v) => updateEmailVerification(u.id, v)} aria-label={`Toggle email verification for ${u.username}`} />
            </label>
            <Select value={u.status} onValueChange={(v) => updateStatus(u.id, v as Profile["status"]) }>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["approved", "pending", "suspended", "rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={u.paymentStatus ?? "confirmed"} onValueChange={(v) => updatePayment(u.id, v as PaymentStatus)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

const MODE_LABEL: Record<Match["mode"], string> = { classic: "1v1", rush: "Rush", duo: "2v2" };

function Battles() {
  const { fb } = useApp();
  const [rows, setRows] = useState<Match[]>([]);

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(query(collection(fb.db, "matches"), orderBy("createdAt", "desc"), limit(25)), (s) => {
      setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) })));
    }, () => {});
  }, [fb]);

  const live = rows.filter((m) => m.status === "waiting" || m.status === "countdown" || m.status === "active");
  const done = rows.filter((m) => m.status === "completed");

  async function cancel(id: string) {
    if (!confirm("Close this battle for every player?")) return;
    await adminCancelMatch(fb!.db, id).then(() => toast.success("Battle closed")).catch((e) => toast.error(e.message));
  }

  async function end(id: string) {
    if (!confirm("End this battle now? Current scores decide the winner.")) return;
    await adminEndMatch(fb!.db, id).then(() => toast.success("Battle finished")).catch((e) => toast.error(e.message));
  }

  const row = (m: Match, isLive: boolean) => (
    <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {MODE_LABEL[m.mode]} · {m.players[m.hostId]?.name ?? "Host left"}'s room{m.code ? ` · ${m.code}` : ""}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {m.playerIds.length} player{m.playerIds.length === 1 ? "" : "s"}
          {isLive ? ` · ${m.status}` : m.winnerIds.length > 0 ? ` · winners: ${m.winnerIds.map((id) => m.players[id]?.name).filter(Boolean).join(", ")}` : ""}
        </div>
      </div>
      {isLive ? (
        <>
          {(m.status === "active" || m.status === "countdown") && (
            <Button size="sm" variant="outline" onClick={() => end(m.id)}><Crown /> End now</Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => cancel(m.id)}><Ban /> Close</Button>
        </>
      ) : (
        <Button asChild size="sm" variant="outline"><Link to="/review/$matchId" params={{ matchId: m.id }}>Review</Link></Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="surface-card divide-y">
        <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs font-bold uppercase"><Swords className="size-3.5" /> Running & waiting rooms ({live.length})</div>
        {live.length === 0 && <div className="text-muted-foreground p-3 text-sm">No battles running right now.</div>}
        {live.map((m) => row(m, true))}
      </div>
      <div className="surface-card divide-y">
        <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs font-bold uppercase"><Crown className="size-3.5" /> Recent finished battles ({done.length})</div>
        {done.length === 0 && <div className="text-muted-foreground p-3 text-sm">No finished battles in the last 50.</div>}
        {done.map((m) => row(m, false))}
      </div>
    </div>
  );
}

function AppSettingsTab() {
  const { fb, settings } = useApp();
  const save = (patch: Partial<typeof settings>) =>
    setDoc(doc(fb!.db, "settings", "app"), { ...settings, ...patch }).then(() => toast.success("Saved")).catch((e) => toast.error(e.message));
  const [ann, setAnn] = useState(settings.announcement);

  return (
    <div className="space-y-4">
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="font-semibold">Require approval for new players</div>
          <div className="text-muted-foreground text-xs">New accounts start as “pending” until you approve them.</div>
        </div>
        <Switch checked={settings.requireApproval} onCheckedChange={(v) => save({ requireApproval: v })} />
      </div>
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="font-semibold">Enable voice chat</div>
          <div className="text-muted-foreground text-xs">Turn live WebRTC voice chat on or off for all matches.</div>
        </div>
        <Switch checked={settings.voiceChatEnabled} onCheckedChange={(v) => save({ voiceChatEnabled: v })} />
      </div>
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="font-semibold">Enable "Ring everyone" invites</div>
          <div className="text-muted-foreground text-xs">After 10 seconds of searching, players can ring everyone online to join their battle.</div>
        </div>
        <Switch checked={settings.ringEnabled} onCheckedChange={(v) => save({ ringEnabled: v })} />
      </div>

      {/* Ghost Rivals Configuration */}
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Enable Ghost Rivals</div>
            <div className="text-muted-foreground text-xs">
              After {settings.ghostWaitSeconds ?? 25} seconds without an opponent, players can battle a replay of a real past player's answers.
            </div>
          </div>
          <Switch checked={settings.ghostEnabled} onCheckedChange={(v) => save({ ghostEnabled: v })} />
        </div>

        {settings.ghostEnabled && (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ghost-wait" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" /> Ghost battle popup countdown
              </Label>
              <span className="text-sm font-extrabold tabular text-primary">
                {settings.ghostWaitSeconds ?? 25}s
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[10, 15, 20, 25, 30, 45, 60].map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={(settings.ghostWaitSeconds ?? 25) === s ? "default" : "outline"}
                  className="h-8 px-3"
                  onClick={() => save({ ghostWaitSeconds: s })}
                >
                  {s}s
                </Button>
              ))}
            </div>
            <Input
              id="ghost-wait"
              type="number"
              min={5}
              max={120}
              value={settings.ghostWaitSeconds ?? 25}
              onChange={(e) => {
                const val = Math.max(5, Math.min(120, Number(e.target.value) || 25));
                save({ ghostWaitSeconds: val });
              }}
              className="tabular"
              placeholder="Custom seconds (5 - 120)"
            />
          </div>
        )}
      </div>

      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="font-semibold">Enable sound effects</div>
          <div className="text-muted-foreground text-xs">Master switch for all game sounds. When off, sounds are muted for every player and the option is hidden in their settings.</div>
        </div>
        <Switch checked={settings.sfxEnabled} onCheckedChange={(v) => save({ sfxEnabled: v })} />
      </div>
      <div className="surface-card space-y-2 p-4">
        <Label>Announcement on home screen</Label>
        <Textarea value={ann} onChange={(e) => setAnn(e.target.value)} placeholder="e.g. Weekend tournament starts Saturday 4pm!" />
        <Button size="sm" onClick={() => save({ announcement: ann })}>Save announcement</Button>
      </div>
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label>Default theme</Label>
          <Select value={settings.defaultTheme} onValueChange={(v) => save({ defaultTheme: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{THEMES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="text-sm font-semibold">Available themes</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <label key={t.id} className="bg-muted flex items-center justify-between rounded-xl px-3 py-2 text-sm">
              {t.name}
              <Switch
                checked={!settings.disabledThemes.includes(t.id)}
                disabled={t.id === settings.defaultTheme}
                onCheckedChange={(on) => save({ disabledThemes: on ? settings.disabledThemes.filter((x) => x !== t.id) : [...settings.disabledThemes, t.id] })}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function CbtCourses() {
  const { fb } = useApp();
  const subjects = useSubjects(fb?.db);
  const [name, setName] = useState("");
  const [aiName, setAiName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { added } = await registerSubjects(fb!.db, subjects, [name]);
    toast[added.length ? "success" : "info"](added.length ? "Course added. Now add its questions in the Questions tab." : "That course already exists.");
    setName("");
  }

  async function addAiCourse() {
    if (!fb) return;
    const subject = aiName.trim();
    if (!subject) return toast.error("Enter a course name before generating.");
    setAiBusy(true);
    try {
      const { canonicalName } = await registerSubjects(fb.db, subjects, [subject]);
      const generated = await generateQuestionPack({
        subject,
        prompt: aiPrompt || `Create a modern set of multiple-choice assessment questions for ${subject}.`,
        count: 5,
      });
      const batch = writeBatch(fb.db);
      generated.forEach((q) => {
        batch.set(doc(collection(fb.db, "questions")), {
          subject: canonicalName(subject),
          topic: q.topic || "General",
          difficulty: q.difficulty,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          active: true,
          createdAt: Date.now(),
        });
      });
      await batch.commit();
      clearQuestionCache();
      toast.success(`AI course added: ${subject} (${generated.length} questions)`);
      setAiName("");
      setAiPrompt("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2 font-bold"><Sparkles className="size-4" /> AI create course + questions</div>
        <div className="grid gap-2 md:grid-cols-[1.2fr_2fr_auto]">
          <Input placeholder="Course name, e.g. CHM101" value={aiName} onChange={(e) => setAiName(e.target.value)} />
          <Input placeholder="Optional AI prompt, e.g. beginner-level exam questions" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
          <Button onClick={addAiCourse} disabled={aiBusy}>{aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate</Button>
        </div>
      </div>
      <form onSubmit={add} className="surface-card flex gap-2 p-4">
        <Input placeholder="New course name, e.g. CHM101" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit"><Plus /> Add course</Button>
      </form>
      {subjects.length === 0 && <div className="text-muted-foreground text-sm">No courses yet.</div>}
      {subjects.map((s) => <CbtCourseRow key={s.id} s={s} />)}
    </div>
  );
}

function CbtCourseRow({ s }: { s: Subject }) {
  const { fb } = useApp();
  const c = cbtSettings(s);
  const [d, setD] = useState({ duration: c.duration, questionCount: c.questionCount, passMark: c.passMark, instructions: c.instructions });
  const save = (patch: Record<string, unknown>) =>
    setDoc(doc(fb!.db, "subjects", s.id || subjectKey(s.name)), patch, { merge: true }).then(() => toast.success("Saved")).catch((e) => toast.error(e.message));

  const [deleting, setDeleting] = useState(false);
  const [fullName, setFullName] = useState(s.fullName ?? "");

  async function removeCourse() {
    if (!fb) return;
    if (!window.confirm(`Delete "${s.name}" and ALL of its questions? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const snap = await getDocs(query(collection(fb.db, "questions"), where("subject", "==", s.name)));
      const refs = snap.docs.map((d) => d.ref);
      for (let i = 0; i < refs.length; i += 450) {
        const b = writeBatch(fb.db);
        refs.slice(i, i + 450).forEach((r) => b.delete(r));
        await b.commit();
      }
      await deleteDoc(doc(fb.db, "subjects", s.id || subjectKey(s.name)));
      clearQuestionCache();
      toast.success(`Deleted ${s.name} and ${refs.length} question${refs.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold">{getCourseDisplayName(s)}</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">Visible in CBT <Switch checked={c.enabled} onCheckedChange={(v) => save({ cbtEnabled: v })} /></label>
          <Button size="sm" variant="destructive" onClick={removeCourse} disabled={deleting} aria-label={`Delete course ${s.name}`}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete course
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Full course name (shown beside the code and in course search)</Label>
        <div className="flex gap-2">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. General Chemistry I" />
          <Button size="sm" variant="outline" onClick={() => save({ fullName: cleanSubjectFullName(fullName) })}>Save name</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Duration (min)</Label><Input type="number" min={1} value={d.duration} onChange={(e) => setD({ ...d, duration: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Questions per test</Label><Input type="number" min={1} value={d.questionCount} onChange={(e) => setD({ ...d, questionCount: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Pass mark (%)</Label><Input type="number" min={0} max={100} value={d.passMark} onChange={(e) => setD({ ...d, passMark: Number(e.target.value) })} /></div>
      </div>
      <Textarea rows={2} placeholder="Instructions shown before the test (optional)" value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} />
      <Button size="sm" onClick={() => save({ cbtDuration: d.duration, cbtQuestionCount: d.questionCount, cbtPassMark: d.passMark, cbtInstructions: d.instructions })}>Save settings</Button>
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
  if (!cfg) return <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm"><Loader2 className="size-4 animate-spin" /> Loading ranked settings…</div>;

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  async function save() {
    const tiers = cfg!.tiers;
    for (let i = 1; i < tiers.length; i++) if (tiers[i].min <= tiers[i - 1].min) return toast.error(`${tiers[i].name} must start above ${tiers[i - 1].name}`);
    if (cfg!.placementMatches < 1) return toast.error("Placement matches must be at least 1");
    setSaving(true);
    try { await saveRankedConfig(fb!.db, cfg!); toast.success("Ranked settings saved"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
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
      <div className="surface-card grid gap-3 p-4 sm:grid-cols-3">
        {RANKED_NUMBERS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`rk-${String(f.key)}`}>{f.label}</Label>
            <Input id={`rk-${String(f.key)}`} type="number" min={0} value={cfg[f.key] as number} onChange={(e) => setCfg({ ...cfg, [f.key]: num(e.target.value) })} />
            <div className="text-muted-foreground text-[11px]">{f.hint}</div>
          </div>
        ))}
      </div>
      <div className="surface-card space-y-3 p-4">
        <div className="font-semibold">Tier thresholds (starting RP)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cfg.tiers.map((t, i) => (
            <div key={t.name} className="space-y-1">
              <Label htmlFor={`tier-${i}`} className="flex items-center gap-1.5"><Shield className="size-3.5" style={{ color: t.color, fill: t.color }} />{t.name}</Label>
              <Input id={`tier-${i}`} type="number" min={0} disabled={i === 0} value={t.min}
                onChange={(e) => setCfg({ ...cfg, tiers: cfg.tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)) })} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Save ranked settings</Button>
        <Button variant="outline" onClick={() => setCfg(DEFAULT_RANKED)}>Reset to defaults</Button>
      </div>
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
        <div className="space-y-1"><Label htmlFor="pay-fee">Registration fee (₦)</Label><Input id="pay-fee" type="number" min={0} value={p.fee} onChange={set("fee")} /></div>
        <div className="space-y-1"><Label htmlFor="pay-bank">Bank</Label><Input id="pay-bank" value={p.bank} onChange={set("bank")} /></div>
        <div className="space-y-1"><Label htmlFor="pay-num">Account number</Label><Input id="pay-num" inputMode="numeric" value={p.accountNumber} onChange={set("accountNumber")} /></div>
        <div className="space-y-1"><Label htmlFor="pay-name">Account name</Label><Input id="pay-name" value={p.accountName} onChange={set("accountName")} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="pay-note">Note for players</Label><Textarea id="pay-note" value={p.note} onChange={set("note")} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Save payment details</Button>
        <Button size="sm" variant="outline" onClick={() => setP(DEFAULT_PAYMENT)}>Reset to defaults</Button>
      </div>
    </div>
  );
}

function SponsorsTab() {
  const { fb, settings } = useApp();
  const [list, setList] = useState<Sponsor[]>(settings.sponsors);
  const [saving, setSaving] = useState(false);
  useEffect(() => setList(settings.sponsors), [settings.sponsors]);
  const update = (id: string, patch: Partial<Sponsor>) => setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function save() {
    const bad = list.find((s) => !s.name.trim());
    if (bad) return toast.error("Every sponsor needs a name");
    const badUrl = list.find((s) => [s.logoUrl, s.website].some((u) => u.trim() && !/^https:\/\//i.test(u.trim())));
    if (badUrl) return toast.error(`${badUrl.name}: links must start with https://`);
    setSaving(true);
    try {
      await setDoc(doc(fb!.db, "settings", "app"), { sponsors: normalizeSponsors(list) }, { merge: true });
      toast.success("Sponsors saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="font-semibold">Battle sponsors</div>
        <div className="text-muted-foreground text-xs">Add the brands sponsoring battles. Only active sponsors will be shown to players once sponsor spots go live.</div>
      </div>
      {list.length === 0 && <Empty icon={Handshake} title="No sponsors yet" />}
      {list.map((s) => (
        <div key={s.id} className="surface-card space-y-3 p-4">
          <div className="flex items-center gap-3">
            {s.logoUrl ? <img src={s.logoUrl} alt="" className="bg-muted size-10 rounded-lg object-contain" /> : <div className="bg-muted grid size-10 place-items-center rounded-lg"><Handshake className="size-4" /></div>}
            <div className="min-w-0 flex-1 truncate font-semibold">{s.name || "New sponsor"}</div>
            <label className="flex items-center gap-2 text-xs">Active <Switch checked={s.active} onCheckedChange={(v) => update(s.id, { active: v })} /></label>
            <Button size="icon" variant="ghost" aria-label="Remove sponsor" onClick={() => setList(list.filter((x) => x.id !== s.id))}><Trash2 className="size-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor={`sp-name-${s.id}`}>Name</Label><Input id={`sp-name-${s.id}`} value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor={`sp-tag-${s.id}`}>Tagline</Label><Input id={`sp-tag-${s.id}`} value={s.tagline} onChange={(e) => update(s.id, { tagline: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor={`sp-logo-${s.id}`}>Logo link</Label><Input id={`sp-logo-${s.id}`} value={s.logoUrl} onChange={(e) => update(s.id, { logoUrl: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor={`sp-web-${s.id}`}>Website</Label><Input id={`sp-web-${s.id}`} value={s.website} onChange={(e) => update(s.id, { website: e.target.value })} /></div>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setList([...list, newSponsor()])}><Plus /> Add sponsor</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Save sponsors</Button>
      </div>
    </div>
  );
}
