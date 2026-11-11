import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
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
import { INITIAL_ACHIEVEMENTS, type ClanBattleChallenge, type ClanDoc } from "@/lib/clans";

type Invite = ClanBattleChallenge & { id: string };

export function ClanWarInviteListener() {
  const { fb, user } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [clanId, setClanId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Invite[]>([]);
  const [challenger, setChallenger] = useState<ClanDoc | null>(null);
  const [achievementIds, setAchievementIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fb || !user) {
      setClanId(null);
      return;
    }

    return onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid)),
      (snapshot) => {
        setClanId(
          (snapshot.docs[0]?.data().clanId as string | undefined) ?? null,
        );
      },
      () => setClanId(null),
    );
  }, [fb, user]);

  // Listen to both incoming invitations and accepted wars for this clan.
  useEffect(() => {
    if (!fb || !clanId) {
      setChallenges([]);
      return;
    }

    return onSnapshot(
      collection(fb.db, "clanBattles"),
      (snapshot) => {
        const relevant = snapshot.docs
          .map((item) => ({ ...item.data(), id: item.id }) as Invite)
          .filter(
            (challenge) =>
              challenge.challengerClanId === clanId ||
              challenge.targetClanId === clanId,
          )
          .sort((a, b) => b.createdAt - a.createdAt);

        setChallenges(relevant);
      },
      () => setChallenges([]),
    );
  }, [fb, clanId]);

  const incomingInvite =
    challenges.find(
      (challenge) =>
        challenge.targetClanId === clanId && challenge.status === "pending",
    ) ?? null;

  // Once accepted, route members of both clans into the shared waiting room.
  useEffect(() => {
    const accepted = challenges.find(
      (challenge) =>
        (challenge.status === "accepted" || challenge.status === "starting") &&
        (challenge.challengerClanId === clanId ||
          challenge.targetClanId === clanId),
    );

    if (!accepted || pathname.startsWith("/clan-war/")) return;

    void navigate({
      to: "/clan-war/$challengeId" as never,
      params: { challengeId: accepted.id } as never,
    });
  }, [challenges, clanId, pathname, navigate]);

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

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", incomingInvite.id);
        const membershipRef = doc(
          fb.db,
          "clanMembers",
          `${clanId}_${user.uid}`,
        );

        const [challengeSnapshot, membershipSnapshot] = await Promise.all([
          transaction.get(challengeRef),
          transaction.get(membershipRef),
        ]);

        if (
          !membershipSnapshot.exists() ||
          membershipSnapshot.data().clanId !== clanId
        ) {
          throw new Error("You must belong to the invited clan to respond.");
        }

        if (!challengeSnapshot.exists()) {
          throw new Error("This invitation is no longer available.");
        }

        const challenge = challengeSnapshot.data();
        if (
          challenge.targetClanId !== clanId ||
          challenge.status !== "pending"
        ) {
          throw new Error("This invitation has already been resolved.");
        }

        transaction.update(challengeRef, {
          status: accept ? "accepted" : "rejected",
          resolvedAt: Date.now(),
        });
      });

      toast.success(
        accept
          ? "War invitation accepted. Opening the clan war waiting room."
          : "War invitation rejected.",
      );

      if (accept) {
        void navigate({
          to: "/clan-war/$challengeId" as never,
          params: { challengeId: incomingInvite.id } as never,
        });
      }
    } catch (error) {
      toast.error(
        (error as Error).message || "Could not respond to the invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!incomingInvite) return null;

  const unlockedAchievements = INITIAL_ACHIEVEMENTS.filter((achievement) =>
    achievementIds.includes(achievement.id),
  ).slice(0, 3);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md overflow-hidden p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div
          className="relative border-b border-border/60 p-5"
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
                  <span className="ml-2 text-sm text-primary">
                    [{incomingInvite.challengerClanTag}]
                  </span>
                </span>
              </DialogTitle>
              <DialogDescription className="mt-2 text-foreground/80">
                {challenger?.motto ||
                  challenger?.description ||
                  "A rival clan has challenged your team."}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Proposed war format
            </div>
            <div className="mt-1 flex items-center gap-2 text-lg font-black">
              <Swords className="size-4 text-primary" />
              {incomingInvite.format}
            </div>
          </div>

          <section aria-label="Challenger clan overview">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Shield className="size-4 text-primary" />
              Clan overview
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Overview label="Level" value={challenger ? `${challenger.level}` : "—"} />
              <Overview
                label="Competitive points"
                value={challenger ? `${challenger.competitivePoints} CP` : "—"}
              />
              <Overview
                label="Members"
                value={
                  challenger
                    ? `${challenger.memberCount}/${challenger.maxMembers}`
                    : "—"
                }
              />
              <Overview
                label="War record"
                value={
                  challenger
                    ? `${challenger.totalBattlesWon}W – ${challenger.totalBattlesLost}L`
                    : "—"
                }
              />
            </div>
          </section>

          <section aria-label="Challenger achievements">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4 text-warning" />
              Achievements
              {challenger && (
                <span className="ml-auto normal-case tracking-normal">
                  {challenger.achievementsUnlockedCount} unlocked
                </span>
              )}
            </h3>

            {unlockedAchievements.length ? (
              <div className="space-y-2">
                {unlockedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5"
                  >
                    <Award className="size-4 text-warning" />
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

          <div className="flex gap-2 border-t border-border/60 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => void respond(false)}
            >
              <X className="mr-2 size-4" />
              Reject
            </Button>
            <Button
              className="flex-1 font-bold"
              disabled={busy}
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

function Overview({ label, value }: { label: string; value: string }) {
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
