import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { Award, Check, Shield, Swords, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import {
  canPerformClanAction,
  INITIAL_ACHIEVEMENTS,
  type ClanBattleChallenge,
  type ClanDoc,
  type ClanMember,
} from "@/lib/clans";

type Invite = ClanBattleChallenge & { id: string };

export function ClanWarInviteListener() {
  const { fb, user } = useApp();
  let navigate: ReturnType<typeof useNavigate> | null = null;
  let currentPath = "";

  try {
    navigate = useNavigate();
  } catch {
    // Graceful fallback for test environments
  }

  try {
    currentPath = useRouterState({ select: (s) => s.location.pathname });
  } catch {
    currentPath = "";
  }

  const [membership, setMembership] = useState<ClanMember | null>(null);
  const [incomingInvites, setIncomingInvites] = useState<Invite[]>([]);
  const [acceptedChallenges, setAcceptedChallenges] = useState<Invite[]>([]);
  const [challenger, setChallenger] = useState<ClanDoc | null>(null);
  const [achievementIds, setAchievementIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dismissedAcceptedId, setDismissedAcceptedId] = useState<string | null>(null);

  const clanId = membership?.clanId ?? null;

  // 1. Listen for user clan membership
  useEffect(() => {
    if (!fb || !user) {
      setMembership(null);
      return;
    }

    return onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid)),
      (snapshot) => {
        const item = snapshot.docs[0];
        setMembership(item ? ({ ...item.data(), uid: user.uid } as ClanMember) : null);
      },
      () => setMembership(null),
    );
  }, [fb, user]);

  // 2. Listen for challenges affecting the user's clan
  useEffect(() => {
    if (!fb || !clanId) {
      setIncomingInvites([]);
      setAcceptedChallenges([]);
      return;
    }

    return onSnapshot(
      collection(fb.db, "clanBattles"),
      (snapshot) => {
        const allBattles = snapshot.docs.map(
          (item) => ({ ...item.data(), id: item.id }) as Invite,
        );

        // Incoming pending challenges (I am target clan)
        const incoming = allBattles
          .filter((b) => b.targetClanId === clanId && b.status === "pending")
          .sort((a, b) => b.createdAt - a.createdAt);
        setIncomingInvites(incoming);

        // Accepted challenges awaiting match launch (I am the challenger clan)
        const accepted = allBattles
          .filter(
            (b) =>
              b.challengerClanId === clanId &&
              b.status === "accepted" &&
              !b.matchId,
          )
          .sort((a, b) => (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt));
        setAcceptedChallenges(accepted);
      },
      () => {
        setIncomingInvites([]);
        setAcceptedChallenges([]);
      },
    );
  }, [fb, clanId]);

  const incomingInvite = incomingInvites[0] ?? null;

  // Most recent accepted war that hasn't been dismissed or navigated to
  const currentAcceptedWar =
    acceptedChallenges.find(
      (w) => w.id !== dismissedAcceptedId && !currentPath.includes(w.id),
    ) ?? null;

  // Load details for incoming challenger
  useEffect(() => {
    if (!fb || !incomingInvite) {
      setChallenger(null);
      setAchievementIds([]);
      return;
    }

    const unsubscribeClan = onSnapshot(
      doc(fb.db, "clans", incomingInvite.challengerClanId),
      (snapshot) => {
        setChallenger(
          snapshot.exists()
            ? ({ ...snapshot.data(), id: snapshot.id } as ClanDoc)
            : null,
        );
      },
      () => setChallenger(null),
    );

    const unsubscribeAchievements = onSnapshot(
      query(
        collection(fb.db, "clanUnlockedAchievements"),
        where("clanId", "==", incomingInvite.challengerClanId),
      ),
      (snapshot) => {
        setAchievementIds(
          snapshot.docs
            .map((item) => item.data().achievementId as string | undefined)
            .filter((id): id is string => !!id),
        );
      },
      () => setAchievementIds([]),
    );

    return () => {
      unsubscribeClan();
      unsubscribeAchievements();
    };
  }, [fb, incomingInvite?.id, incomingInvite?.challengerClanId]);

  async function respond(accept: boolean) {
    if (!fb || !user || !clanId || !incomingInvite || busy) return;

    if (!membership || !canPerformClanAction(membership.role, "battle")) {
      toast.error("Only Clan Leaders, Co-Leaders, or Generals can accept or reject clan wars.");
      return;
    }

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", incomingInvite.id);
        const challengeSnapshot = await transaction.get(challengeRef);

        if (!challengeSnapshot.exists()) {
          throw new Error("This war invitation is no longer available.");
        }

        const challenge = challengeSnapshot.data();
        if (challenge.targetClanId !== clanId || challenge.status !== "pending") {
          throw new Error("This war invitation has already been resolved.");
        }

        transaction.update(challengeRef, {
          status: accept ? "accepted" : "rejected",
          resolvedAt: Date.now(),
        });
      });

      toast.success(
        accept
          ? "War invitation accepted! Entering the clan war lobby."
          : "War invitation rejected.",
      );

      if (accept && navigate) {
        void navigate({
          to: "/clan-war/$challengeId",
          params: { challengeId: incomingInvite.id },
        });
      }
    } catch (error) {
      toast.error((error as Error).message || "Could not respond to the invitation.");
    } finally {
      setBusy(false);
    }
  }

  // --- Modal 1: Notification to Challenger that opponent ACCEPTED ---
  if (currentAcceptedWar) {
    return (
      <Dialog open onOpenChange={() => setDismissedAcceptedId(currentAcceptedWar.id)}>
        <DialogContent
          className="max-w-md overflow-hidden p-0 border-primary/40 shadow-2xl"
          onEscapeKeyDown={() => setDismissedAcceptedId(currentAcceptedWar.id)}
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/25 via-background to-accent/20 border-b border-border/60 p-5">
            <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary w-fit mb-3">
              <Swords className="size-4 animate-bounce" />
              War Challenge Accepted!
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <span>[{currentAcceptedWar.targetClanTag}] {currentAcceptedWar.targetClanName}</span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-foreground/80 text-sm">
                The rival clan accepted your challenge. The war room is now open for roster locking and match launch!
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-border bg-card/60 p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground uppercase font-bold">Format</span>
              <span className="font-black text-sm uppercase text-primary">
                {currentAcceptedWar.format} Duel
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDismissedAcceptedId(currentAcceptedWar.id)}
              >
                Later
              </Button>
              <Button
                className="flex-1 font-bold shadow-glow"
                onClick={() => {
                  setDismissedAcceptedId(currentAcceptedWar.id);
                  if (navigate) {
                    void navigate({
                      to: "/clan-war/$challengeId",
                      params: { challengeId: currentAcceptedWar.id },
                    });
                  }
                }}
              >
                <Swords className="mr-2 size-4" />
                Enter War Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // --- Modal 2: Incoming War Invite for Target Clan ---
  if (!incomingInvite) return null;

  const unlockedAchievements = INITIAL_ACHIEVEMENTS.filter((achievement) =>
    achievementIds.includes(achievement.id),
  ).slice(0, 3);

  const canRespond = membership && canPerformClanAction(membership.role, "battle");

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md overflow-hidden p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div
          className="relative overflow-hidden border-b border-border/60 p-5"
          style={{
            background:
              challenger?.banner ??
              "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.12))",
          }}
        >
          <div className="absolute inset-0 bg-background/35 backdrop-blur-[2px]" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-3 py-1 text-xs font-bold">
              <Swords className="size-4 text-primary" />
              Incoming clan war
            </div>

            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/80 text-2xl">
                  {challenger?.emblem ?? "🛡️"}
                </span>
                <span>
                  {incomingInvite.challengerClanName}
                  <span className="ml-2 text-sm font-black text-primary">
                    [{incomingInvite.challengerClanTag}]
                  </span>
                </span>
              </DialogTitle>
              <DialogDescription className="mt-2 text-foreground/80">
                {challenger?.motto || challenger?.description || "A rival clan has challenged your team."}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Proposed format
                </div>
                <div className="mt-1 flex items-center gap-2 text-lg font-black">
                  <Swords className="size-4 text-primary" />
                  {incomingInvite.format}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invitation sent
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {new Date(incomingInvite.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <section aria-label="Challenger clan overview">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Shield className="size-4 text-primary" />
              Clan overview
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <OverviewStat label="Level" value={challenger ? `${challenger.level}` : "—"} />
              <OverviewStat
                label="Competitive points"
                value={challenger ? `${challenger.competitivePoints} CP` : "—"}
              />
              <OverviewStat
                label="Members"
                value={challenger ? `${challenger.memberCount}/${challenger.maxMembers}` : "—"}
              />
              <OverviewStat
                label="War record"
                value={
                  challenger
                    ? `${challenger.totalBattlesWon}W – ${challenger.totalBattlesLost}L`
                    : "—"
                }
              />
            </div>
          </section>

          <section aria-label="Challenger clan achievements">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4 text-warning" />
              Achievements
              {challenger && (
                <span className="ml-auto normal-case tracking-normal">
                  {challenger.achievementsUnlockedCount} unlocked
                </span>
              )}
            </h3>

            {unlockedAchievements.length > 0 ? (
              <div className="space-y-2">
                {unlockedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5"
                  >
                    <Award className="size-4 shrink-0 text-warning" />
                    <span className="text-sm font-bold">{achievement.title}</span>
                    <span className="ml-auto text-[10px] capitalize text-muted-foreground">
                      {achievement.rarity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No unlocked achievements to display yet.
              </p>
            )}
          </section>

          {!canRespond && (
            <p className="text-[11px] text-muted-foreground italic text-center">
              Awaiting response from Clan Leader or Officers.
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-border/60 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy || !canRespond}
              onClick={() => void respond(false)}
            >
              <X className="mr-2 size-4" />
              Reject
            </Button>
            <Button
              className="flex-1 font-bold"
              disabled={busy || !canRespond}
              onClick={() => void respond(true)}
            >
              <Check className="mr-2 size-4" />
              {busy ? "Responding…" : "Accept war"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  const Icon = label === "Members" ? Users : Shield;

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}
