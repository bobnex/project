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
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Flame,
  Loader2,
  LogOut,
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
  component: ClanWarWaitingRoom,
  head: () => ({
    title: "Clan War Waiting Room | Juvora Esports",
    meta: [{ name: "description", content: "Set up, launch, and review your clan war." }],
  }),
});

function ClanWarWaitingRoom() {
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

  // Online presences inside this specific clan war room
  const [presences, setPresences] = useState<WarPresence[]>([]);

  const [subjects, setSubjects] = useState<string[]>(["general", "mathematics", "english"]);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(15);
  const [questionCount, setQuestionCount] = useState(10);

  // 1. Listen for challenge updates
  useEffect(() => {
    if (!fb) return;

    return onSnapshot(
      doc(fb.db, "clanBattles", challengeId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setChallenge(null);
          setLoading(false);
          return;
        }

        const data = { ...snapshot.data(), id: snapshot.id } as WarChallenge;
        setChallenge(data);

        const nextSubjects =
          data.settings?.subjects?.length
            ? data.settings.subjects
            : buildClanWarQuestionSubjects(data.format, ["general", "mathematics", "english"]);

        setSubjects(nextSubjects);
        setSecondsPerQuestion(data.settings?.secondsPerQuestion ?? 15);
        setQuestionCount(
          data.settings?.questionCount ?? getClanWarQuestionCount(data.format),
        );
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

    return onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid)),
      (snapshot) => {
        const item = snapshot.docs[0];
        if (!item) {
          setMembership(null);
          return;
        }

        setMembership({
          ...item.data(),
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

  // 3. Load clans
  useEffect(() => {
    if (!fb || !ownClanId) {
      setOwnClan(null);
      return;
    }

    return onSnapshot(doc(fb.db, "clans", ownClanId), (snapshot) => {
      setOwnClan(
        snapshot.exists()
          ? ({ ...snapshot.data(), id: snapshot.id } as ClanDoc)
          : null,
      );
    });
  }, [fb, ownClanId]);

  useEffect(() => {
    if (!fb || !opposingClanId) {
      setOpponentClan(null);
      return;
    }

    return onSnapshot(doc(fb.db, "clans", opposingClanId), (snapshot) => {
      setOpponentClan(
        snapshot.exists()
          ? ({ ...snapshot.data(), id: snapshot.id } as ClanDoc)
          : null,
      );
    });
  }, [fb, opposingClanId]);

  // 4. Load own clan members for display
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
            (item) =>
              ({
                ...item.data(),
                uid: item.data().uid ?? item.id.split("_").slice(1).join("_"),
              }) as ClanMember,
          ),
        );
      },
    );
  }, [fb, ownClanId]);

  // 5. Active Presence Heartbeat in this war room
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
    const interval = setInterval(sendHeartbeat, 8_000);

    return () => {
      clearInterval(interval);
      void deleteDoc(presenceRef).catch(() => {});
    };
  }, [fb, user, profile?.username, membership?.clanId, challengeId]);

  // 6. Listen for all online presence in this war room
  useEffect(() => {
    if (!fb || !challengeId) return;

    const presenceCol = collection(fb.db, "clanBattles", challengeId, "presence");
    return onSnapshot(
      presenceCol,
      (snapshot) => {
        const now = Date.now();
        const active: WarPresence[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as WarPresence;
          // Player must have sent a heartbeat within the last 25 seconds
          if (data && now - (data.lastSeen || 0) < 25_000) {
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

  // Either clan's officers can launch once both rosters are locked in AND both clans are online
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
        <h1 className="text-xl font-black">Clan war unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This invitation could not be found or has been removed.
        </p>
        <Button asChild variant="outline">
          <Link to="/clans">
            <ArrowLeft className="mr-2 size-4" />
            Back to clans
          </Link>
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
          You must belong to one of the clans in this war to enter its waiting room.
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
    const winnerId = challenge.winnerClanId;
    const isWinner = winnerId === ownClanId;
    const isDraw = winnerId === null;
    const isChallengerClan = ownClanId === challenge.challengerClanId;

    const myClanCpGain = isDraw ? 10 : isWinner ? 25 : 0;
    const myClanXpGain = isDraw ? 50 : isWinner ? 100 : 25;

    const challengerFighter = challenge.playerOneUid;
    const targetFighter = challenge.playerTwoUid;

    const challengerFighterName =
      memberLookup.get(challengerFighter ?? "")?.username ??
      (challengerFighter === user.uid ? profile.username : "Clan Challenger");
    const targetFighterName =
      memberLookup.get(targetFighter ?? "")?.username ??
      (targetFighter === user.uid ? profile.username : "Opponent Champion");

    async function copyWarReport() {
      const summaryText = `⚔️ CLAN WAR REPORT\n[${challenge.challengerClanTag}] ${challenge.challengerClanName}: ${scoreA} pts\n[${challenge.targetClanTag}] ${challenge.targetClanName}: ${scoreB} pts\nResult: ${isDraw ? "Honorable Draw" : isWinner ? "Clan Victory!" : "Clan Defeat"}\nClan Points: +${myClanCpGain} CP | XP: +${myClanXpGain} XP`;
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

          {/* Epic Clan Versus Scoreboard */}
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
            </div>
          </div>
        </section>

        {/* Clan Progression & Rewards Breakdown */}
        <section className="surface-card space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Shield className="size-5 text-primary" />
              Clan Rewards & Standing Impact
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
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4",
                scoreA >= scoreB && scoreA > 0
                  ? "border-warning/50 bg-warning/5"
                  : "border-border/60 bg-muted/30",
              )}
            >
              <PlayerAvatar
                name={challengerFighterName}
                size={48}
                ring={scoreA >= scoreB && scoreA > 0}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-black">
                    {challengerFighterName}
                  </span>
                  {scoreA >= scoreB && scoreA > 0 && (
                    <Crown className="size-4 text-warning shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  [{challenge.challengerClanTag}] {challenge.challengerClanName}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-xl font-black text-primary">{scoreA}</div>
                <div className="text-[10px] font-bold text-muted-foreground">pts</div>
              </div>
            </div>

            {/* Fighter 2 */}
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4",
                scoreB >= scoreA && scoreB > 0
                  ? "border-warning/50 bg-warning/5"
                  : "border-border/60 bg-muted/30",
              )}
            >
              <PlayerAvatar
                name={targetFighterName}
                size={48}
                ring={scoreB >= scoreA && scoreB > 0}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-black">{targetFighterName}</span>
                  {scoreB >= scoreA && scoreB > 0 && (
                    <Crown className="size-4 text-warning shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  [{challenge.targetClanTag}] {challenge.targetClanName}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-xl font-black text-primary">{scoreB}</div>
                <div className="text-[10px] font-bold text-muted-foreground">pts</div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button asChild size="lg" className="w-full font-bold shadow-glow">
            <Link to="/clans">
              <Shield className="mr-2 size-4" />
              Clan HQ
            </Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="w-full font-bold">
            <Link to="/clans">
              <Swords className="mr-2 size-4" />
              War Arena
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full font-bold"
            onClick={() => void copyWarReport()}
          >
            <Copy className="mr-2 size-4" />
            Copy Report
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full font-bold"
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
          throw new Error("This war room is no longer available.");
        }

        const data = challengeSnapshot.data();
        if (data.status !== "accepted" && data.status !== "pending") {
          throw new Error("The war is no longer accepting players.");
        }

        const roster = (data[field] ?? []) as string[];
        if (roster.includes(currentUid)) return;

        if (roster.length >= expectedPlayers) {
          throw new Error("Your clan's roster is already full.");
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

      toast.info("You stepped down from the war roster.");
    } catch (error) {
      toast.error((error as Error).message || "Could not leave the roster.");
    } finally {
      setBusy(false);
    }
  }

  async function startWar() {
    if (!fb || !user || !challenge || (!canConfigure && !canLaunch) || busy) return;

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
        (subjects.length ? subjects : ["general", "mathematics", "english"]).map((s) =>
          String(s).trim().toLowerCase(),
        ),
      ),
    ).filter(Boolean);

    if (nextSubjects.length === 0) {
      toast.error("Select at least one subject category.");
      return;
    }

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
      ? challenge.challengerClanName
      : challenge.targetClanName;

  const isPending = challenge.status === "pending";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Pending status banner for inviter */}
      {isPending && (
        <div className="surface-card flex items-center justify-between gap-3 p-4 border border-warning/40 bg-warning/5 rounded-xl">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-warning shrink-0 animate-pulse" />
            <div>
              <div className="text-sm font-bold text-foreground">
                Awaiting Opponent Acceptance
              </div>
              <div className="text-xs text-muted-foreground">
                [{challenge.targetClanTag}] {challenge.targetClanName} has not accepted yet.
                You can lock in your roster spot and customize settings in advance!
              </div>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/clans">Back to Clans</Link>
          </Button>
        </div>
      )}

      {/* Main Header */}
      <section className="hero-card relative overflow-hidden p-6">
        <Shield className="absolute -right-4 -top-5 size-32 text-primary/10" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="size-4 text-primary" />
            Clan War Waiting Room
          </div>

          <h1 className="mt-4 text-2xl font-black sm:text-3xl">
            {challenge.challengerClanName}
            <span className="mx-3 text-primary">vs</span>
            {challenge.targetClanName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challenge.format} format • mixed question pool • {questionCount} questions
          </p>
        </div>
      </section>

      {/* Real-time Clan Presence Bar */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Radio className="size-3.5 text-primary animate-pulse" />
            Active Clan Presence in War Room
          </div>
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              hasBothClansOnline
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                : "bg-warning/10 text-warning border border-warning/30",
            )}
          >
            {hasBothClansOnline
              ? "✓ Both Clans Present"
              : "Waiting for Opposing Clan"}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Inviting Clan Online Status */}
          <div
            className={cn(
              "rounded-xl border p-3 text-sm transition-all",
              hasInvitingClanOnline
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-warning/30 bg-warning/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    hasInvitingClanOnline
                      ? "bg-emerald-500 animate-ping"
                      : "bg-warning",
                  )}
                />
                [{challenge.challengerClanTag}] {challenge.challengerClanName}
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {invitingClanOnline.length} online
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {invitingClanOnline.length ? (
                invitingClanOnline.map((p) => (
                  <span
                    key={p.uid}
                    className="rounded-md bg-background/80 px-2 py-0.5 font-medium border border-border/60"
                  >
                    {p.username}
                    {p.uid === user.uid ? " (you)" : ""}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Awaiting player from inviting clan to enter room...
                </span>
              )}
            </div>
          </div>

          {/* Target Clan Online Status */}
          <div
            className={cn(
              "rounded-xl border p-3 text-sm transition-all",
              hasTargetClanOnline
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-warning/30 bg-warning/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    hasTargetClanOnline
                      ? "bg-emerald-500 animate-ping"
                      : "bg-warning",
                  )}
                />
                [{challenge.targetClanTag}] {challenge.targetClanName}
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {targetClanOnline.length} online
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {targetClanOnline.length ? (
                targetClanOnline.map((p) => (
                  <span
                    key={p.uid}
                    className="rounded-md bg-background/80 px-2 py-0.5 font-medium border border-border/60"
                  >
                    {p.username}
                    {p.uid === user.uid ? " (you)" : ""}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Awaiting player from opponent clan to enter room...
                </span>
              )}
            </div>
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
                  {roster.length}/{maxRoster} slots filled
                </span>
              </div>

              {roster.length ? (
                <div className="space-y-2">
                  {roster.map((uid, index) => (
                    <div
                      key={uid}
                      className="flex items-center gap-2 rounded-lg bg-muted/60 p-2 text-sm"
                    >
                      {index === 0 && <Crown className="size-4 text-warning" />}
                      <span className="truncate">
                        {memberLookup.get(uid)?.username ??
                          (uid === user.uid ? profile.username : "Clan champion")}
                        {uid === user.uid ? " (you)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No members have locked in their roster spot yet.
                </div>
              )}

              {canJoinThisSide && (
                <div className="pt-1">
                  {!roster.includes(user.uid) ? (
                    <Button
                      variant="outline"
                      className="w-full font-bold"
                      disabled={busy || roster.length >= maxRoster}
                      onClick={() => void joinWar()}
                    >
                      <Users className="mr-2 size-4" />
                      Lock in my roster spot
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => void leaveWar()}
                    >
                      <LogOut className="mr-2 size-3" />
                      Step down from roster
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Host Controls & Match Launch */}
      {canConfigure && (
        <section className="surface-card space-y-4 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-black">
              <Crown className="size-4 text-warning" />
              War Setup & Launch
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure duel parameters, then launch once both sides fill rosters and have
              players online.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">
              <span>Question Pool Subjects</span>
              <Input
                value={subjects.join(", ")}
                onChange={(e) =>
                  setSubjects(
                    e.target.value
                      .split(",")
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
                placeholder="general, mathematics, english"
                disabled={busy}
              />
            </label>

            <label className="space-y-1 text-xs font-semibold">
              <span>Question Count (10-30)</span>
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
              <span>Time Per Question (sec)</span>
              <Input
                type="number"
                min={5}
                max={60}
                value={secondsPerQuestion}
                onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
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
              Both Rosters Full & Online — Launch Clan War
            </Button>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary shrink-0" />
              {!hasBothClansOnline
                ? !hasInvitingClanOnline
                  ? `Waiting for a player from [${challenge.challengerClanTag}] to be online in room`
                  : `Waiting for a player from [${challenge.targetClanTag}] to be online in room`
                : "Waiting for rosters to be filled and match launch."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
