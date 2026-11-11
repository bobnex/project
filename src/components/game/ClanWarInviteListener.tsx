import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import type { ClanBattleChallenge, ClanDoc } from "@/lib/clans";
import { INITIAL_ACHIEVEMENTS } from "@/lib/clans";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Check, Shield, Swords, Users, X } from "lucide-react";

type Invite = ClanBattleChallenge & { id: string };

export function ClanWarInviteListener() {
  const { fb, user } = useApp();
  const [clanId, setClanId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [challenger, setChallenger] = useState<ClanDoc | null>(null);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Find the signed-in player's clan.
  useEffect(() => {
    if (!fb || !user) {
      setClanId(null);
      return;
    }

    return onSnapshot(
      query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid)),
      (snapshot) => {
        setClanId((snapshot.docs[0]?.data().clanId as string | undefined) ?? null);
      },
      () => setClanId(null),
    );
  }, [fb, user]);

  // Listen for pending challenges addressed to this clan.
  useEffect(() => {
    if (!fb || !clanId) {
      setInvites([]);
      return;
    }

    return onSnapshot(
      query(collection(fb.db, "clanBattles"), where("targetClanId", "==", clanId)),
      (snapshot) => {
        const pending = snapshot.docs
          .map((item) => ({ ...item.data(), id: item.id }) as Invite)
          .filter((invite) => invite.status === "pending")
          .sort((a, b) => b.createdAt - a.createdAt);

        setInvites(pending);
      },
      () => setInvites([]),
    );
  }, [fb, clanId]);

  const activeInvite = invites[0] ?? null;

  // Fetch the challenger clan overview and its unlocked achievements.
  useEffect(() => {
    if (!fb || !activeInvite) {
      setChallenger(null);
      setUnlockedAchievementIds([]);
      return;
    }

    setChallenger(null);
    setUnlockedAchievementIds([]);

    const unsubscribeClan = onSnapshot(
      doc(fb.db, "clans", activeInvite.challengerClanId),
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
        where("clanId", "==", activeInvite.challengerClanId),
      ),
      (snapshot) => {
        const ids = snapshot.docs
          .map((item) => item.data().achievementId as string | undefined)
          .filter((id): id is string => !!id);

        setUnlockedAchievementIds(ids);
      },
      () => setUnlockedAchievementIds([]),
    );

    return () => {
      unsubscribeClan();
      unsubscribeAchievements();
    };
  }, [fb, activeInvite?.id, activeInvite?.challengerClanId]);

  async function respond(accept: boolean) {
    if (!fb || !user || !clanId || !activeInvite || busy) return;

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", activeInvite.id);
        const membershipRef = doc(fb.db, "clanMembers", `${clanId}_${user.uid}`);

        const [challengeSnapshot, membershipSnapshot] = await Promise.all([
          transaction.get(challengeRef),
          transaction.get(membershipRef),
        ]);

        if (!membershipSnapshot.exists() || membershipSnapshot.data().clanId !== clanId) {
          throw new Error("You must be a member of the invited clan to respond.");
        }

        if (!challengeSnapshot.exists()) {
          throw new Error("This war invitation is no longer available.");
        }

        const challenge = challengeSnapshot.data();
        if (
          challenge.targetClanId !== clanId ||
          challenge.status !== "pending"
        ) {
          throw new Error("This war invitation has already been resolved.");
        }

        transaction.update(challengeRef, {
          status: accept ? "accepted" : "rejected",
          resolvedAt: Date.now(),
        });
      });

      toast.success(accept ? "War invitation accepted." : "War invitation rejected.");
    } catch (error) {
      toast.error((error as Error).message || "Could not respond to the war invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (!activeInvite) return null;

  const knownAchievements = INITIAL_ACHIEVEMENTS.filter((achievement) =>
    unlockedAchievementIds.includes(achievement.id),
  );
  const displayedAchievements = knownAchievements.slice(0, 3);

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
                  {activeInvite.challengerClanName}
                  <span className="ml-2 text-sm font-black text-primary">
                    [{activeInvite.challengerClanTag}]
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
                  {activeInvite.format}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invitation sent
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {new Date(activeInvite.createdAt).toLocaleDateString()}
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
                value={
                  challenger
                    ? `${challenger.memberCount}/${challenger.maxMembers}`
                    : "—"
                }
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

            {displayedAchievements.length > 0 ? (
              <div className="space-y-2">
                {displayedAchievements.map((achievement) => (
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
                {knownAchievements.length > displayedAchievements.length && (
                  <p className="text-right text-[11px] text-muted-foreground">
                    +{knownAchievements.length - displayedAchievements.length} more
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No unlocked achievements to display yet.
              </p>
            )}
          </section>

          <div className="flex items-center gap-2 border-t border-border/60 pt-4">
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
