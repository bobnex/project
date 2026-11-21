import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Lock,
  LogOut,
  Megaphone,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserMinus,
  Users,
} from "lucide-react";
import { collection, doc, increment, setDoc, updateDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  canPerformClanAction,
  CLAN_BANNERS,
  CLAN_EMBLEMS,
  DEFAULT_FEE_OPTIONS,
  INITIAL_ACHIEVEMENTS,
  ROLE_LABELS,
  type ClanAchievementDef,
  type ClanDoc,
  type ClanRole,
} from "@/lib/clans";
import {
  addClanAnnouncement,
  createClan,
  createClanChallenge,
  kickClanMember,
  leaveClan,
  requestJoinClan,
  updateClanMemberRole,
  useClanBattles,
  useClansDirectory,
  usePlayerClan,
} from "@/lib/clans-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_player/clans")({
  component: ClansPage,
  head: () => ({
    title: "Clans | Juvora Esports",
    meta: [
      { name: "description", content: "Team up in competitive academic clans, battle rival orders, and earn glory." },
      { property: "og:title", content: "Clans | Juvora Esports" },
    ],
  }),
});

type Tab = "hq" | "discover" | "battles" | "achievements" | "leaderboard";

function getAchievementProgress(ach: ClanAchievementDef, clan: ClanDoc | null, memberCount: number) {
  if (!clan) return { current: 0, target: ach.targetValue, unlocked: false };
  let current = 0;
  if (ach.category === "battle") {
    current = clan.totalBattlesWon ?? 0;
  } else if (ach.category === "membership") {
    current = clan.memberCount ?? memberCount;
  } else if (ach.category === "progression") {
    current = clan.level ?? 1;
  } else if (ach.category === "mission") {
    current = (clan as any).missionsCompleted ?? 0;
  } else if (ach.category === "academic") {
    current = (clan as any).academicScore ?? 0;
  }
  const unlocked = current >= ach.targetValue || (clan.unlockedAchievementIds ?? []).includes(ach.id);
  return { current, target: ach.targetValue, unlocked };
}

function ClansPage() {
  const navigate = useNavigate();
  const { profile, user, fb } = useApp();
  const { clan, membership, members, unlockedAchievementIds, achievementClaims } = usePlayerClan(user?.uid);
  const unlockedAchievementSet = new Set(unlockedAchievementIds || []);
  const { clans } = useClansDirectory();
  
  // Safe extraction from useClanBattles hook
  const battlesQuery = useClanBattles(clan?.id ?? null);
  const clanBattles = Array.isArray(battlesQuery?.challenges)
    ? battlesQuery.challenges
    : Array.isArray(battlesQuery)
      ? (battlesQuery as any)
      : [];

  const [activeTab, setActiveTab] = useState<Tab>("hq");
  const [searchQuery, setSearchQuery] = useState("");

  // Create clan form state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [motto, setMotto] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmblem, setSelectedEmblem] = useState(CLAN_EMBLEMS[0]!);
  const [selectedBanner, setSelectedBanner] = useState(CLAN_BANNERS[0]!);
  const [selectedFee, setSelectedFee] = useState(DEFAULT_FEE_OPTIONS[0]!);
  const [submitting, setSubmitting] = useState(false);

  // Announcement state
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annOpen, setAnnOpen] = useState(false);

  // Challenge modal state
  const [targetClan, setTargetClan] = useState<ClanDoc | null>(null);
  const [challengeFormat, setChallengeFormat] = useState<"1v1" | "2v2" | "3v3" | "5v5">("1v1");
  const [sendingChallenge, setSendingChallenge] = useState(false);
  const [quickChallengeOpen, setQuickChallengeOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!fb || !user || !profile) return;
    setSubmitting(true);
    try {
      await createClan(fb.db, user.uid, profile.username, profile.level ?? 1, profile.coins ?? 0, {
        name,
        tag,
        motto,
        description,
        emblem: selectedEmblem,
        banner: selectedBanner,
        joinPolicy: "open",
        minTrophyRequirement: 0,
        feeTier: selectedFee.coins > 0 ? "coins" : "free",
      });
      toast.success("Clan founded successfully!");
      setCreateOpen(false);
      setName("");
      setTag("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create clan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(c: ClanDoc) {
    if (!fb || !user || !profile) return;
    try {
      await requestJoinClan(fb.db, c, user.uid, profile.username, profile.rp ?? 0);
      toast.success(`Joined [${c.tag}] ${c.name}!`);
    } catch (err: any) {
      toast.error(err.message || "Could not join clan");
    }
  }

  async function handleLeave() {
    if (!fb || !clan || !user || !profile) return;
    try {
      await leaveClan(fb.db, clan.id, user.uid, profile.username);
      toast.success("You left the clan.");
    } catch (err: any) {
      toast.error(err.message || "Could not leave clan");
    }
  }

  async function handleKick(targetUid: string, targetName: string) {
    if (!fb || !clan || !user || !profile) return;
    try {
      await kickClanMember(fb.db, clan.id, targetUid, targetName, user.uid, profile.username);
      toast.success(`Removed ${targetName} from the clan.`);
    } catch (err: any) {
      toast.error(err.message || "Could not remove member");
    }
  }

  async function handleAnnouncement() {
    if (!fb || !clan || !user || !profile) return;
    try {
      await addClanAnnouncement(
        fb.db,
        clan.id,
        user.uid,
        profile.username,
        annBody.trim() ? `${annTitle.trim()}: ${annBody.trim()}` : annTitle.trim(),
      );
      toast.success("Announcement published!");
      setAnnTitle("");
      setAnnBody("");
      setAnnOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    }
  }

  async function handleClaim(ach: ClanAchievementDef, isSync = false) {
    if (!fb || !clan || !user) return;
    setClaimingId(ach.id);
    try {
      // 1. Update clan achievement claim record in Firestore
      const clanRef = doc(fb.db, "clans", clan.id);
      const updateData: Record<string, any> = {
        [`achievementClaims.${ach.id}`]: true,
        updatedAt: Date.now(),
      };

      if (ach.rewardType === "clan_xp") {
        updateData.xp = increment(Number(ach.rewardValue) || 100);
      }

      await updateDoc(clanRef, updateData);

      // 2. Credit personal coins to BOTH the user's main profile and the cosmetic shop wallet
      if (ach.rewardType === "coins" && user.uid) {
        const coinAmount = Number(ach.rewardValue) || 100;

        // A. Primary user document (read by useApp().profile throughout the app)
        const userRef = doc(fb.db, "users", user.uid);
        await setDoc(userRef, { coins: increment(coinAmount) }, { merge: true });

        // B. Cosmetic wallet document (read by the /shop cosmetic store)
        const walletRef = doc(fb.db, "cosmetic_wallets", user.uid);
        await setDoc(walletRef, { balance: increment(coinAmount) }, { merge: true });
      }

      // 3. Log real clan activity
      const actRef = doc(collection(fb.db, "clanActivities"));
      await setDoc(actRef, {
        clanId: clan.id,
        type: "achievement_unlocked",
        description: `${profile?.username || "A member"} claimed the ${ach.title} accolade (+${ach.rewardLabel})`,
        timestamp: Date.now(),
      });

      toast.success(isSync ? `+${ach.rewardLabel} credited to your balance!` : `Acquired ${ach.title}! +${ach.rewardLabel} credited!`);
    } catch (err: any) {
      toast.error(err.message || "Could not claim reward");
    } finally {
      setClaimingId(null);
    }
  }

  async function handleChallenge() {
    if (!fb || !clan || !targetClan || !user) return;
    setSendingChallenge(true);
    try {
      const challengeId = (await createClanChallenge(
        fb.db,
        clan,
        targetClan,
        user.uid,
        challengeFormat,
      )) as unknown as string | void;

      toast.success(`Challenge sent to [${targetClan.tag}] ${targetClan.name}!`);
      setTargetClan(null);

      if (typeof challengeId === "string" && challengeId.length > 0) {
        navigate({ to: "/clan-war/$challengeId", params: { challengeId } });
      } else {
        setActiveTab("battles");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send challenge");
    } finally {
      setSendingChallenge(false);
    }
  }

  const filteredClans = clans.filter((c) =>
    searchQuery
      ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tag.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const activeWars = clanBattles.filter((b) => b.status === "pending" || b.status === "in_progress");
  const pastWars = clanBattles.filter((b) => b.status === "completed" || b.status === "declined");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Shield className="size-7 text-primary" /> Juvora Clans V1
          </h1>
          <p className="text-muted-foreground text-sm">
            Competitive academic team esports & collective dominance.
          </p>
        </div>

        {!clan && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="font-semibold shadow-glow">
                <PlusCircle className="size-4 mr-2" /> Form a Clan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-primary" /> Create Your Clan
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {profile && profile.level < 6 && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-xs">
                    You must reach <strong>Level 6</strong> to create a clan. Current level: {profile.level}.
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold">Clan Name</label>
                    <Input
                      placeholder="e.g. Apex Scholars"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Tag (2-6)</label>
                    <Input
                      placeholder="APEX"
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toUpperCase())}
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Motto</label>
                  <Input
                    placeholder="Knowledge is our weapon"
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Description</label>
                  <Textarea
                    placeholder="Our clan competes for academic rankings and weekly crowns..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Choose Emblem</label>
                  <div className="flex flex-wrap gap-2">
                    {CLAN_EMBLEMS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setSelectedEmblem(e)}
                        className={`text-xl p-2 rounded-lg border transition-all ${
                          selectedEmblem === e
                            ? "border-primary bg-primary/20 scale-110"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Choose Banner Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CLAN_BANNERS.map((b, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedBanner(b)}
                        style={{ background: b }}
                        className={`h-8 rounded-lg cursor-pointer border-2 transition-all ${
                          selectedBanner === b ? "border-primary scale-105" : "border-transparent opacity-70"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Initiation Tier</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_FEE_OPTIONS.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFee(f)}
                        className={`p-2.5 rounded-lg border cursor-pointer text-left transition-all ${
                          selectedFee.id === f.id ? "border-primary bg-primary/10" : "border-border"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          {f.name}
                          <span className="text-[11px] text-warning flex items-center">
                            <Coins className="size-3 mr-0.5" /> {f.coins}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{f.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full font-semibold"
                  disabled={submitting || (profile?.level ?? 0) < 6}
                  onClick={handleCreate}
                >
                  {submitting ? "Founding Order..." : "Found Clan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex border-b border-border/60 overflow-x-auto pb-1 gap-1">
        {[
          { key: "hq", label: "My Clan (HQ)", icon: Shield, requiresClan: true },
          { key: "discover", label: "Discover", icon: Search },
          { key: "battles", label: "War Arena", icon: Swords },
          { key: "achievements", label: "Achievements", icon: Award },
          { key: "leaderboard", label: "Leaderboard", icon: Trophy },
        ].map((t) => {
          if (t.requiresClan && !clan) return null;
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as Tab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: HQ */}
      {activeTab === "hq" && clan && (
        <div className="space-y-6">
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl">
            <div style={{ background: clan.banner }} className="h-36 w-full relative flex items-end p-5">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="bg-background/80 backdrop-blur text-xs px-2.5 py-1 rounded-full font-bold border border-border">
                  {clan.competitivePoints} CP
                </span>
                {membership && canPerformClanAction(membership.role, "announce") && (
                  <Button size="sm" variant="secondary" onClick={() => setAnnOpen(true)}>
                    <Megaphone className="size-3.5 mr-1" /> Post Notice
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-background/90 border-2 border-primary/40 flex items-center justify-center text-3xl shadow-lg">
                  {clan.emblem}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-foreground drop-shadow">{clan.name}</h2>
                    <span className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5 rounded">
                      [{clan.tag}]
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 italic mt-0.5">
                    "{clan.motto || "Champions of intellect."}"
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-card/60 backdrop-blur grid grid-cols-2 sm:grid-cols-4 gap-3 text-center border-t border-border/40">
              <div className="p-2 rounded-xl bg-muted/40">
                <div className="text-[11px] text-muted-foreground font-medium">Clan Level</div>
                <div className="text-lg font-black text-primary">Level {clan.level}</div>
              </div>
              <div className="p-2 rounded-xl bg-muted/40">
                <div className="text-[11px] text-muted-foreground font-medium">Roster Capacity</div>
                <div className="text-lg font-black">
                  {clan.memberCount} / {clan.maxMembers}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-muted/40">
                <div className="text-[11px] text-muted-foreground font-medium">Battle Record</div>
                <div className="text-lg font-black text-emerald-400">
                  {clan.totalBattlesWon}W - {clan.totalBattlesLost}L
                </div>
              </div>
              <div className="p-2 rounded-xl bg-muted/40">
                <div className="text-[11px] text-muted-foreground font-medium">Trophies Unlocked</div>
                <div className="text-lg font-black text-warning flex items-center justify-center gap-1">
                  <Crown className="size-4" /> {clan.achievementsUnlockedCount || unlockedAchievementIds.length}
                </div>
              </div>
            </div>
          </div>

          {clan.announcements && clan.announcements.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card/40 space-y-2">
              <div className="text-xs font-bold flex items-center gap-2 text-primary">
                <Megaphone className="size-4" /> Clan Notice Board
              </div>
              {clan.announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-xs font-bold">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.body}</div>
                  <div className="text-[10px] text-muted-foreground/60 mt-1">
                    By {a.authorName} · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="size-4 text-primary" /> Active Roster ({members.length})
              </h3>
              {membership?.role !== "leader" && (
                <Button variant="ghost" size="sm" onClick={handleLeave} className="text-destructive text-xs">
                  <LogOut className="size-3.5 mr-1" /> Leave Clan
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              {members.map((m) => (
                <div
                  key={m.uid}
                  className="p-3 rounded-xl border border-border bg-card/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                      {m.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        {m.username}
                        {m.role === "leader" && <Crown className="size-3.5 text-warning fill-warning" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[m.role]}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-primary">{m.contributionScore} pts</div>
                      <div className="text-[10px] text-muted-foreground">{m.battlesWon} wins</div>
                    </div>

                    {membership &&
                      canPerformClanAction(membership.role, "promote") &&
                      m.uid !== user?.uid &&
                      m.role !== "leader" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => {
                            const nextRole: ClanRole =
                              m.role === "recruit"
                                ? "member"
                                : m.role === "member"
                                  ? "elite"
                                  : "general";
                            if (fb) updateClanMemberRole(fb.db, clan.id, m.uid, nextRole);
                          }}
                        >
                          Promote
                        </Button>
                      )}

                    {membership &&
                      canPerformClanAction(membership.role, "kick") &&
                      m.uid !== user?.uid &&
                      m.role !== "leader" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleKick(m.uid, m.username)}
                        >
                          <UserMinus className="size-3.5" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISCOVER */}
      {activeTab === "discover" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search clans by name or tag..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {filteredClans.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-muted border border-border flex items-center justify-center text-2xl">
                    {c.emblem}
                  </div>
                  <div>
                    <div className="text-sm font-bold flex items-center gap-1.5">
                      {c.name} <span className="text-xs text-primary font-black">[{c.tag}]</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Level {c.level} · {c.memberCount}/{c.maxMembers} Members · {c.competitivePoints} CP
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 italic mt-0.5">"{c.motto}"</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!clan && (
                    <Button size="sm" onClick={() => handleJoin(c)} disabled={c.memberCount >= c.maxMembers}>
                      Join
                    </Button>
                  )}
                  {clan && clan.id !== c.id && (
                    <Button size="sm" variant="outline" onClick={() => setTargetClan(c)}>
                      <Swords className="size-3.5 mr-1 text-primary" /> Challenge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WAR ARENA */}
      {activeTab === "battles" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/80 to-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black flex items-center gap-2 text-primary">
                <Swords className="size-5" /> Clan War Arena
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Lock horns with rival academic clans in 1v1 Duels, 2v2 Tag Teams, 3v3 Skirmishes, and 5v5 Supreme Clashes.
                Every victory awards Clan XP, Competitive Points, and unlocks rare clan war honours.
              </p>
            </div>
            {clan && (
              <Button
                onClick={() => setQuickChallengeOpen(true)}
                className="font-bold shadow-glow shrink-0"
              >
                <Flame className="size-4 mr-1.5 text-warning" /> Challenge a Rival
              </Button>
            )}
          </div>

          {/* Active / In-Progress Wars */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="size-3.5 text-warning" /> Active Clashes ({activeWars.length})
              </h4>
            </div>

            {activeWars.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-xl bg-card/20">
                No active war clashes right now. Launch a duel against any registered clan!
              </div>
            ) : (
              activeWars.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-primary/30 bg-card/80 flex items-center justify-between gap-3 shadow-sm hover:border-primary/50 transition-all"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-black flex items-center gap-2">
                      <Swords className="size-4 text-primary animate-pulse" />
                      <span className="text-primary font-bold">[{b.challengerClanTag}]</span> {b.challengerClanName}
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="text-primary font-bold">[{b.targetClanTag}]</span> {b.targetClanName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-black text-[10px] bg-primary/20 text-primary uppercase">
                        {b.format || "1v1"}
                      </span>
                      <span>·</span>
                      <span className="capitalize font-semibold text-warning">
                        {b.status === "in_progress" ? "Battle In Progress" : "Pending Roster Confirmation"}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={b.status === "in_progress" ? "default" : "secondary"}
                    className="text-xs h-9 font-bold shrink-0"
                    asChild
                  >
                    <Link to="/clan-war/$challengeId" params={{ challengeId: b.id }}>
                      {b.status === "in_progress" ? "Enter Battle" : "Open War Room"}
                      <ChevronRight className="size-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Past War History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              War Clashes History ({pastWars.length})
            </h4>

            {pastWars.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-xl bg-card/10">
                No finished clashes recorded yet.
              </div>
            ) : (
              pastWars.map((b) => {
                const isChallenger = b.challengerClanId === clan?.id;
                const isWin = b.winnerClanId === clan?.id;
                const isDraw = b.status === "completed" && !b.winnerClanId;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-border bg-card/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>[{b.challengerClanTag}] {b.challengerClanName}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span>[{b.targetClanTag}] {b.targetClanName}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="uppercase font-semibold">{b.format || "1v1"}</span>
                        <span>·</span>
                        {b.status === "completed" ? (
                          <span className="font-bold text-foreground">
                            Final Score: {b.challengerScore ?? 0} - {b.targetScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Declined</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {clan && b.status === "completed" && (
                        <span
                          className={`font-black px-2 py-0.5 rounded text-[10px] ${
                            isWin
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isDraw
                                ? "bg-muted text-muted-foreground"
                                : "bg-destructive/20 text-destructive border border-destructive/30"
                          }`}
                        >
                          {isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT"}
                        </span>
                      )}

                      <Button size="sm" variant="ghost" className="h-8 text-xs font-semibold" asChild>
                        <Link to="/clan-war/$challengeId" params={{ challengeId: b.id }}>
                          View Match
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ACHIEVEMENTS & TROPHIES */}
      {activeTab === "achievements" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/10 via-card/80 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black flex items-center gap-2 text-warning">
                <Award className="size-5" /> Trophies & Rewards Centre
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Climb tiers together. Complete collective clan milestones to earn Juvora Coins, bonus Clan XP, and elite war titles.
              </p>
            </div>
            
            <div className="flex items-center gap-3 self-start sm:self-center">
              {/* Live Coin Balance Pill */}
              <div className="px-3 py-1.5 rounded-xl bg-card/90 border border-border flex items-center gap-2 shadow-sm">
                <Coins className="size-4 text-warning" />
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold leading-none">Your Coins</div>
                  <div className="text-xs font-black text-foreground">{profile?.coins ?? 0}</div>
                </div>
              </div>

              {clan && (
                <div className="px-3 py-1.5 rounded-xl bg-card/90 border border-border text-right shadow-sm">
                  <div className="text-[10px] text-muted-foreground font-semibold leading-none">Unlocked</div>
                  <div className="text-xs font-black text-warning">
                    {INITIAL_ACHIEVEMENTS.filter((a) => getAchievementProgress(a, clan, members.length).unlocked).length} / {INITIAL_ACHIEVEMENTS.length}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {INITIAL_ACHIEVEMENTS.map((ach) => {
              const { current, target, unlocked } = getAchievementProgress(ach, clan, members.length);
              const claimed = !!achievementClaims[ach.id];
              const isClaiming = claimingId === ach.id;
              const progressPct = Math.min(100, Math.round((current / target) * 100));

              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    unlocked
                      ? "border-warning/50 bg-warning/5 shadow-sm"
                      : "border-border/60 bg-card/40 opacity-85"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {ach.isSecret && !unlocked ? "Secret Clan Milestone" : ach.title}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-black bg-muted text-muted-foreground">
                            {ach.rarity}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {ach.isSecret && !unlocked
                            ? "This prestigious feat remains shrouded in mystery until achieved."
                            : ach.description}
                        </p>
                      </div>

                      {unlocked ? (
                        <CheckCircle2 className="size-4 text-warning shrink-0 mt-0.5" />
                      ) : (
                        <Lock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* Live Progress Bar for Clan */}
                    {clan && !ach.isSecret && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>Progress</span>
                          <span>{current} / {target}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              unlocked ? "bg-warning" : "bg-primary"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                      <Sparkles className="size-3 text-warning" />
                      Reward: {ach.rewardLabel}
                    </span>

                    {/* Claim Button */}
                    {unlocked && !claimed && clan && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isClaiming}
                        className="h-7 text-xs font-bold shadow-glow"
                        onClick={() => handleClaim(ach, false)}
                      >
                        {isClaiming ? "Crediting..." : "Claim Reward"}
                      </Button>
                    )}

                    {/* Claimed Indicator with Re-sync option if coins didn't register */}
                    {claimed && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          Claimed ✓
                        </span>
                        {ach.rewardType === "coins" && (
                          <button
                            type="button"
                            onClick={() => handleClaim(ach, true)}
                            disabled={isClaiming}
                            title="Click if your coins did not show up previously"
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 underline transition-colors"
                          >
                            <RefreshCw className={`size-2.5 ${isClaiming ? "animate-spin" : ""}`} />
                            Sync coins
                          </button>
                        )}
                      </div>
                    )}

                    {!unlocked && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="size-4 text-warning" /> Overall Clan Leaderboard
          </h3>

          <div className="grid gap-2">
            {clans.map((c, i) => (
              <div
                key={c.id}
                className="p-3 rounded-xl border border-border bg-card/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-sm w-6 text-center text-muted-foreground">#{i + 1}</span>
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-lg">
                    {c.emblem}
                  </div>
                  <div>
                    <div className="text-xs font-bold">
                      {c.name} <span className="text-primary">[{c.tag}]</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Level {c.level} · {c.memberCount} members
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-warning">{c.competitivePoints} CP</div>
                  <div className="text-[10px] text-muted-foreground">{c.totalBattlesWon} wins</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-primary" /> Post Clan Notice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Title</label>
              <Input
                placeholder="e.g. Mandatory Clan War at 8 PM"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Message</label>
              <Textarea
                placeholder="Roster signups close in 2 hours..."
                rows={4}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
            </div>
            <Button className="w-full font-bold shadow-glow" onClick={handleAnnouncement}>
              Publish Announcement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QUICK CHALLENGE RIVAL SELECTOR MODAL */}
      <Dialog open={quickChallengeOpen} onOpenChange={setQuickChallengeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="size-5 text-warning" /> Challenge Rival Clan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Select any registered clan from the directory to issue an academic war challenge.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {clans
                .filter((c) => c.id !== clan?.id)
                .map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => {
                      setQuickChallengeOpen(false);
                      setTargetClan(c);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.emblem}</span>
                      <div>
                        <div className="font-bold">
                          {c.name} <span className="text-primary font-black">[{c.tag}]</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">Level {c.level} · {c.competitivePoints} CP</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs font-bold">
                      Select
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CHALLENGE LAUNCH MODAL */}
      <Dialog open={!!targetClan} onOpenChange={(o) => !o && setTargetClan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="size-5 text-primary" /> Challenge {targetClan?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">War Format</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["1v1", "2v2", "3v3", "5v5"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant={challengeFormat === fmt ? "default" : "outline"}
                    size="sm"
                    className="text-xs font-bold"
                    onClick={() => setChallengeFormat(fmt)}
                  >
                    {fmt}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {challengeFormat === "1v1" && "Solo duel between clan champions."}
                {challengeFormat === "2v2" && "Duo synergy battle with synced bonus."}
                {challengeFormat === "3v3" && "3-combatant team skirmish."}
                {challengeFormat === "5v5" && "Full clan showdown across academic subjects."}
              </p>
            </div>
            <Button
              className="w-full font-bold shadow-glow"
              disabled={sendingChallenge}
              onClick={handleChallenge}
            >
              {sendingChallenge ? "Dispatching..." : "Confirm Challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
