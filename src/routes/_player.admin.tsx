import { clearQuestionCache } from "@/lib/question-cache";
import { CosmeticsAdmin } from "@/components/game/CosmeticsAdmin";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Award,
  Ban,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Database,
  Edit2,
  Flame,
  GraduationCap,
  Handshake,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  StopCircle,
  Swords,
  Trash2,
  Trophy,
  Upload,
  UserCheck,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_RANKED, seasonId, type RankedConfig } from "@/lib/ranked";
import { getRankedConfig, saveRankedConfig } from "@/lib/ranked-store";
import { DEFAULT_PAYMENT, normalizePayment, normalizeSponsors, type PaymentDetails, type Sponsor } from "@/lib/payment";
import { useApp, type Profile } from "@/lib/app-context";
import { pageMeta } from "@/lib/meta";
import { addSubject, listSubjects, updateSubject, type SubjectDoc } from "@/lib/subjects";
import { PlayerAvatar } from "@/components/game/Avatar";
import { adminCancelMatch, adminEndMatch } from "@/lib/engine";
import type { Match } from "@/lib/game-rules";
import type { ClanDoc } from "@/lib/clans";
import type { Tournament } from "@/lib/tournament-rules";

export const Route = createFileRoute("/_player/admin")({
  head: () => pageMeta("Admin Console", "Manage players, questions, battles, clans, payments, and settings."),
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

interface UserRow extends Partial<Profile> {
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
  xp?: number;
  battles?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  streak?: number;
  bestStreak?: number;
  status?: "approved" | "pending" | "rejected" | "suspended";
  emailVerified?: boolean;
  paymentStatus?: "pending" | "confirmed" | "rejected";
  paymentSender?: string;
  paymentRef?: string;
  paymentAmount?: number;
  createdAt?: number;
}

interface CoinRequestDoc {
  id: string;
  userId: string;
  username: string;
  coins: number;
  amount: number;
  senderName: string;
  bankName: string;
  proofRef: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

function AdminPage() {
  const { user, isAdmin, loading } = useApp();
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="surface-card flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 className="text-primary size-8 animate-spin" />
        <div className="text-sm font-medium text-muted-foreground">Verifying admin access…</div>
      </div>
    );
  }

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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl flex items-center gap-2">
            <Shield className="text-primary size-7" /> Admin Command Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Total control over players, questions, battles, clans, payments, and game systems.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-primary/40 bg-primary/10 text-primary font-mono text-xs">
          ROOT ACCESS
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-muted/60 rounded-xl border border-border/40">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Activity className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="players" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4" /> Players
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm">
            <Wallet className="size-4" /> Payments
          </TabsTrigger>
          <TabsTrigger value="battles" className="gap-1.5 text-xs sm:text-sm">
            <Swords className="size-4" /> Battles
          </TabsTrigger>
          <TabsTrigger value="clans" className="gap-1.5 text-xs sm:text-sm">
            <Shield className="size-4" /> Clans
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="size-4" /> Questions
          </TabsTrigger>
          <TabsTrigger value="cbt" className="gap-1.5 text-xs sm:text-sm">
            <GraduationCap className="size-4" /> CBT Courses
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="size-4" /> Tournaments
          </TabsTrigger>
          <TabsTrigger value="ranked" className="gap-1.5 text-xs sm:text-sm">
            <CalendarClock className="size-4" /> Ranked
          </TabsTrigger>
          <TabsTrigger value="shop" className="gap-1.5 text-xs sm:text-sm">
            <Coins className="size-4" /> Shop & Themes
          </TabsTrigger>
          <TabsTrigger value="app" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="size-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="gap-1.5 text-xs sm:text-sm">
            <Handshake className="size-4" /> Sponsors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="players">
          <PlayersTab />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="battles">
          <BattlesTab />
        </TabsContent>

        <TabsContent value="clans">
          <ClansTab />
        </TabsContent>

        <TabsContent value="questions">
          <QuestionsTab />
        </TabsContent>

        <TabsContent value="cbt">
          <CbtCoursesTab />
        </TabsContent>

        <TabsContent value="tournaments">
          <TournamentsTab />
        </TabsContent>

        <TabsContent value="ranked">
          <RankedTab />
        </TabsContent>

        <TabsContent value="shop">
          <CosmeticsAdmin />
        </TabsContent>

        <TabsContent value="app">
          <AppSettingsTab />
        </TabsContent>

        <TabsContent value="sponsors">
          <SponsorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
 * 1. OVERVIEW TAB
 * ========================================================================= */
function OverviewTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { fb } = useApp();
  const [stats, setStats] = useState({
    players: 0,
    questions: 0,
    matches: 0,
    clans: 0,
    tournaments: 0,
    pendingPayments: 0,
    pendingCoinRequests: 0,
    activeMatches: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb) return;
    let alive = true;

    async function loadStats() {
      if (!fb) return;
      const count = (q: Parameters<typeof getCountFromServer>[0]) =>
        getCountFromServer(q).then((s) => s.data().count).catch(() => 0);

      const usersRef = collection(fb.db, "users");
      const questionsRef = collection(fb.db, "questions");
      const matchesRef = collection(fb.db, "matches");
      const clansRef = collection(fb.db, "clans");
      const tournamentsRef = collection(fb.db, "tournaments");
      const coinRequestsRef = collection(fb.db, "coin_requests");

      const [pCount, qCount, mCount, cCount, tCount, pendPay, pendCoin, activeM] = await Promise.all([
        count(usersRef),
        count(questionsRef),
        count(matchesRef),
        count(clansRef),
        count(tournamentsRef),
        count(query(usersRef, where("paymentStatus", "==", "pending"))),
        count(query(coinRequestsRef, where("status", "==", "pending"))),
        count(query(matchesRef, where("status", "in", ["waiting", "countdown", "active"]))),
      ]);

      if (alive) {
        setStats({
          players: pCount,
          questions: qCount,
          matches: mCount,
          clans: cCount,
          tournaments: tCount,
          pendingPayments: pendPay,
          pendingCoinRequests: pendCoin,
          activeMatches: activeM,
        });
        setLoading(false);
      }
    }

    loadStats();
    return () => { alive = false; };
  }, [fb]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Players" value={stats.players} icon={Users} color="text-sky-500" onClick={() => onNavigate("players")} />
        <StatCard label="Questions Bank" value={stats.questions} icon={BookOpen} color="text-amber-500" onClick={() => onNavigate("questions")} />
        <StatCard label="Live Battles" value={stats.activeMatches} icon={Swords} color="text-emerald-500" hint={`of ${stats.matches} total`} onClick={() => onNavigate("battles")} />
        <StatCard label="Active Clans" value={stats.clans} icon={Shield} color="text-purple-500" onClick={() => onNavigate("clans")} />
        <StatCard label="Registration Approvals" value={stats.pendingPayments} icon={Wallet} color="text-rose-500" alert={stats.pendingPayments > 0} onClick={() => onNavigate("payments")} />
        <StatCard label="Coin Top-up Requests" value={stats.pendingCoinRequests} icon={Coins} color="text-yellow-500" alert={stats.pendingCoinRequests > 0} onClick={() => onNavigate("payments")} />
        <StatCard label="Tournaments" value={stats.tournaments} icon={Trophy} color="text-indigo-500" onClick={() => onNavigate("tournaments")} />
        <StatCard label="CBT Courses" value="Active" icon={GraduationCap} color="text-teal-500" onClick={() => onNavigate("cbt")} />
      </div>

      <div className="surface-card p-5 space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Activity className="size-5 text-primary" /> Quick Admin Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Button variant="outline" className="justify-start gap-2 h-auto py-3 text-left" onClick={() => onNavigate("players")}>
            <Users className="size-4 text-sky-500" />
            <div>
              <div className="font-medium text-xs">Edit Players</div>
              <div className="text-[10px] text-muted-foreground">Coins, SR, RP, Bans</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-auto py-3 text-left" onClick={() => onNavigate("questions")}>
            <Upload className="size-4 text-amber-500" />
            <div>
              <div className="font-medium text-xs">Add / Import Questions</div>
              <div className="text-[10px] text-muted-foreground">Bulk JSON import</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-auto py-3 text-left" onClick={() => onNavigate("payments")}>
            <Wallet className="size-4 text-emerald-500" />
            <div>
              <div className="font-medium text-xs">Pending Approvals</div>
              <div className="text-[10px] text-muted-foreground">Confirm bank receipts</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-auto py-3 text-left" onClick={() => onNavigate("clans")}>
            <Shield className="size-4 text-purple-500" />
            <div>
              <div className="font-medium text-xs">Clan Oversight</div>
              <div className="text-[10px] text-muted-foreground">CP, Levels, Disband</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  alert,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color?: string;
  hint?: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`surface-card p-4 transition-all duration-150 cursor-pointer hover:border-primary/50 relative overflow-hidden ${
        alert ? "border-amber-500/50 bg-amber-500/5" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={`size-4 ${color ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-black font-display">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      {alert && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      )}
    </div>
  );
}

/* =========================================================================
 * 2. PLAYERS TAB (COMPLETE CONTROL & PERMISSIONS)
 * ========================================================================= */
function PlayersTab() {
  const { fb } = useApp();
  const [players, setPlayers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingPlayer, setEditingPlayer] = useState<UserRow | null>(null);

  function reloadPlayers() {
    if (!fb) return;
    setLoading(true);
    getDocs(query(collection(fb.db, "users"), orderBy("createdAt", "desc"), limit(100)))
      .then((s) => {
        setPlayers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
      })
      .catch(() => {
        getDocs(query(collection(fb.db, "users"), limit(100)))
          .then((s) => {
            setPlayers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
          })
          .catch((err) => toast.error("Failed to load players: " + (err as Error).message));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadPlayers();
  }, [fb]);

  async function quickCoinGrant(p: UserRow, delta: number) {
    if (!fb) return;
    const next = Math.max(0, (p.coins ?? 0) + delta);
    try {
      await updateDoc(doc(fb.db, "users", p.id), { coins: next });
      setPlayers((cur) => cur.map((x) => (x.id === p.id ? { ...x, coins: next } : x)));
      toast.success(`Granted ${delta > 0 ? "+" : ""}${delta} coins to ${p.username ?? p.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleBan(p: UserRow) {
    if (!fb) return;
    const next = !p.banned;
    try {
      await updateDoc(doc(fb.db, "users", p.id), { banned: next });
      setPlayers((cur) => cur.map((x) => (x.id === p.id ? { ...x, banned: next } : x)));
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
      setPlayers((cur) => cur.map((x) => (x.id === p.id ? { ...x, rankedSuspended: next } : x)));
      toast.success(next ? `Suspended ranked access for ${p.username ?? p.id}` : `Restored ranked access`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleEmailVerify(p: UserRow) {
    if (!fb) return;
    const next = !p.emailVerified;
    try {
      await updateDoc(doc(fb.db, "users", p.id), { emailVerified: next });
      setPlayers((cur) => cur.map((x) => (x.id === p.id ? { ...x, emailVerified: next } : x)));
      toast.success(next ? "Marked email as verified" : "Marked email as unverified");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function resetPlayerStats(p: UserRow) {
    if (!fb) return;
    if (!confirm(`Reset all match scores, rating, RP, and streaks for ${p.username ?? p.id} to defaults?`)) return;
    try {
      await updateDoc(doc(fb.db, "users", p.id), {
        rating: 1200,
        rp: 0,
        battles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        bestStreak: 0,
      });
      setPlayers((cur) =>
        cur.map((x) =>
          x.id === p.id
            ? { ...x, rating: 1200, rp: 0, battles: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0 }
            : x
        )
      );
      toast.success(`Stats reset for ${p.username ?? p.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deletePlayer(p: UserRow) {
    if (!fb) return;
    if (!confirm(`PERMANENTLY delete user ${p.username ?? p.id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(fb.db, "users", p.id));
      setPlayers((cur) => cur.filter((x) => x.id !== p.id));
      toast.success(`Deleted user ${p.username ?? p.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pTerm = (search ?? "").trim().toLowerCase();
  const filtered = players.filter((p) => {
    if (statusFilter === "banned" && !p.banned) return false;
    if (statusFilter === "suspended" && !p.rankedSuspended) return false;
    if (statusFilter === "unverified" && p.emailVerified) return false;
    if (statusFilter === "pending_pay" && p.paymentStatus !== "pending") return false;

    if (!pTerm) return true;
    const u = String(p.username ?? "").toLowerCase();
    const e = String(p.email ?? "").toLowerCase();
    const id = String(p.id ?? "").toLowerCase();
    return u.includes(pTerm) || e.includes(pTerm) || id.includes(pTerm);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, email, or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Players ({players.length})</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
              <SelectItem value="suspended">Ranked Suspended</SelectItem>
              <SelectItem value="unverified">Unverified Email</SelectItem>
              <SelectItem value="pending_pay">Pending Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={reloadPlayers} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" /> Loading players directory…
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No players match current filter.
        </div>
      ) : (
        <div className="surface-card divide-y border border-border/40">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <PlayerAvatar name={p.username ?? "Player"} size={42} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base truncate">{p.username ?? "Anonymous"}</span>
                    {p.role === "admin" && <Badge variant="destructive" className="text-[10px] py-0">ADMIN</Badge>}
                    {p.banned && <Badge variant="destructive" className="text-[10px] py-0">BANNED</Badge>}
                    {p.rankedSuspended && <Badge variant="outline" className="border-amber-500 text-amber-500 text-[10px] py-0">RANK SUSPENDED</Badge>}
                    {p.paymentStatus === "pending" && <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-[10px] py-0">PAYMENT PENDING</Badge>}
                    <span className="text-[11px] font-mono text-muted-foreground">{p.id}</span>
                  </div>

                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.email || "No email"} · Level {p.level ?? 1} ({p.xp ?? 0} XP)
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs mt-2 text-muted-foreground">
                    <span className="font-semibold text-amber-500 flex items-center gap-1">
                      <Coins className="size-3.5" /> {p.coins ?? 0} coins
                    </span>
                    <span>Rating: <strong className="text-foreground">{p.rating ?? 1200} SR</strong></span>
                    <span>RP: <strong className="text-foreground">{p.rp ?? 0}</strong></span>
                    <span>Record: {p.wins ?? 0}W / {p.losses ?? 0}L / {p.draws ?? 0}D</span>
                    <span>Streak: {p.streak ?? 0} (Best: {p.bestStreak ?? 0})</span>
                    <span>Status: <strong className="text-foreground capitalize">{p.status ?? "approved"}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quick Admin Actions */}
              <div className="flex items-center flex-wrap gap-1.5 self-end md:self-center">
                <Button size="sm" variant="outline" onClick={() => quickCoinGrant(p, 100)} title="Add 100 coins" className="text-xs">
                  +100 🪙
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickCoinGrant(p, 1000)} title="Add 1,000 coins" className="text-xs">
                  +1K 🪙
                </Button>
                <Button size="sm" variant="default" onClick={() => setEditingPlayer(p)} className="gap-1 text-xs">
                  <Edit2 className="size-3.5" /> Edit Full
                </Button>
                <Button
                  size="sm"
                  variant={p.banned ? "outline" : "ghost"}
                  onClick={() => toggleBan(p)}
                  className={`text-xs ${p.banned ? "text-emerald-500 border-emerald-500/50" : "text-destructive hover:bg-destructive/10"}`}
                >
                  <Ban className="size-3.5 mr-1" /> {p.banned ? "Unban" : "Ban"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resetPlayerStats(p)}
                  title="Reset score and ratings"
                  className="text-xs text-muted-foreground hover:text-amber-500"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePlayer(p)}
                  title="Delete user"
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complete Player Edit Dialog */}
      {editingPlayer && (
        <PlayerEditDialog
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSaved={(updated) => {
            setPlayers((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
            setEditingPlayer(null);
          }}
        />
      )}
    </div>
  );
}

function PlayerEditDialog({
  player,
  onClose,
  onSaved,
}: {
  player: UserRow;
  onClose: () => void;
  onSaved: (u: UserRow) => void;
}) {
  const { fb } = useApp();
  const [form, setForm] = useState<UserRow>({ ...player });
  const [saving, setSaving] = useState(false);

  const setF = (k: keyof UserRow, val: unknown) => setForm((cur) => ({ ...cur, [k]: val }));

  async function handleSave() {
    if (!fb) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        username: form.username ?? "",
        email: form.email ?? "",
        role: form.role ?? "player",
        status: form.status ?? "approved",
        coins: Number(form.coins) || 0,
        rating: Number(form.rating) || 1200,
        rp: Number(form.rp) || 0,
        level: Number(form.level) || 1,
        xp: Number(form.xp) || 0,
        battles: Number(form.battles) || 0,
        wins: Number(form.wins) || 0,
        losses: Number(form.losses) || 0,
        draws: Number(form.draws) || 0,
        streak: Number(form.streak) || 0,
        bestStreak: Number(form.bestStreak) || 0,
        banned: Boolean(form.banned),
        rankedSuspended: Boolean(form.rankedSuspended),
        emailVerified: Boolean(form.emailVerified),
        paymentStatus: form.paymentStatus ?? "confirmed",
        paymentAmount: Number(form.paymentAmount) || 0,
        paymentSender: form.paymentSender ?? "",
        paymentRef: form.paymentRef ?? "",
      };

      await updateDoc(doc(fb.db, "users", player.id), updates);
      toast.success(`Saved all profile modifications for ${form.username || player.id}`);
      onSaved({ ...form, ...updates });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="size-5 text-primary" /> Full Control: {player.username ?? player.id}
          </DialogTitle>
          <DialogDescription>
            Admin permission override. You can adjust wallet balances, ranks, roles, and safety flags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Identity & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={form.username ?? ""} onChange={(e) => setF("username", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setF("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>System Role</Label>
              <Select value={form.role ?? "player"} onValueChange={(v) => setF("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Economy & Rank */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Coins className="size-4 text-amber-500" /> Wallet & Competitive Standing
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label>Coins Balance 🪙</Label>
                <Input type="number" value={form.coins ?? 0} onChange={(e) => setF("coins", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Rating (SR)</Label>
                <Input type="number" value={form.rating ?? 1200} onChange={(e) => setF("rating", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Ranked Points (RP)</Label>
                <Input type="number" value={form.rp ?? 0} onChange={(e) => setF("rp", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <Input type="number" value={form.level ?? 1} onChange={(e) => setF("level", Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Match Statistics */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Swords className="size-4 text-emerald-500" /> Match Records & Streaks
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="space-y-1">
                <Label>Battles</Label>
                <Input type="number" value={form.battles ?? 0} onChange={(e) => setF("battles", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Wins</Label>
                <Input type="number" value={form.wins ?? 0} onChange={(e) => setF("wins", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Losses</Label>
                <Input type="number" value={form.losses ?? 0} onChange={(e) => setF("losses", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Draws</Label>
                <Input type="number" value={form.draws ?? 0} onChange={(e) => setF("draws", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Win Streak</Label>
                <Input type="number" value={form.streak ?? 0} onChange={(e) => setF("streak", Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Account Status & Safety Flags */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Shield className="size-4 text-primary" /> Status & Safety Flags
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Account Approval Status</Label>
                <Select value={form.status ?? "approved"} onValueChange={(v) => setF("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Registration Payment Status</Label>
                <Select value={form.paymentStatus ?? "confirmed"} onValueChange={(v) => setF("paymentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={Boolean(form.banned)} onCheckedChange={(v) => setF("banned", v)} />
                <span className="font-medium text-destructive">Banned from platform</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={Boolean(form.rankedSuspended)} onCheckedChange={(v) => setF("rankedSuspended", v)} />
                <span className="font-medium text-amber-500">Ranked Matchmaking Suspended</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={Boolean(form.emailVerified)} onCheckedChange={(v) => setF("emailVerified", v)} />
                <span className="font-medium text-emerald-500">Email Verified</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save All Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
 * 3. PAYMENTS & APPROVALS TAB
 * ========================================================================= */
function PaymentsTab() {
  const { fb } = useApp();
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [coinRequests, setCoinRequests] = useState<CoinRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fb) return;

    // Listen for pending user registrations
    const unsubUsers = onSnapshot(
      query(collection(fb.db, "users"), where("paymentStatus", "==", "pending"), limit(50)),
      (s) => {
        setPendingUsers(s.docs.map((d) => ({ id: d.id, ...(d.data() as UserRow) })));
      },
      () => {}
    );

    // Listen for pending coin top-up requests
    const unsubCoins = onSnapshot(
      query(collection(fb.db, "coin_requests"), where("status", "==", "pending"), limit(50)),
      (s) => {
        setCoinRequests(s.docs.map((d) => ({ id: d.id, ...(d.data() as CoinRequestDoc) })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubUsers();
      unsubCoins();
    };
  }, [fb]);

  async function approveUserPayment(u: UserRow) {
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, "users", u.id), {
        paymentStatus: "confirmed",
        status: "approved",
      });
      toast.success(`Approved payment and unlocked account for ${u.username ?? u.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function rejectUserPayment(u: UserRow) {
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, "users", u.id), {
        paymentStatus: "rejected",
        status: "rejected",
      });
      toast.success(`Payment rejected for ${u.username ?? u.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function approveCoinRequest(req: CoinRequestDoc) {
    if (!fb) return;
    try {
      const userRef = doc(fb.db, "users", req.userId);
      const reqRef = doc(fb.db, "coin_requests", req.id);

      await runTransaction(fb.db, async (tx) => {
        const uSnap = await tx.get(userRef);
        const currentCoins = uSnap.exists() ? (Number(uSnap.data().coins) || 0) : 0;
        tx.update(userRef, { coins: currentCoins + req.coins });
        tx.update(reqRef, { status: "approved", approvedAt: Date.now() });
      });

      toast.success(`Credited +${req.coins} coins to ${req.username}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function rejectCoinRequest(req: CoinRequestDoc) {
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, "coin_requests", req.id), { status: "rejected" });
      toast.success(`Rejected coin top-up request for ${req.username}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PaymentDetailsCard />

      {/* Registration Payments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Wallet className="size-5 text-primary" /> Pending Registration Payments ({pendingUsers.length})
          </h3>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            No pending registration payments. All clear!
          </div>
        ) : (
          <div className="surface-card divide-y">
            {pendingUsers.map((u) => (
              <div key={u.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar name={u.username ?? "User"} size={36} />
                  <div>
                    <div className="font-semibold text-sm">{u.username ?? "Anonymous"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="text-[11px] text-amber-500 font-mono mt-0.5">
                      Sender: {u.paymentSender || "—"} · Ref: {u.paymentRef || "—"} · Amount: ₦{u.paymentAmount || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => approveUserPayment(u)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                    <Check className="size-3.5" /> Approve & Unlock
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectUserPayment(u)} className="text-destructive hover:bg-destructive/10">
                    <X className="size-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coin Shop Requests */}
      <div className="space-y-3">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Coins className="size-5 text-amber-500" /> Pending Coin Top-ups ({coinRequests.length})
        </h3>

        {coinRequests.length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            No pending coin requests.
          </div>
        ) : (
          <div className="surface-card divide-y">
            {coinRequests.map((req) => (
              <div key={req.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span>{req.username}</span>
                    <Badge variant="secondary" className="text-amber-500 font-bold">
                      +{req.coins} Coins
                    </Badge>
                    <span className="text-xs text-muted-foreground">₦{req.amount}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Bank: {req.bankName} · Sender: {req.senderName} · Ref: {req.proofRef}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => approveCoinRequest(req)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                    <Check className="size-3.5" /> Credit Coins
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectCoinRequest(req)} className="text-destructive hover:bg-destructive/10">
                    <X className="size-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
 * 4. BATTLES TAB (LIVE INSPECTOR & ACTIONS)
 * ========================================================================= */
const MODE_LABEL: Record<string, string> = {
  classic: "1v1 Classic",
  rush: "Battle Royale (Rush)",
  duo: "2v2 Duo",
};

function BattlesTab() {
  const { fb } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "completed">("live");

  useEffect(() => {
    if (!fb) return;
    return onSnapshot(
      query(collection(fb.db, "matches"), orderBy("createdAt", "desc"), limit(40)),
      (s) => {
        setMatches(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) })));
      },
      () => {}
    );
  }, [fb]);

  async function cancelMatch(id: string) {
    if (!fb) return;
    if (!confirm("Close and abort this battle for all players?")) return;
    try {
      await adminCancelMatch(fb.db, id);
      toast.success("Battle cancelled and closed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function endMatch(id: string) {
    if (!fb) return;
    if (!confirm("End this battle immediately? Current scores will determine the winner.")) return;
    try {
      await adminEndMatch(fb.db, id);
      toast.success("Battle ended and scores finalized");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteMatch(id: string) {
    if (!fb) return;
    if (!confirm("Delete match record permanently?")) return;
    try {
      await deleteDoc(doc(fb.db, "matches", id));
      toast.success("Match record deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const live = matches.filter((m) => m.status === "waiting" || m.status === "countdown" || m.status === "active");
  const completed = matches.filter((m) => m.status === "completed" || m.status === "cancelled");
  const display = filter === "live" ? live : filter === "completed" ? completed : matches;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant={filter === "live" ? "default" : "outline"} onClick={() => setFilter("live")}>
            Live Battles ({live.length})
          </Button>
          <Button size="sm" variant={filter === "completed" ? "default" : "outline"} onClick={() => setFilter("completed")}>
            Completed ({completed.length})
          </Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            All ({matches.length})
          </Button>
        </div>
      </div>

      {display.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No battles found in this view.
        </div>
      ) : (
        <div className="surface-card divide-y">
          {display.map((m) => {
            const isLive = m.status === "waiting" || m.status === "countdown" || m.status === "active";
            return (
              <div key={m.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{MODE_LABEL[m.mode] || m.mode}</span>
                    <Badge variant={isLive ? "default" : "secondary"} className="text-[10px] capitalize">
                      {m.status}
                    </Badge>
                    {m.code && <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Code: {m.code}</span>}
                    {m.clanWarId && <Badge variant="outline" className="border-purple-500 text-purple-500 text-[10px]">CLAN WAR</Badge>}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                    Room ID: <span className="font-mono">{m.id}</span> · Players: {m.playerIds?.length ?? 0}/{m.maxPlayers ?? 2}
                  </div>

                  {m.players && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(m.players).map(([uid, p]) => (
                        <span key={uid} className="inline-flex items-center gap-1 text-[11px] bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                          <strong>{p.name}</strong>: {p.score} pts ({p.correct}✓ / {p.wrong}✗)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {isLive && (
                    <>
                      <Button size="sm" variant="default" onClick={() => endMatch(m.id)} className="gap-1 text-xs bg-amber-600 hover:bg-amber-700">
                        <StopCircle className="size-3.5" /> End Now
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelMatch(m.id)} className="gap-1 text-xs text-destructive hover:bg-destructive/10">
                        <X className="size-3.5" /> Cancel Room
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteMatch(m.id)} className="text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * 5. CLANS TAB (ADMIN CLAN MANAGEMENT)
 * ========================================================================= */
function ClansTab() {
  const { fb } = useApp();
  const [clans, setClans] = useState<ClanDoc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingClan, setEditingClan] = useState<ClanDoc | null>(null);

  function reloadClans() {
    if (!fb) return;
    setLoading(true);
    getDocs(query(collection(fb.db, "clans"), orderBy("competitivePoints", "desc"), limit(60)))
      .then((s) => setClans(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClanDoc, "id">) }))))
      .catch(() => {
        getDocs(query(collection(fb.db, "clans"), limit(60)))
          .then((s) => setClans(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClanDoc, "id">) }))))
          .catch((e) => toast.error("Error loading clans: " + (e as Error).message));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadClans();
  }, [fb]);

  async function adjustClanPoints(c: ClanDoc, deltaCp: number) {
    if (!fb) return;
    const nextCp = Math.max(0, (c.competitivePoints ?? 0) + deltaCp);
    try {
      await updateDoc(doc(fb.db, "clans", c.id), { competitivePoints: nextCp });
      setClans((cur) => cur.map((x) => (x.id === c.id ? { ...x, competitivePoints: nextCp } : x)));
      toast.success(`${deltaCp > 0 ? "+" : ""}${deltaCp} CP applied to [${c.tag}] ${c.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteClan(c: ClanDoc) {
    if (!fb) return;
    if (!confirm(`Disband and permanently delete clan [${c.tag}] ${c.name}? This will remove the clan for all members.`)) return;
    try {
      await deleteDoc(doc(fb.db, "clans", c.id));
      setClans((cur) => cur.filter((x) => x.id !== c.id));
      toast.success(`Clan [${c.tag}] ${c.name} disbanded`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const term = search.trim().toLowerCase();
  const filtered = clans.filter((c) => {
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      c.tag.toLowerCase().includes(term) ||
      c.leaderName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <Input
          placeholder="Search clans by name, tag, or leader..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" size="sm" onClick={reloadClans} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className="size-3.5" /> Refresh Clans
        </Button>
      </div>

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" /> Loading clans…
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No clans registered yet.
        </div>
      ) : (
        <div className="surface-card divide-y">
          {filtered.map((c) => (
            <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base">{c.name}</span>
                  <Badge variant="secondary" className="font-mono text-xs">[{c.tag}]</Badge>
                  <Badge variant="outline" className="text-purple-500 border-purple-500/40 text-[10px]">
                    Lvl {c.level}
                  </Badge>
                  {c.suspended && <Badge variant="destructive" className="text-[10px]">SUSPENDED</Badge>}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  Leader: <strong className="text-foreground">{c.leaderName}</strong> · Members: {c.memberCount}/{c.maxMembers} · Policy: {c.isPublic ? "Open" : "Invite-Only"}
                </div>

                <div className="flex flex-wrap gap-3 text-xs mt-1.5 text-muted-foreground">
                  <span className="font-semibold text-purple-400">⚡ {c.competitivePoints ?? 0} CP</span>
                  <span>XP: {c.xp ?? 0}</span>
                  <span>Wars: {c.totalBattlesWon ?? 0}W / {c.totalBattlesLost ?? 0}L / {c.totalBattlesDrawn ?? 0}D</span>
                  {c.motto && <span className="italic">"{c.motto}"</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end md:self-center flex-wrap">
                <Button size="sm" variant="outline" onClick={() => adjustClanPoints(c, 50)} className="text-xs">
                  +50 CP
                </Button>
                <Button size="sm" variant="outline" onClick={() => adjustClanPoints(c, 100)} className="text-xs">
                  +100 CP
                </Button>
                <Button size="sm" variant="default" onClick={() => setEditingClan(c)} className="gap-1 text-xs">
                  <Edit2 className="size-3.5" /> Edit Clan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteClan(c)} className="text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-3.5" /> Disband
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingClan && (
        <ClanEditDialog
          clan={editingClan}
          onClose={() => setEditingClan(null)}
          onSaved={(u) => {
            setClans((cur) => cur.map((x) => (x.id === u.id ? u : x)));
            setEditingClan(null);
          }}
        />
      )}
    </div>
  );
}

function ClanEditDialog({
  clan,
  onClose,
  onSaved,
}: {
  clan: ClanDoc;
  onClose: () => void;
  onSaved: (c: ClanDoc) => void;
}) {
  const { fb } = useApp();
  const [form, setForm] = useState<ClanDoc>({ ...clan });
  const [saving, setSaving] = useState(false);

  const setF = (k: keyof ClanDoc, val: unknown) => setForm((cur) => ({ ...cur, [k]: val }));

  async function handleSave() {
    if (!fb) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name: form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),
        tag: form.tag.trim().toUpperCase(),
        tagUpper: form.tag.trim().toUpperCase(),
        level: Number(form.level) || 1,
        competitivePoints: Number(form.competitivePoints) || 0,
        xp: Number(form.xp) || 0,
        maxMembers: Number(form.maxMembers) || 30,
        minTrophyRequirement: Number(form.minTrophyRequirement) || 0,
        description: form.description || "",
        motto: form.motto || "",
        isPublic: Boolean(form.isPublic),
        suspended: Boolean(form.suspended),
      };

      await updateDoc(doc(fb.db, "clans", clan.id), updates);
      toast.success(`Updated clan [${updates.tag}] ${updates.name}`);
      onSaved({ ...form, ...updates });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Clan: [{clan.tag}] {clan.name}</DialogTitle>
          <DialogDescription>Adjust clan points, roster limits, and status.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Clan Name</Label>
              <Input value={form.name} onChange={(e) => setF("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tag</Label>
              <Input value={form.tag} onChange={(e) => setF("tag", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Competitive Points (CP)</Label>
              <Input type="number" value={form.competitivePoints} onChange={(e) => setF("competitivePoints", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Clan Level</Label>
              <Input type="number" value={form.level} onChange={(e) => setF("level", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Clan XP</Label>
              <Input type="number" value={form.xp} onChange={(e) => setF("xp", Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max Members</Label>
              <Input type="number" value={form.maxMembers} onChange={(e) => setF("maxMembers", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Min Trophy Req</Label>
              <Input type="number" value={form.minTrophyRequirement ?? 0} onChange={(e) => setF("minTrophyRequirement", Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Motto</Label>
            <Input value={form.motto} onChange={(e) => setF("motto", e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.isPublic} onCheckedChange={(v) => setF("isPublic", v)} />
              <span>Open to Public</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={Boolean(form.suspended)} onCheckedChange={(v) => setF("suspended", v)} />
              <span className="text-destructive font-medium">Suspended</span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
 * 6. TOURNAMENTS TAB
 * ========================================================================= */
function TournamentsTab() {
  const { fb } = useApp();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  function reloadTournaments() {
    if (!fb) return;
    setLoading(true);
    getDocs(query(collection(fb.db, "tournaments"), orderBy("createdAt", "desc"), limit(40)))
      .then((s) => setTournaments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, "id">) }))))
      .catch(() => {
        getDocs(query(collection(fb.db, "tournaments"), limit(40)))
          .then((s) => setTournaments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, "id">) }))))
          .catch((e) => toast.error("Error loading tournaments: " + (e as Error).message));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadTournaments();
  }, [fb]);

  async function cancelTournament(t: Tournament) {
    if (!fb) return;
    if (!confirm(`Cancel tournament "${t.name}"?`)) return;
    try {
      await updateDoc(doc(fb.db, "tournaments", t.id), { status: "cancelled" });
      setTournaments((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: "cancelled" } : x)));
      toast.success("Tournament cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteTournament(t: Tournament) {
    if (!fb) return;
    if (!confirm(`Permanently delete tournament "${t.name}"?`)) return;
    try {
      await deleteDoc(doc(fb.db, "tournaments", t.id));
      setTournaments((cur) => cur.filter((x) => x.id !== t.id));
      toast.success("Tournament deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Trophy className="size-5 text-primary" /> Active & Past Tournaments
        </h3>
        <Button variant="outline" size="sm" onClick={reloadTournaments} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" /> Loading tournaments…
        </div>
      ) : tournaments.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No tournaments created yet.
        </div>
      ) : (
        <div className="surface-card divide-y">
          {tournaments.map((t) => (
            <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base">{t.name}</span>
                  <Badge variant={t.status === "running" ? "default" : "secondary"} className="capitalize text-[10px]">
                    {t.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground capitalize">Format: {t.format}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Subject: <strong className="text-foreground">{t.subject}</strong> · Participants: {t.participantCount ?? 0}/{t.maxParticipants} · Questions: {t.questionsPerMatch}
                </div>
                {t.prizes && t.prizes.length > 0 && (
                  <div className="text-xs text-amber-500 mt-1">
                    🏆 Prizes: {t.prizes.join(" · ")}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {t.status !== "completed" && t.status !== "cancelled" && (
                  <Button size="sm" variant="outline" onClick={() => cancelTournament(t)} className="text-xs text-destructive hover:bg-destructive/10">
                    Cancel
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteTournament(t)} className="text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * 7. CBT COURSES TAB
 * ========================================================================= */
function CbtCoursesTab() {
  const { fb } = useApp();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [creating, setCreating] = useState(false);

  function reload() {
    if (!fb) return;
    listSubjects(fb.db).then(setSubjects).catch(() => {});
  }

  useEffect(() => {
    reload();
  }, [fb]);

  async function handleAddCourse() {
    if (!fb || !newCourseName.trim()) return;
    setCreating(true);
    try {
      await addSubject(fb.db, newCourseName.trim(), { cbtEnabled: true, cbtDuration: 30, cbtQuestionCount: 40, cbtPassMark: 50 });
      setNewCourseName("");
      reload();
      toast.success("Added new course for CBT");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-card p-4 space-y-3">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" /> Add New Course / Subject
        </h3>
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Course name (e.g. Physics, Law, Biology)..."
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCourse()}
          />
          <Button onClick={handleAddCourse} disabled={creating || !newCourseName.trim()}>
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="surface-card p-4 space-y-4">
        <div>
          <div className="font-semibold text-base">CBT Subject Configurations</div>
          <div className="text-muted-foreground text-xs">
            Toggle CBT mode, set exam timers, questions count, and pass marks per subject.
          </div>
        </div>

        <div className="divide-y">
          {subjects.map((s) => (
            <CbtSubjectEditor key={s.id} doc={s} onSaved={(u) => setSubjects((cur) => cur.map((x) => (x.id === u.id ? u : x)))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CbtSubjectEditor({ doc: d0, onSaved }: { doc: SubjectDoc; onSaved: (u: SubjectDoc) => void }) {
  const { fb } = useApp();
  const [d, setD] = useState({
    duration: d0.cbtDuration ?? 30,
    questionCount: d0.cbtQuestionCount ?? 40,
    passMark: d0.cbtPassMark ?? 50,
    enabled: d0.cbtEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!fb) return;
    setSaving(true);
    try {
      const u: SubjectDoc = {
        ...d0,
        cbtDuration: Math.max(1, d.duration),
        cbtQuestionCount: Math.max(1, d.questionCount),
        cbtPassMark: Math.max(0, Math.min(100, d.passMark)),
        cbtEnabled: d.enabled,
      };
      await updateSubject(fb.db, u);
      toast.success(`Updated settings for ${d0.name}`);
      onSaved(u);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div className="font-bold text-sm flex items-center gap-2">
          <span>{d0.name}</span>
          <span className="font-mono text-xs text-muted-foreground">({d0.id})</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {d.enabled ? "Active for CBT testing" : "Disabled for CBT"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <span>Active</span>
          <Switch checked={d.enabled} onCheckedChange={(v) => setD({ ...d, enabled: v })} />
        </label>
        <div className="flex items-center gap-1 text-xs">
          <Label className="text-[11px] text-muted-foreground">Mins:</Label>
          <Input type="number" className="w-16 h-8 text-xs" value={d.duration} onChange={(e) => setD({ ...d, duration: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Label className="text-[11px] text-muted-foreground">Questions:</Label>
          <Input type="number" className="w-16 h-8 text-xs" value={d.questionCount} onChange={(e) => setD({ ...d, questionCount: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Label className="text-[11px] text-muted-foreground">Pass %:</Label>
          <Input type="number" className="w-16 h-8 text-xs" value={d.passMark} onChange={(e) => setD({ ...d, passMark: Number(e.target.value) })} />
        </div>
        <Button size="sm" variant="outline" onClick={save} disabled={saving} className="h-8 text-xs">
          {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================
 * 8. QUESTIONS TAB
 * ========================================================================= */
function QuestionsTab() {
  const { fb } = useApp();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<QuestionDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (fb) {
      listSubjects(fb.db).then(setSubjects).catch(() => {});
    }
  }, [fb]);

  useEffect(() => {
    if (!fb) return;
    setLoading(true);

    const questionsRef = collection(fb.db, "questions");
    const q =
      selectedCourse && selectedCourse !== "all"
        ? query(questionsRef, where("course", "==", selectedCourse), limit(100))
        : query(questionsRef, limit(100));

    getDocs(q)
      .then((s) => {
        const rawDocs = s.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

        const mapped: QuestionDoc[] = rawDocs.map((data) => {
          const courseVal = String(data.course ?? data.subject ?? "General");
          const questionVal = String(data.question ?? data.text ?? "");
          let optionsVal: string[] = ["", "", "", ""];
          if (Array.isArray(data.options)) {
            optionsVal = data.options.map((opt) => String(opt ?? ""));
          }

          let answerVal = 0;
          if (typeof data.answer === "number") answerVal = data.answer;
          else if (typeof data.correctIndex === "number") answerVal = data.correctIndex;

          return {
            id: String(data.id),
            course: courseVal,
            question: questionVal,
            options: optionsVal,
            answer: answerVal,
            explanation: data.explanation != null ? String(data.explanation) : undefined,
            reported: Boolean(data.reported),
          };
        });

        setQuestions(mapped);
      })
      .catch((e) => toast.error("Error loading questions: " + (e as Error).message))
      .finally(() => setLoading(false));
  }, [fb, selectedCourse]);

  async function handleDelete(id: string) {
    if (!fb) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await deleteDoc(doc(fb.db, "questions", id));
      setQuestions((cur) => cur.filter((x) => x.id !== id));
      toast.success("Question deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const sTerm = (search ?? "").trim().toLowerCase();
  const filtered = questions.filter((q) => {
    if (!sTerm) return true;
    const qText = String(q?.question ?? "").toLowerCase();
    const cText = String(q?.course ?? "").toLowerCase();
    const opts = Array.isArray(q?.options) ? q.options.join(" ").toLowerCase() : "";
    return qText.includes(sTerm) || cText.includes(sTerm) || opts.includes(sTerm);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <Input
            placeholder="Search questions by text or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearQuestionCache();
              toast.success("Cleared local question cache");
            }}
            title="Clear memory and local question caches"
          >
            <RotateCcw className="size-3.5 mr-1" /> Reset Cache
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="size-3.5 mr-1" /> Bulk Import
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5 mr-1" /> Add Question
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin text-primary" /> Loading questions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No questions found. Add one above or import via JSON.
        </div>
      ) : (
        <div className="surface-card divide-y">
          {filtered.map((q) => (
            <div key={q.id} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant="secondary" className="capitalize text-[11px]">
                    {q.course}
                  </Badge>
                  {q.reported && (
                    <Badge variant="destructive" className="text-[10px]">
                      Reported
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">{q.id}</span>
                </div>
                <div className="text-sm font-semibold">{q.question}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                  {q.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`text-xs p-1.5 rounded border ${
                        i === q.answer
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium"
                          : "bg-muted/40 border-border/40 text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span> {opt}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <div className="text-xs text-muted-foreground mt-2 italic bg-muted/20 p-2 rounded">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 self-end md:self-start">
                <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>
                  <Edit2 className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={() => setSelectedCourse("all")} />}
      {creating && (
        <QuestionEditorDialog
          course={selectedCourse !== "all" ? selectedCourse : ""}
          onClose={() => setCreating(false)}
          onSaved={(q) => setQuestions((cur) => [q, ...cur])}
        />
      )}
      {editing && (
        <QuestionEditorDialog
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={(q) => setQuestions((cur) => cur.map((x) => (x.id === q.id ? q : x)))}
        />
      )}
    </div>
  );
}

function QuestionEditorDialog({
  question,
  course,
  onClose,
  onSaved,
}: {
  question?: QuestionDoc;
  course?: string;
  onClose: () => void;
  onSaved: (q: QuestionDoc) => void;
}) {
  const { fb } = useApp();
  const [c, setC] = useState(question?.course ?? course ?? "");
  const [text, setText] = useState(question?.question ?? "");
  const [opts, setOpts] = useState<string[]>(
    Array.isArray(question?.options) && question.options.length === 4
      ? question.options
      : ["", "", "", ""]
  );
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
      const payload = {
        course: c.trim().toLowerCase(),
        subject: c.trim().toLowerCase(),
        question: text.trim(),
        text: text.trim(),
        options: opts.map((o) => o.trim()),
        answer: ans,
        correctIndex: ans,
        explanation: exp.trim() || null,
        updatedAt: Date.now(),
      };

      if (question?.id) {
        await updateDoc(doc(fb.db, "questions", question.id), payload);
        toast.success("Question updated");
        onSaved({ id: question.id, ...payload, explanation: exp.trim() || undefined });
      } else {
        const ref = await addDoc(collection(fb.db, "questions"), {
          ...payload,
          createdAt: Date.now(),
        });
        toast.success("Question created");
        onSaved({ id: ref.id, ...payload, explanation: exp.trim() || undefined });
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
          <DialogTitle>{question ? "Edit Question" : "Add Question"}</DialogTitle>
          <DialogDescription>Save battle and tournament questions directly to the database.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <Label>Course / Subject</Label>
            <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="e.g. Mathematics, English, Biology" />
          </div>

          <div className="space-y-1">
            <Label>Question Text</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type question prompt..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Options & Correct Answer</Label>
            {opts.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct_answer"
                  checked={ans === i}
                  onChange={() => setAns(i)}
                  className="size-4 text-primary"
                />
                <span className="font-bold w-4">{String.fromCharCode(65 + i)}</span>
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
            <Label>Explanation (Optional)</Label>
            <Input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Brief reason for the answer..." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Question"}
          </Button>
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
      const { questions, errors } = parseQuestionImport(raw);
      if (errors.length > 0 && questions.length === 0) return toast.error(errors[0]);
      if (questions.length === 0) return toast.error("No valid questions found in payload");
      setBusy(true);

      const batch = writeBatch(fb.db);
      for (const q of questions) {
        const ref = doc(collection(fb.db, "questions"));
        const subjectName = (course.trim() || q.subject || "General").trim();
        batch.set(ref, {
          course: subjectName.toLowerCase(),
          subject: subjectName.toLowerCase(),
          question: q.text,
          text: q.text,
          options: q.options,
          answer: q.correctIndex,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? null,
          createdAt: Date.now(),
        });
      }
      await batch.commit();
      clearQuestionCache();
      toast.success(`Imported ${questions.length} questions successfully`);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Questions</DialogTitle>
          <DialogDescription>Paste a JSON array of questions to bulk add them to the database.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <Label>Override Course/Subject (optional)</Label>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Leave blank to use subject inside JSON" />
          </div>

          <div className="space-y-1">
            <Label>JSON Payload</Label>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste JSON array here..."
              rows={9}
              className="font-mono text-xs"
            />
          </div>

          <Button variant="ghost" size="sm" onClick={() => setRaw(IMPORT_EXAMPLE)} className="text-xs text-primary">
            Load sample JSON format
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleImport} disabled={busy || !raw.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Import Questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
 * 9. RANKED SEASONS TAB
 * ========================================================================= */
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
  { key: "demotionShield", label: "Demotion shield", hint: "Losses forgiven before dropping a rank" },
];

function RankedTab() {
  const { fb } = useApp();
  const [cfg, setCfg] = useState<RankedConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fb) {
      getRankedConfig(fb.db, true)
        .then(setCfg)
        .catch(() => setCfg(DEFAULT_RANKED));
    }
  }, [fb]);

  if (!cfg) {
    return (
      <div className="surface-card flex items-center justify-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" /> Loading ranked rules…
      </div>
    );
  }

  const setNum = (key: keyof RankedConfig) => (e: { target: { value: string } }) => {
    const n = Number(e.target.value);
    setCfg((c) => (c ? { ...c, [key]: Number.isFinite(n) ? n : c[key] } : c));
  };

  const setSeasonNum = (e: { target: { value: string } }) => {
    const val = Number(e.target.value);
    const num = Math.max(1, Math.floor(val || 1));
    setCfg((c) => (c ? { ...c, seasonNumber: num, season: num, seasonName: `Season ${num}` } : c));
  };

  const setEndDateStr = (e: { target: { value: string } }) => {
    const dateStr = e.target.value;
    if (!dateStr) {
      setCfg((c) => (c ? { ...c, seasonEndsAt: undefined } : c));
      return;
    }
    const ms = new Date(`${dateStr}T23:59:59`).getTime();
    if (!isNaN(ms) && ms > 0) {
      setCfg((c) => (c ? { ...c, seasonEndsAt: ms } : c));
    }
  };

  // Safely guard date conversion against undefined, null, or invalid timestamps
  const seasonEndDate =
    typeof cfg.seasonEndsAt === "number" && !isNaN(cfg.seasonEndsAt) && cfg.seasonEndsAt > 0
      ? (() => {
          try {
            const d = new Date(cfg.seasonEndsAt);
            return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
          } catch {
            return "";
          }
        })()
      : "";

  async function save() {
    if (!fb || !cfg) return;
    setSaving(true);
    try {
      await saveRankedConfig(fb.db, cfg);
      toast.success("Ranked configuration saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-card space-y-4 p-4 border border-border/40">
        <div>
          <div className="font-semibold text-base flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" /> Ranked Season Management
          </div>
          <div className="text-muted-foreground text-xs">
            Manage the active ranked season, starting number, and countdown expiry.
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Season Number</Label>
            <Input
              type="number"
              min={1}
              value={cfg.seasonNumber ?? (cfg as any).season ?? 1}
              onChange={setSeasonNum}
            />
          </div>
          <div className="space-y-1">
            <Label>Season End Date</Label>
            <Input type="date" value={seasonEndDate} onChange={setEndDateStr} />
          </div>
        </div>
      </div>

      <div className="surface-card space-y-4 p-4 border border-border/40">
        <div>
          <div className="font-semibold text-base">Matchmaking & RP Calibration</div>
          <div className="text-muted-foreground text-xs">Adjust point gains, losses, and range expansion.</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RANKED_NUMBERS.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input type="number" value={Number(cfg[key])} onChange={setNum(key)} />
              <div className="text-[11px] text-muted-foreground">{hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Ranked Rules
        </Button>
        <Button variant="outline" onClick={() => setCfg(DEFAULT_RANKED)}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}


/* =========================================================================
 * 10. APP & MATCHMAKING SETTINGS TAB
 * ========================================================================= */
function AppSettingsTab() {
  const { fb, settings } = useApp();
  const [ghostWaitSeconds, setGhostWaitSeconds] = useState(settings?.ghostWaitSeconds ?? 20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.ghostWaitSeconds) setGhostWaitSeconds(settings.ghostWaitSeconds);
  }, [settings?.ghostWaitSeconds]);

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
    <div className="space-y-6">
      <div className="surface-card space-y-3 p-4 border border-border/40">
        <div className="flex items-center gap-2">
          <Clock className="text-primary size-5" />
          <div>
            <div className="font-semibold text-base">Ghost Rivals Matchmaking Delay</div>
            <div className="text-muted-foreground text-xs">
              Time to wait in queue before the "Ghost Rival" solo-battle option appears.
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 30, 45, 60].map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={ghostWaitSeconds === preset ? "default" : "outline"}
                disabled={saving}
                onClick={() => saveGhostWait(preset)}
                className="text-xs"
              >
                {preset}s {preset === 20 ? "(Default)" : ""}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs shrink-0">Custom timer (5s – 120s):</Label>
            <Input
              type="number"
              min={5}
              max={120}
              className="w-24 h-9"
              value={ghostWaitSeconds}
              onChange={(e) => setGhostWaitSeconds(Number(e.target.value))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => saveGhostWait(ghostWaitSeconds)}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      <PaymentDetailsCard />
    </div>
  );
}

function PaymentDetailsCard() {
  const { fb, settings } = useApp();
  const [p, setP] = useState<PaymentDetails>(settings?.payment ?? DEFAULT_PAYMENT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.payment) setP(settings.payment);
  }, [settings?.payment]);

  const set = (k: keyof PaymentDetails) => (e: { target: { value: string } }) =>
    setP({ ...p, [k]: k === "fee" ? Number(e.target.value) : e.target.value });

  async function save() {
    if (!p.bank.trim() || !p.accountNumber.trim() || !p.accountName.trim()) {
      return toast.error("Bank, account number and account name are required");
    }
    if (!(p.fee >= 0)) return toast.error("Fee must be 0 or more");
    setSaving(true);
    try {
      await setDoc(doc(fb!.db, "settings", "app"), { payment: normalizePayment(p) }, { merge: true });
      toast.success("Payment details saved — new sign-ups will see them");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-card space-y-3 p-4 border border-border/40">
      <div>
        <div className="font-semibold text-base flex items-center gap-2">
          <Wallet className="size-5 text-emerald-500" /> Platform Bank Details
        </div>
        <div className="text-muted-foreground text-xs">Shown to players on sign-up and deposit pages.</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Bank Name</Label>
          <Input value={p.bank} onChange={set("bank")} placeholder="e.g. Kuda, OPay, GTBank" />
        </div>
        <div className="space-y-1">
          <Label>Account Number</Label>
          <Input value={p.accountNumber} onChange={set("accountNumber")} placeholder="10-digit number" />
        </div>
        <div className="space-y-1">
          <Label>Account Name</Label>
          <Input value={p.accountName} onChange={set("accountName")} placeholder="Registered account name" />
        </div>
        <div className="space-y-1">
          <Label>Registration Fee (₦)</Label>
          <Input type="number" min={0} value={p.fee} onChange={set("fee")} />
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="gap-1.5 mt-2">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Bank Details
      </Button>
    </div>
  );
}

/* =========================================================================
 * 11. SPONSORS TAB
 * ========================================================================= */
function SponsorsTab() {
  const { fb, settings } = useApp();
  const [sponsors, setSponsors] = useState<Sponsor[]>(settings?.sponsors ?? []);
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.sponsors) setSponsors(settings.sponsors);
  }, [settings?.sponsors]);

  async function save(list: Sponsor[]) {
    if (!fb) return;
    setSaving(true);
    try {
      await setDoc(doc(fb.db, "settings", "app"), { sponsors: normalizeSponsors(list) }, { merge: true });
      setSponsors(list);
      toast.success("Sponsors updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const clean = next.trim();
    if (!clean) return;
    if (sponsors.some((s) => String(s?.name ?? "").toLowerCase() === clean.toLowerCase())) {
      return toast.error("Already in sponsors list");
    }
    const updated: Sponsor[] = [
      ...sponsors,
      { id: crypto.randomUUID(), name: clean, tagline: "", logoUrl: "", website: "", active: true },
    ];
    setNext("");
    save(updated);
  }

  function remove(idx: number) {
    save(sponsors.filter((_, i) => i !== idx));
  }

  return (
    <div className="surface-card space-y-4 p-4 border border-border/40">
      <div>
        <div className="font-semibold text-base flex items-center gap-2">
          <Handshake className="size-5 text-primary" /> Battle & Tournament Sponsors
        </div>
        <div className="text-muted-foreground text-xs">Sponsor names cycled on battle loading screens and banners.</div>
      </div>
      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Sponsor brand or individual name..."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={saving}><Plus className="size-4" /> Add</Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {sponsors.length === 0 ? (
          <span className="text-muted-foreground text-xs">No custom sponsors added yet.</span>
        ) : (
          sponsors.map((s, i) => (
            <Badge key={s.id || i} variant="secondary" className="flex items-center gap-1.5 py-1 text-sm">
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
