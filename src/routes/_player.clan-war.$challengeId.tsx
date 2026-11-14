import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import {
  Award,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Flame,
  HelpCircle,
  Loader2,
  Medal,
  Play,
  Radio,
  Share2,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullLoader } from "@/components/game/ui";
import { PlayerAvatar } from "@/components/game/Avatar";
import { useApp } from "@/lib/app-context";
import { canPerformClanAction, type ClanDoc, type ClanMember } from "@/lib/clans";
import {
  buildClanWarQuestionSubjects,
  getClanWarQuestionCount,
  startClanWarMatch,
} from "@/lib/clan-war";
import { cn } from "@/lib/utils";

type WarChallenge = DocumentData & {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanTag: string;
  targetClanId: string;
  targetClanName: string;
  targetClanTag: string;
  format: "1v1" | "3v3" | "5v5";
  status: "pending" | "accepted" | "rejected" | "starting" | "in_progress" | "completed";
  challengerRoster?: string[];
  targetRoster?: string[];
  matchId?: string;
  playerOneUid?: string;
  playerTwoUid?: string;
  winnerClanId?: string | null;
  scores?: Record<string, number>;
  cpDeltaA?: number;
  cpDeltaB?: number;
  xpDeltaA?: number;
  xpDeltaB?: number;
  resolvedAt?: number;
  settings?: {
    subjects?: string[];
    secondsPerQuestion?: number;
    questionCount?: number;
  };
};

interface WarPresence {
  uid: string;
  username: string;
  clanId: string;
  lastSeen: number;
}

export const Route = createFileRoute("/_player/clan-war/$challengeId")({
  head: () => ({
    meta: [
      { title: "Clan War Room • Juvora" },
      {
        name: "description",
        content: "Assemble your clan roster and lead your clan to victory in live Clan Wars.",
      },
      { property: "og:title", content: "Clan War Room • Juvora" },
      {
        property: "og:description",
        content: "Assemble your clan roster and lead your clan to victory in live Clan Wars.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClanWarChallengeRoute,
});

function ClanWarChallengeRoute() {
  const { challengeId } = Route.useParams();
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<WarChallenge | null>(null);
  const [membership, setMembership] = useState<ClanMember | null>(null);
  const [ownClan, setOwnClan] = useState<ClanDoc | null>(null);
  const [opponentClan, setOpponentClan] = useState<ClanDoc | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Settings
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(15);
  const [customSubjects, setCustomSubjects] = useState<string>("general, mathematics, english");

  // Real-time Presence
  const [presences, setPresences] = useState<WarPresence[]>([]);

  // 1. Listen for challenge
  useEffect(() => {
    if (!fb || !challengeId) return;

    const challengeRef = doc(fb.db, "clanBattles", challengeId);
    return onSnapshot(
      challengeRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setChallenge(null);
          setLoading(false);
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() } as WarChallenge;
        setChallenge(data);

        if (data.settings?.questionCount) {
          setQuestionCount(data.settings.questionCount);
        } else {
          setQuestionCount(getClanWarQuestionCount(data.format));
        }

        if (data.settings?.secondsPerQuestion) {
          setSecondsPerQuestion(data.settings.secondsPerQuestion);
        }

        if (data.settings?.subjects?.length) {
          setCustomSubjects(data.settings.subjects.join(", "));
        }

        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [fb, challengeId]);

  // 2. Listen for current user clan membership
  useEffect(() => {
    if (!fb || !user) {
      setMembership(null);
      return;
    }

    const membershipQuery = query(
      collection(fb.db, "clanMembers"),
      where("uid", "==", user.uid),
    );

    return onSnapshot(
      membershipQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setMembership(null);
          return;
        }

        const data = snapshot.docs[0].data() as Omit<ClanMember, "uid">;
        setMembership({
          ...data,
          uid: user.uid,
        } as ClanMember);
      },
    );
  }, [fb, user]);

  const ownClanId = membership?.clanId;
  const opposingClanId =
    challenge && ownClanId === challenge.challengerClanId
      ? challenge.targetClanId
      : challenge?.challengerClanId;

  // 3. Listen for own clan doc
  useEffect(() => {
    if (!fb || !ownClanId) {
      setOwnClan(null);
      return;
    }

    return onSnapshot(doc(fb.db, "clans", ownClanId), (snapshot) => {
      if (snapshot.exists()) {
        setOwnClan({ id: snapshot.id, ...snapshot.data() } as ClanDoc);
      } else {
        setOwnClan(null);
      }
    });
  }, [fb, ownClanId]);

  // 4. Listen for opponent clan doc
  useEffect(() => {
    if (!fb || !opposingClanId) {
      setOpponentClan(null);
      return;
    }

    return onSnapshot(doc(fb.db, "clans", opposingClanId), (snapshot) => {
      if (snapshot.exists()) {
        setOpponentClan({ id: snapshot.id, ...snapshot.data() } as ClanDoc);
      } else {
        setOpponentClan(null);
      }
    });
  }, [fb, opposingClanId]);

  // 5. Listen for clan members of user's clan
  useEffect(() => {
    if (!fb || !ownClanId) {
      setMembers([]);
      return;
    }

    return onSnapshot(
      query(collection(fb.db, "clanMembers"), where("clanId", "==", ownClanId)),
      (snapshot) => {
        setMembers(
          snapshot.docs.map(
            (docSnapshot) =>
              ({
                ...docSnapshot.data(),
                uid: docSnapshot.data().uid ?? docSnapshot.id.split("_")[1],
              }) as ClanMember,
          ),
        );
      },
    );
  }, [fb, ownClanId]);

  // 6. Active Presence Heartbeat in this war room
  useEffect(() => {
    if (!fb || !user || !profile || !membership || !challengeId) return;

    const presenceRef = doc(fb.db, "clanBattles", challengeId, "presence", user.uid);

    const sendHeartbeat = () => {
      void setDoc(
        presenceRef,
        {
          uid: user.uid,
          username: profile.username,
          clanId: membership.clanId,
          lastSeen: Date.now(),
        },
        { merge: true },
      ).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 8000);

    return () => {
      clearInterval(interval);
      void deleteDoc(presenceRef).catch(() => {});
    };
  }, [fb, user, profile?.username, membership?.clanId, challengeId]);

  // 7. Listen for all online presence in this war room
  useEffect(() => {
    if (!fb || !challengeId) return;

    const presencesRef = collection(fb.db, "clanBattles", challengeId, "presence");
    return onSnapshot(
      presencesRef,
      (snapshot) => {
        const threshold = Date.now() - 25000;
        const active: WarPresence[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as WarPresence;
          if (data.lastSeen && data.lastSeen > threshold) {
            active.push(data);
          }
        });
        setPresences(active);
      },
      () => {},
    );
  }, [fb, challengeId]);

  const expectedPlayers = challenge
    ? challenge.format === "1v1"
      ? 1
      : challenge.format === "3v3"
        ? 3
        : 5
    : 1;

  const challengerRoster = challenge?.challengerRoster ?? [];
  const targetRoster = challenge?.targetRoster ?? [];
  const isInvitingClan = ownClanId === challenge?.challengerClanId;

  // Filter online presence by clan
  const invitingClanOnline = useMemo(
    () => presences.filter((p) => p.clanId === challenge?.challengerClanId),
    [presences, challenge?.challengerClanId],
  );

  const targetClanOnline = useMemo(
    () => presences.filter((p) => p.clanId === challenge?.targetClanId),
    [presences, challenge?.targetClanId],
  );

  const hasInvitingClanOnline = invitingClanOnline.length > 0;
  const hasTargetClanOnline = targetClanOnline.length > 0;
  const hasBothClansOnline = hasInvitingClanOnline && hasTargetClanOnline;

  const canConfigure =
    isInvitingClan &&
    !!membership &&
    canPerformClanAction(membership.role, "battle");

  const canLaunch =
    !!membership &&
    canPerformClanAction(membership.role, "battle") &&
    challengerRoster.length >= expectedPlayers &&
    targetRoster.length >= expectedPlayers &&
    hasBothClansOnline;

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.uid, member])),
    [members],
  );

  // Auto-navigate match participants into the match room once running
  useEffect(() => {
    if (
      !challenge?.matchId ||
      !user ||
      challenge.status !== "in_progress" ||
      !challenge.playerOneUid ||
      !challenge.playerTwoUid ||
      ![challenge.playerOneUid, challenge.playerTwoUid].includes(user.uid)
    ) {
      return;
    }

    void navigate({
      to: "/match/$matchId",
      params: { matchId: challenge.matchId },
    });
  }, [
    challenge?.status,
    challenge?.matchId,
    challenge?.playerOneUid,
    challenge?.playerTwoUid,
    user,
    navigate,
  ]);

  if (loading) return <FullLoader label="Loading clan war room" />;

  if (!fb || !user || !profile || !challenge) {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <h1 className="text-xl font-black">Clan War not found</h1>
        <p className="text-sm text-muted-foreground">
          This clan battle challenge does not exist or was deleted.
        </p>
        <Button asChild variant="outline">
          <Link to="/clans">Back to Clans HQ</Link>
        </Button>
      </div>
    );
  }

  if (
    !membership ||
    (membership.clanId !== challenge.challengerClanId &&
      membership.clanId !== challenge.targetClanId)
  ) {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <h1 className="text-xl font-black">Clan members only</h1>
        <p className="text-sm text-muted-foreground">
          You must be an active member of either [{challenge.challengerClanTag}] or [
          {challenge.targetClanTag}] to participate in this War Room.
        </p>
        <Button asChild variant="outline">
          <Link to="/clans">Back to clans</Link>
        </Button>
      </div>
    );
  }

  if (challenge.status === "rejected") {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <h1 className="text-xl font-black">War invitation rejected</h1>
        <p className="text-sm text-muted-foreground">This war clash was turned down.</p>
        <Button asChild variant="outline">
          <Link to="/clans">Back to clans</Link>
        </Button>
      </div>
    );
  }

  // ==========================================
  // REDESIGNED CLAN WAR RESULT PAGE (COMPLETED)
  // ==========================================
  if (challenge.status === "completed") {
    const scores = challenge.scores ?? {};
    const scoreA = scores[challenge.challengerClanId] ?? 0;
    const scoreB = scores[challenge.targetClanId] ?? 0;
    const winnerId = challenge.winnerClanId ?? null;
    const isWinner = winnerId === ownClanId;
    const isDraw = winnerId === null;

    const cpGainA = typeof challenge.cpDeltaA === "number" ? challenge.cpDeltaA : (winnerId === challenge.challengerClanId ? 25 : isDraw ? 10 : 0);
    const xpGainA = typeof challenge.xpDeltaA === "number" ? challenge.xpDeltaA : (winnerId === challenge.challengerClanId ? 100 : isDraw ? 50 : 25);

    const cpGainB = typeof challenge.cpDeltaB === "number" ? challenge.cpDeltaB : (winnerId === challenge.targetClanId ? 25 : isDraw ? 10 : 0);
    const xpGainB = typeof challenge.xpDeltaB === "number" ? challenge.xpDeltaB : (winnerId === challenge.targetClanId ? 100 : isDraw ? 50 : 25);

    const isChallengerSide = ownClanId === challenge.challengerClanId;
    const myClanCpGain = isChallengerSide ? cpGainA : cpGainB;
    const myClanXpGain = isChallengerSide ? xpGainA : xpGainB;

    const challengerFighter = challenge.playerOneUid;
    const targetFighter = challenge.playerTwoUid;

    const challengerFighterName =
      memberLookup.get(challengerFighter ?? "")?.username ??
      (challengerFighter === user.uid ? profile.username : "Clan Challenger");
    const targetFighterName =
      memberLookup.get(targetFighter ?? "")?.username ??
      (targetFighter === user.uid ? profile.username : "Opponent Champion");

    async function copyWarReport() {
      const summaryText = `⚔️ CLAN WAR REPORT\n[${challenge.challengerClanTag}] ${challenge.challengerClanName}: ${scoreA} pts (+${cpGainA} CP, +${xpGainA} XP)\n[${challenge.targetClanTag}] ${challenge.targetClanName}: ${scoreB} pts (+${cpGainB} CP, +${xpGainB} XP)\nResult: ${isDraw ? "Honorable Draw" : isWinner ? "Clan Victory!" : "Clan Defeat"}\nMy Clan Impact: +${myClanCpGain} CP | +${myClanXpGain} XP`;
      try {
        await navigator.clipboard.writeText(summaryText);
        toast.success("Clan War report copied to clipboard!");
      } catch {
        toast.error("Could not copy report");
      }
    }

    async function shareWarReport() {
      const summaryText = `⚔️ Juvora Clan War Clash!\n[${challenge.challengerClanTag}] ${challenge.challengerClanName} vs [${challenge.targetClanTag}] ${challenge.targetClanName}\nFinal Score: ${scoreA} - ${scoreB}\n${isWinner ? "My clan emerged victorious! 🏆" : "Epic clan battle finished!"}`;
      if (navigator.canShare?.({ text: summaryText })) {
        try {
          await navigator.share({ title: "Juvora Clan War Results", text: summaryText });
          return;
        } catch {
          // ignore share cancel
        }
      }
      void copyWarReport();
    }

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Outcome Hero */}
        <section
          className={cn(
            "relative overflow-hidden rounded-3xl border p-8 text-center shadow-xl transition-all",
            isDraw
              ? "border-warning/40 bg-gradient-to-b from-warning/15 via-background to-background"
              : isWinner
                ? "border-warning/60 bg-gradient-to-b from-warning/20 via-primary/5 to-background shadow-glow"
                : "border-destructive/30 bg-gradient-to-b from-destructive/15 via-background to-background",
          )}
        >
          {isWinner && (
            <Sparkles className="animate-float text-warning absolute right-8 top-6 size-10" />
          )}

          <div
            className={cn(
              "mx-auto grid size-20 place-items-center rounded-3xl border shadow-lg",
              isDraw
                ? "border-warning/40 bg-warning/20 text-warning"
                : isWinner
                  ? "border-warning bg-gradient-to-br from-warning to-amber-600 text-black shadow-glow"
                  : "border-destructive/40 bg-destructive/15 text-destructive",
            )}
          >
            {isDraw ? (
              <Medal className="size-10" />
            ) : isWinner ? (
              <Trophy className="size-10" />
            ) : (
              <Shield className="size-10" />
            )}
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/80 px-4 py-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Swords className="size-3.5 text-primary" />
            Official Clan War Result • {challenge.format}
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            {isDraw
              ? "Honorable Clan Draw"
              : isWinner
                ? "Glorious Clan Victory!"
                : "Honorable Battle Defeat"}
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
            {isDraw
              ? "Both clans matched each other blow for blow in an evenly matched contest."
              : isWinner
                ? `Your clan dominated the arena and secured a decisive triumph!`
                : `Your clan fought with courage. Regroup, upgrade your roster, and rise again.`}
          </p>

          {/* Head-to-Head Scoreboard with clear CP and XP per clan */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Challenger Clan Card */}
            <div
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all",
                winnerId === challenge.challengerClanId
                  ? "border-warning/60 bg-warning/10 shadow-md ring-1 ring-warning/30"
                  : "border-border/60 bg-card/70",
              )}
            >
              {winnerId === challenge.challengerClanId && (
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-black text-warning border border-warning/40">
                  <Crown className="size-3" /> Winner
                </div>
              )}
              <div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
                  [{challenge.challengerClanTag}]
                </span>
                <h3 className="mt-1 truncate text-lg font-black text-foreground">
                  {challenge.challengerClanName}
                </h3>
                <span className="text-xs text-muted-foreground">Inviting Clan</span>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-border/50 pt-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Final War Score
                </span>
                <span className="tabular text-4xl font-black text-primary">{scoreA}</span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 p-2.5 text-xs font-bold">
                <span className="text-primary">+{cpGainA} CP</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-warning">+{xpGainA} Clan XP</span>
              </div>
            </div>

            {/* Target Clan Card */}
            <div
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all",
                winnerId === challenge.targetClanId
                  ? "border-warning/60 bg-warning/10 shadow-md ring-1 ring-warning/30"
                  : "border-border/60 bg-card/70",
              )}
            >
              {winnerId === challenge.targetClanId && (
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-black text-warning border border-warning/40">
                  <Crown className="size-3" /> Winner
                </div>
              )}
              <div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
                  [{challenge.targetClanTag}]
                </span>
                <h3 className="mt-1 truncate text-lg font-black text-foreground">
                  {challenge.targetClanName}
                </h3>
                <span className="text-xs text-muted-foreground">Opponent Clan</span>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-border/50 pt-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Final War Score
                </span>
                <span className="tabular text-4xl font-black text-primary">{scoreB}</span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 p-2.5 text-xs font-bold">
                <span className="text-primary">+{cpGainB} CP</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-warning">+{xpGainB} Clan XP</span>
              </div>
            </div>
          </div>
        </section>

        {/* Clan Progression & Rewards Breakdown */}
        <section className="surface-card space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Shield className="size-5 text-primary" />
              Your Clan's Rewards & Impact
            </h2>
            <span className="text-xs font-bold text-muted-foreground">
              {ownClan ? `[${ownClan.tag}] ${ownClan.name}` : "Your Clan"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
              <Shield className="mx-auto size-5 text-primary" />
              <div className="tabular mt-2 text-2xl font-black text-primary">
                +{myClanCpGain} CP
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                Competitive Points
              </div>
            </div>

            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-center">
              <Sparkles className="mx-auto size-5 text-warning" />
              <div className="tabular mt-2 text-2xl font-black text-warning">
                +{myClanXpGain} XP
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                Clan Progression
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-center">
              <Trophy className="mx-auto size-5 text-foreground" />
              <div className="tabular mt-2 text-2xl font-black text-foreground">
                {ownClan?.competitivePoints ?? "—"} CP
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                Total Clan CP
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-center">
              <Flame className="mx-auto size-5 text-warning" />
              <div className="tabular mt-2 text-2xl font-black text-foreground">
                Lvl {ownClan?.level ?? 1}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                Clan Level
              </div>
            </div>
          </div>
        </section>

        {/* Duel Combatants (MVP) Spotlight */}
        <section className="surface-card space-y-4 p-6">
          <div className="border-b border-border/60 pb-3">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Swords className="size-5 text-primary" />
              Duel Combatants Spotlight
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Frontline representatives who carried their clans into battle
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Fighter 1 */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <PlayerAvatar name={challengerFighterName} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-primary">
                    [{challenge.challengerClanTag}]
                  </span>
                  <span className="truncate text-sm font-black">{challengerFighterName}</span>
                  {scoreA > scoreB && (
                    <Crown className="size-4 shrink-0 text-warning" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                  <span>Score: <strong className="text-foreground">{scoreA} pts</strong></span>
                  <span>•</span>
                  <span>{scoreA > scoreB ? "Duel Champion" : "Combatant"}</span>
                </div>
              </div>
            </div>

            {/* Fighter 2 */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <PlayerAvatar name={targetFighterName} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-primary">
                    [{challenge.targetClanTag}]
                  </span>
                  <span className="truncate text-sm font-black">{targetFighterName}</span>
                  {scoreB > scoreA && (
                    <Crown className="size-4 shrink-0 text-warning" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                  <span>Score: <strong className="text-foreground">{scoreB} pts</strong></span>
                  <span>•</span>
                  <span>{scoreB > scoreA ? "Duel Champion" : "Combatant"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="flex-1 font-bold shadow-glow">
            <Link to="/clans">
              <Shield className="mr-2 size-4" />
              Return to Clan HQ
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="flex-1 font-bold"
            onClick={() => void copyWarReport()}
          >
            <Copy className="mr-2 size-4" />
            Copy Report
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="flex-1 font-bold"
            onClick={() => void shareWarReport()}
          >
            <Share2 className="mr-2 size-4" />
            Share Result
          </Button>
        </div>
      </div>
    );
  }

  if (challenge.status === "in_progress" && challenge.matchId) {
    return (
      <div className="surface-card space-y-4 p-8 text-center max-w-lg mx-auto">
        <Swords className="mx-auto size-12 text-primary animate-pulse" />
        <h1 className="text-2xl font-black">Clan War in Progress</h1>
        <p className="text-sm text-muted-foreground">
          The selected duel clash is currently active in the arena.
        </p>

        <Button
          size="lg"
          className="w-full font-bold"
          onClick={() => {
            const matchId = challenge.matchId;
            if (matchId) {
              void navigate({ to: "/match/$matchId", params: { matchId } });
            }
          }}
        >
          <Swords className="mr-2 size-4" />
          Enter Battle Arena
        </Button>
      </div>
    );
  }

  async function joinWar() {
    if (!fb || !user || !challenge || !membership || busy) return;
    const currentUid = user.uid;

    const isChallengerSide = membership.clanId === challenge.challengerClanId;
    const currentRoster = isChallengerSide ? challengerRoster : targetRoster;
    const field = isChallengerSide ? "challengerRoster" : "targetRoster";

    if (currentRoster.includes(currentUid)) return;

    if (currentRoster.length >= expectedPlayers) {
      toast.error(`This clan's ${challenge.format} roster is already full.`);
      return;
    }

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const challengeSnapshot = await transaction.get(challengeRef);

        if (!challengeSnapshot.exists()) {
          throw new Error("This war challenge is no longer available.");
        }

        const data = challengeSnapshot.data();
        if (data.status !== "accepted" && data.status !== "pending") {
          throw new Error("Roster cannot be modified right now.");
        }

        const roster = (data[field] ?? []) as string[];
        if (roster.includes(currentUid)) return;

        if (roster.length >= expectedPlayers) {
          throw new Error("Roster was filled by another member.");
        }

        transaction.update(challengeRef, {
          [field]: [...roster, currentUid],
        });
      });

      toast.success("You joined your clan's war roster.");
    } catch (error) {
      toast.error((error as Error).message || "Could not join the roster.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveWar() {
    if (!fb || !user || !challenge || !membership || busy) return;
    const currentUid = user.uid;

    const isChallengerSide = membership.clanId === challenge.challengerClanId;
    const field = isChallengerSide ? "challengerRoster" : "targetRoster";

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const challengeSnapshot = await transaction.get(challengeRef);

        if (!challengeSnapshot.exists()) return;
        const data = challengeSnapshot.data();
        if (data.status !== "accepted" && data.status !== "pending") return;

        const roster = (data[field] ?? []) as string[];
        transaction.update(challengeRef, {
          [field]: roster.filter((id) => id !== currentUid),
        });
      });

      toast.success("You left the war roster.");
    } catch (error) {
      toast.error((error as Error).message || "Could not leave roster.");
    } finally {
      setBusy(false);
    }
  }

  async function startWar() {
    if (!fb || !user || !challenge || !membership || busy) return;

    if (!canPerformClanAction(membership.role, "battle")) {
      toast.error("Only clan officers can start a clan war match.");
      return;
    }

    // Strict presence validation
    if (!hasInvitingClanOnline) {
      toast.error(
        `Cannot start war: At least one player from the inviting clan ([${challenge.challengerClanTag}]) must be online in this room.`,
      );
      return;
    }

    if (!hasTargetClanOnline) {
      toast.error(
        `Cannot start war: At least one player from the opponent clan ([${challenge.targetClanTag}]) must be online in this room.`,
      );
      return;
    }

    const challengerPlayers = challenge.challengerRoster ?? [];
    const targetPlayers = challenge.targetRoster ?? [];

    if (
      challengerPlayers.length < expectedPlayers ||
      targetPlayers.length < expectedPlayers
    ) {
      toast.error(`Both clans need ${expectedPlayers} selected member(s) to start.`);
      return;
    }

    const nextQuestionCount = Math.max(
      10,
      Math.min(30, Number(questionCount) || getClanWarQuestionCount(challenge.format)),
    );

    const nextSubjects = Array.from(
      new Set(
        customSubjects
          .split(",")
          .map((subject) => subject.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    setBusy(true);

    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const challengeSnapshot = await transaction.get(challengeRef);

        if (!challengeSnapshot.exists()) {
          throw new Error("This war is no longer available.");
        }

        const current = challengeSnapshot.data();
        if (current.status !== "accepted") {
          throw new Error("This war is not accepted or ready to start yet.");
        }

        if ((current.challengerRoster ?? []).length < expectedPlayers) {
          throw new Error("The challenger side is not full yet.");
        }

        if ((current.targetRoster ?? []).length < expectedPlayers) {
          throw new Error("The target side is not full yet.");
        }

        transaction.update(challengeRef, {
          status: "starting",
          settings: {
            subjects: nextSubjects,
            questionCount: nextQuestionCount,
            secondsPerQuestion,
          },
        });
      });

      const matchId = await startClanWarMatch({
        db: fb.db,
        challengeId: challenge.id,
        clanAId: challenge.challengerClanId,
        clanBId: challenge.targetClanId,
        challengerRoster: challengerPlayers,
        targetRoster: targetPlayers,
        memberLookup,
        hostUid: user.uid,
        format: challenge.format,
        explicitSubjects: nextSubjects,
        secondsPerQuestion,
        questionCount: nextQuestionCount,
      });

      void navigate({
        to: "/match/$matchId",
        params: { matchId },
      });
    } catch (error) {
      toast.error((error as Error).message || "Could not start the clan war.");
    } finally {
      setBusy(false);
    }
  }

  const sideName = (clanId: string) =>
    clanId === challenge.challengerClanId
      ? `[${challenge.challengerClanTag}] ${challenge.challengerClanName}`
      : `[${challenge.targetClanTag}] ${challenge.targetClanName}`;

  const subjects = buildClanWarQuestionSubjects(
    challenge.format,
    challenge.settings?.subjects,
  );

  const isPending = challenge.status === "pending";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-black uppercase text-primary">
              Clan War Arena
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {challenge.format} format
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">
            [{challenge.challengerClanTag}] vs [{challenge.targetClanTag}]
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Status:{" "}
            <span
              className={cn(
                "font-black uppercase",
                challenge.status === "accepted" ? "text-success" : "text-warning",
              )}
            >
              {challenge.status}
            </span>{" "}
            • Lock in roster combatants below
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link to="/clans">
            <Shield className="mr-1.5 size-4" />
            Back to Clan HQ
          </Link>
        </Button>
      </div>

      {isPending && (
        <div className="surface-card border-warning/40 bg-warning/5 p-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-black text-warning flex items-center justify-center sm:justify-start gap-1.5">
              <Clock className="size-4" />
              War Invitation Awaiting Acceptance
            </div>
            <p className="text-xs text-muted-foreground">
              {isInvitingClan
                ? `Waiting for [${challenge.targetClanTag}] officers to accept your war challenge.`
                : `Your clan has been challenged! An officer can accept from the Clans War Arena tab.`}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/clans">View in Clan Arena</Link>
          </Button>
        </div>
      )}

      {/* Online War Room Presence Bar */}
      <section className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Radio className="size-3.5 text-primary animate-pulse" />
            Active Clan Presence in War Room
          </h2>
          <span className="text-xs font-bold">
            {presences.length} player(s) present
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Inviting Clan Presence */}
          <div
            className={cn(
              "rounded-xl border p-3 text-xs transition-all",
              hasInvitingClanOnline
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    hasInvitingClanOnline ? "bg-success animate-pulse" : "bg-destructive",
                  )}
                />
                [{challenge.challengerClanTag}] {challenge.challengerClanName}
              </span>
              <span
                className={cn(
                  "text-[11px] font-black uppercase",
                  hasInvitingClanOnline ? "text-success" : "text-destructive",
                )}
              >
                {hasInvitingClanOnline ? "Online" : "No players in room"}
              </span>
            </div>
            {invitingClanOnline.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {invitingClanOnline.map((p) => (
                  <span
                    key={p.uid}
                    className="rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-semibold border border-border/50"
                  >
                    {p.username}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Opponent Clan Presence */}
          <div
            className={cn(
              "rounded-xl border p-3 text-xs transition-all",
              hasTargetClanOnline
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    hasTargetClanOnline ? "bg-success animate-pulse" : "bg-destructive",
                  )}
                />
                [{challenge.targetClanTag}] {challenge.targetClanName}
              </span>
              <span
                className={cn(
                  "text-[11px] font-black uppercase",
                  hasTargetClanOnline ? "text-success" : "text-destructive",
                )}
              >
                {hasTargetClanOnline ? "Online" : "No players in room"}
              </span>
            </div>
            {targetClanOnline.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {targetClanOnline.map((p) => (
                  <span
                    key={p.uid}
                    className="rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-semibold border border-border/50"
                  >
                    {p.username}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!hasBothClansOnline && (
          <div className="rounded-lg bg-warning/10 p-2.5 text-xs text-warning flex items-center gap-2 border border-warning/20">
            <Clock className="size-4 shrink-0" />
            <span>
              <strong>War Launch Locked:</strong> At least one player from each clan must be
              online inside this waiting room before the battle can start.
            </span>
          </div>
        )}
      </section>

      {/* Roster Cards for Both Clans */}
      <section className="grid gap-3 md:grid-cols-2">
        {[challenge.challengerClanId, challenge.targetClanId].map((clanId) => {
          const roster =
            clanId === challenge.challengerClanId
              ? challengerRoster
              : targetRoster;
          const isMySide = clanId === membership.clanId;
          const maxRoster = expectedPlayers;
          const canJoinThisSide =
            isMySide &&
            (challenge.status === "accepted" ||
              (challenge.status === "pending" && isInvitingClan));

          return (
            <div key={clanId} className="surface-card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black flex items-center gap-1.5">
                  <Shield className="size-4 text-primary" />
                  {sideName(clanId)}
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {roster.length}/{maxRoster} players
                </span>
              </div>

              <div className="space-y-2">
                {roster.map((playerUid, index) => {
                  const member = memberLookup.get(playerUid);
                  const isCurrent = playerUid === user.uid;
                  return (
                    <div
                      key={playerUid}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-2.5",
                        isCurrent
                          ? "border-primary bg-primary/10"
                          : "border-border/60 bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <PlayerAvatar
                          name={
                            member?.username ??
                            (isCurrent ? profile.username : `Fighter #${index + 1}`)
                          }
                          size={28}
                        />
                        <span className="text-xs font-bold">
                          {member?.username ??
                            (isCurrent ? profile.username : `Member (${playerUid.slice(0, 5)})`)}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Spot #{index + 1}
                      </span>
                    </div>
                  );
                })}

                {Array.from({ length: Math.max(0, maxRoster - roster.length) }).map(
                  (_, emptyIndex) => (
                    <div
                      key={emptyIndex}
                      className="rounded-xl border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground"
                    >
                      Empty Spot #{roster.length + emptyIndex + 1}
                    </div>
                  ),
                )}
              </div>

              {canJoinThisSide && (
                <div className="pt-2">
                  {roster.includes(user.uid) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive"
                      disabled={busy}
                      onClick={() => void leaveWar()}
                    >
                      Leave Roster
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full font-bold"
                      disabled={busy || roster.length >= maxRoster}
                      onClick={() => void joinWar()}
                    >
                      Join Roster ({maxRoster - roster.length} spot left)
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* War Launch Configuration (Available to officers of either clan once ready) */}
      {(canConfigure || canLaunch) && (
        <section className="surface-card space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="flex items-center gap-2 font-black text-base">
              <Swords className="size-4 text-primary" />
              War Launch & Match Settings
            </h2>
            <span className="text-xs text-muted-foreground font-semibold">
              Officer Controls
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">
              <span>Question Count</span>
              <Input
                type="number"
                min={10}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                disabled={busy}
              />
            </label>

            <label className="space-y-1 text-xs font-semibold">
              <span>Seconds / Question</span>
              <Input
                type="number"
                min={5}
                max={60}
                value={secondsPerQuestion}
                onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
                disabled={busy}
              />
            </label>

            <label className="space-y-1 text-xs font-semibold">
              <span>Subject Pool</span>
              <Input
                value={customSubjects}
                onChange={(e) => setCustomSubjects(e.target.value)}
                placeholder="general, mathematics, english"
                disabled={busy}
              />
            </label>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm flex items-center">
            <CheckCircle2 className="mr-2 size-4 text-primary shrink-0" />
            <span>Duel uses random pool from: {subjects.join(", ")}.</span>
          </div>

          <Button
            className="w-full font-bold shadow-glow"
            disabled={
              busy ||
              isPending ||
              challengerRoster.length < expectedPlayers ||
              targetRoster.length < expectedPlayers ||
              !hasBothClansOnline
            }
            onClick={() => void startWar()}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            {busy
              ? "Starting war…"
              : isPending
                ? "Waiting for opponent to accept…"
                : !hasBothClansOnline
                  ? !hasInvitingClanOnline && !hasTargetClanOnline
                    ? "Waiting for players from both clans to be online"
                    : !hasInvitingClanOnline
                      ? `Waiting for [${challenge.challengerClanTag}] player to be online`
                      : `Waiting for [${challenge.targetClanTag}] player to be online`
                  : challengerRoster.length >= expectedPlayers &&
                      targetRoster.length >= expectedPlayers
                    ? "Start Clan War Now"
                    : `Waiting for ${expectedPlayers} player(s) per side`}
          </Button>
        </section>
      )}

      {!isInvitingClan && challenge.status === "accepted" && (
        <div className="surface-card p-4 space-y-3">
          {canLaunch ? (
            <Button
              className="w-full font-bold shadow-glow"
              disabled={busy}
              onClick={() => void startWar()}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              {busy ? "Launching War…" : "Launch Clan War Clash"}
            </Button>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {!hasBothClansOnline
                  ? "At least one player from each clan must be online in this room."
                  : challengerRoster.length < expectedPlayers || targetRoster.length < expectedPlayers
                    ? `Waiting for both clans to fill ${expectedPlayers} spot(s) on their roster.`
                    : "War room is ready."}
              </span>
              <span className="font-bold">
                {challengerRoster.length}/{expectedPlayers} vs {targetRoster.length}/{expectedPlayers}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
