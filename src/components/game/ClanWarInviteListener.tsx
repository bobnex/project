import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Firestore,
} from "firebase/firestore";
import { Award, Minus, Shield, Swords, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";

type ClanWar = {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanTag: string;
  targetClanId: string;
  targetClanName: string;
  targetClanTag: string;
  status: string;
  matchId?: string;
  playerOneUid?: string;
  playerTwoUid?: string;
  settledAt?: number;
  winnerClanId?: string;
  cpChanges?: Record<string, number>;
};

type ClanWarResult = ClanWar & {
  ownClanId: string;
  ownClanName: string;
  opponentClanName: string;
  ownCpChange: number;
};

async function settleCompletedClanWar(
  db: Firestore,
  war: ClanWar,
): Promise<void> {
  if (!war.matchId) return;

  const warRef = doc(db, "clanBattles", war.id);
  const matchRef = doc(db, "matches", war.matchId);
  const challengerRef = doc(db, "clans", war.challengerClanId);
  const targetRef = doc(db, "clans", war.targetClanId);

  // Stable activity IDs prevent duplicate history entries if two players
  // attempt to settle the same result at the same time.
  const challengerActivityRef = doc(
    db,
    "clanActivities",
    `war_${war.id}_${war.challengerClanId}`,
  );
  const targetActivityRef = doc(
    db,
    "clanActivities",
    `war_${war.id}_${war.targetClanId}`,
  );

  await runTransaction(db, async (transaction) => {
    const [warSnapshot, matchSnapshot, challengerSnapshot, targetSnapshot] =
      await Promise.all([
        transaction.get(warRef),
        transaction.get(matchRef),
        transaction.get(challengerRef),
        transaction.get(targetRef),
      ]);

    if (!warSnapshot.exists() || !matchSnapshot.exists()) return;

    const currentWar = warSnapshot.data();
    const match = matchSnapshot.data();

    // Re-reading and checking inside the transaction makes the settlement
    // idempotent when both clans' clients observe the completed match.
    if (
      currentWar.status !== "in_progress" ||
      match.status !== "completed" ||
      match.clanWarSettled === true ||
      !challengerSnapshot.exists() ||
      !targetSnapshot.exists()
    ) {
      return;
    }

    const playerOneUid =
      currentWar.playerOneUid ?? match.playerOneUid ?? match.playerIds?.[0];
    const playerTwoUid =
      currentWar.playerTwoUid ?? match.playerTwoUid ?? match.playerIds?.[1];

    if (!playerOneUid || !playerTwoUid) return;

    const winners = (match.winnerIds ?? []) as string[];
    const challengerWon =
      winners.includes(playerOneUid) && !winners.includes(playerTwoUid);
    const targetWon =
      winners.includes(playerTwoUid) && !winners.includes(playerOneUid);
    const draw = !challengerWon && !targetWon;

    const challengerData = challengerSnapshot.data();
    const targetData = targetSnapshot.data();

    // CP changes are applied once per completed duel.
    const challengerRequestedChange = challengerWon ? 25 : targetWon ? -15 : 0;
    const targetRequestedChange = targetWon ? 25 : challengerWon ? -15 : 0;

    const challengerBefore = Number(challengerData.competitivePoints ?? 0);
    const targetBefore = Number(targetData.competitivePoints ?? 0);
    const challengerAfter = Math.max(
      0,
      challengerBefore + challengerRequestedChange,
    );
    const targetAfter = Math.max(0, targetBefore + targetRequestedChange);
    const challengerChange = challengerAfter - challengerBefore;
    const targetChange = targetAfter - targetBefore;
    const now = Date.now();

    transaction.update(challengerRef, {
      competitivePoints: challengerAfter,
      ...(challengerWon
        ? { totalBattlesWon: Number(challengerData.totalBattlesWon ?? 0) + 1 }
        : targetWon
          ? {
              totalBattlesLost:
                Number(challengerData.totalBattlesLost ?? 0) + 1,
            }
          : {}),
    });

    transaction.update(targetRef, {
      competitivePoints: targetAfter,
      ...(targetWon
        ? { totalBattlesWon: Number(targetData.totalBattlesWon ?? 0) + 1 }
        : challengerWon
          ? { totalBattlesLost: Number(targetData.totalBattlesLost ?? 0) + 1 }
          : {}),
    });

    const outcomeText = draw
      ? "drew"
      : challengerWon
        ? "won"
        : "lost";

    transaction.set(challengerActivityRef, {
      clanId: war.challengerClanId,
      type: draw ? "battle_drawn" : challengerWon ? "battle_won" : "battle_lost",
      description: `Clan war vs [${currentWar.targetClanTag}] ${currentWar.targetClanName}: ${outcomeText}. CP ${challengerChange >= 0 ? "+" : ""}${challengerChange}.`,
      timestamp: now,
      warId: war.id,
      matchId: war.matchId,
      cpChange: challengerChange,
      opponentClanId: war.targetClanId,
    });

    transaction.set(targetActivityRef, {
      clanId: war.targetClanId,
      type: draw ? "battle_drawn" : targetWon ? "battle_won" : "battle_lost",
      description: `Clan war vs [${currentWar.challengerClanTag}] ${currentWar.challengerClanName}: ${draw ? "drew" : targetWon ? "won" : "lost"}. CP ${targetChange >= 0 ? "+" : ""}${targetChange}.`,
      timestamp: now,
      warId: war.id,
      matchId: war.matchId,
      cpChange: targetChange,
      opponentClanId: war.challengerClanId,
    });

    transaction.update(matchRef, { clanWarSettled: true });
    transaction.update(warRef, {
      status: "completed",
      winnerClanId: challengerWon
        ? war.challengerClanId
        : targetWon
          ? war.targetClanId
          : null,
      cpChanges: {
        [war.challengerClanId]: challengerChange,
        [war.targetClanId]: targetChange,
      },
      cpBefore: {
        [war.challengerClanId]: challengerBefore,
        [war.targetClanId]: targetBefore,
      },
      cpAfter: {
        [war.challengerClanId]: challengerAfter,
        [war.targetClanId]: targetAfter,
      },
      settledAt: now,
    });
  });
}

export function ClanWarSettlementListener() {
  const { fb, user } = useApp();
  const sessionStartedAt = useRef(Date.now());
  const [clanId, setClanId] = useState<string | null>(null);
  const [challengerWars, setChallengerWars] = useState<ClanWar[]>([]);
  const [targetWars, setTargetWars] = useState<ClanWar[]>([]);
  const [result, setResult] = useState<ClanWarResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  useEffect(() => {
    if (!fb || !clanId) {
      setChallengerWars([]);
      setTargetWars([]);
      return;
    }

    const unsubscribeChallenger = onSnapshot(
      query(
        collection(fb.db, "clanBattles"),
        where("challengerClanId", "==", clanId),
      ),
      (snapshot) => {
        setChallengerWars(
          snapshot.docs.map(
            (item) => ({ ...item.data(), id: item.id }) as ClanWar,
          ),
        );
      },
      () => setChallengerWars([]),
    );

    const unsubscribeTarget = onSnapshot(
      query(
        collection(fb.db, "clanBattles"),
        where("targetClanId", "==", clanId),
      ),
      (snapshot) => {
        setTargetWars(
          snapshot.docs.map(
            (item) => ({ ...item.data(), id: item.id }) as ClanWar,
          ),
        );
      },
      () => setTargetWars([]),
    );

    return () => {
      unsubscribeChallenger();
      unsubscribeTarget();
    };
  }, [fb, clanId]);

  const wars = useMemo(() => {
    const byId = new Map<string, ClanWar>();
    for (const war of [...challengerWars, ...targetWars]) byId.set(war.id, war);
    return [...byId.values()];
  }, [challengerWars, targetWars]);

  useEffect(() => {
    if (!fb) return;

    const activeWars = wars.filter(
      (war) => war.status === "in_progress" && !!war.matchId,
    );

    const unsubscribers = activeWars.map((war) =>
      onSnapshot(doc(fb.db, "matches", war.matchId!), (snapshot) => {
        if (!snapshot.exists() || snapshot.data().status !== "completed") return;
        void settleCompletedClanWar(fb.db, war).catch(() => {
          // A later snapshot or another clan member can retry the idempotent
          // transaction if Firestore is temporarily unavailable.
        });
      }),
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [fb, wars]);

  useEffect(() => {
    if (!clanId || dismissed) return;

    const completed = wars.find(
      (war) =>
        war.status === "completed" &&
        typeof war.settledAt === "number" &&
        war.settledAt >= sessionStartedAt.current &&
        war.cpChanges,
    );

    if (!completed) return;

    const ownClanId =
      completed.challengerClanId === clanId
        ? completed.challengerClanId
        : completed.targetClanId;
    const opponentClanName =
      completed.challengerClanId === ownClanId
        ? completed.targetClanName
        : completed.challengerClanName;

    setResult({
      ...completed,
      ownClanId,
      ownClanName:
        completed.challengerClanId === ownClanId
          ? completed.challengerClanName
          : completed.targetClanName,
      opponentClanName,
      ownCpChange: Number(completed.cpChanges?.[ownClanId] ?? 0),
    });
  }, [wars, clanId, dismissed]);

  if (!fb || !user || !result) return null;

  const change = result.ownCpChange;
  const ChangeIcon =
    change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <Dialog
      open={!dismissed}
      onOpenChange={(open) => {
        if (!open) setDismissed(true);
      }}
    >
      <DialogContent className="animate-page max-w-md overflow-hidden p-0">
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/20 via-background to-accent/15 p-6 text-center">
          <div className="absolute -right-7 -top-8 animate-pulse">
            <Swords className="size-32 text-primary/10" />
          </div>
          <div className="relative mx-auto grid size-16 animate-pop place-items-center rounded-2xl border border-primary/30 bg-primary/10">
            <Award className="size-8 text-warning" />
          </div>
          <DialogHeader className="relative mt-3">
            <DialogTitle className="text-2xl font-black">
              Clan war complete
            </DialogTitle>
            <DialogDescription>
              {result.ownClanName} vs {result.opponentClanName}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Shield className="size-4 text-primary" />
                Your clan CP
              </div>
              <div className="mt-2 text-2xl font-black">
                {Number(result.cpAfter?.[result.ownClanId] ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ChangeIcon className="size-4 text-primary" />
                CP change
              </div>
              <div
                className={`mt-2 text-2xl font-black ${
                  change > 0
                    ? "text-emerald-500"
                    : change < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {change > 0 ? "+" : ""}
                {change}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            The result has been added to your clan’s war history and battle
            record.
          </p>

          <Button
            className="w-full font-bold"
            onClick={() => setDismissed(true)}
          >
            Back to the game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
