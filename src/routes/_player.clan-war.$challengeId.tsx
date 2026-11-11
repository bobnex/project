import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { ArrowLeft, Crown, Loader2, Play, Shield, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullLoader } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { canPerformClanAction, type ClanDoc, type ClanMember } from "@/lib/clans";
import { createRoom, hostStart, joinMatch } from "@/lib/engine";

type WarChallenge = DocumentData & {
  id: string;
  challengerClanId: string;
  challengerClanName: string;
  challengerClanTag: string;
  targetClanId: string;
  targetClanName: string;
  targetClanTag: string;
  format: "1v1" | "3v3" | "5v5";
  status: string;
  challengerRoster?: string[];
  targetRoster?: string[];
  matchId?: string;
  settings?: {
    subject: string;
    secondsPerQuestion: number;
    questionCount: number;
  };
};

export const Route = createFileRoute("/_player/clan-war/$challengeId")({
  component: ClanWarWaitingRoom,
  head: () => ({
    title: "Clan War Waiting Room | Juvora Esports",
    meta: [{ name: "description", content: "Join your clan's war waiting room." }],
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

  const [subject, setSubject] = useState("all");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(15);
  const [questionCount, setQuestionCount] = useState(20);

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
        setSubject(data.settings?.subject ?? "all");
        setSecondsPerQuestion(data.settings?.secondsPerQuestion ?? 15);
        setQuestionCount(data.settings?.questionCount ?? 20);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [fb, challengeId]);

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

  const challengerRoster = challenge?.challengerRoster ?? [];
  const targetRoster = challenge?.targetRoster ?? [];
  const myRoster =
    ownClanId === challenge?.challengerClanId
      ? challengerRoster
      : targetRoster;
  const opponentRoster =
    ownClanId === challenge?.challengerClanId
      ? targetRoster
      : challengerRoster;

  const isInvitingClan = ownClanId === challenge?.challengerClanId;
  const canConfigure =
    isInvitingClan &&
    !!membership &&
    canPerformClanAction(membership.role, "battle");

  const memberByUid = useMemo(
    () => new Map(members.map((member) => [member.uid, member])),
    [members],
  );

  // Players selected for the actual classic match are sent to its existing route.
  useEffect(() => {
    if (
      !challenge?.matchId ||
      !user ||
      ![challenge.playerOneUid, challenge.playerTwoUid].includes(user.uid)
    ) {
      return;
    }

    void navigate({
      to: "/match/$matchId",
      params: { matchId: challenge.matchId },
    });
  }, [challenge?.matchId, challenge?.playerOneUid, challenge?.playerTwoUid, user, navigate]);

  if (loading) return <FullLoader label="Loading clan war room" />;

  if (!fb || !user || !profile || !challenge) {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <h1 className="text-xl font-black">Clan war unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This invitation could not be found.
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
        <Button asChild variant="outline">
          <Link to="/clans">Back to clans</Link>
        </Button>
      </div>
    );
  }

  if (challenge.status === "pending") {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <h1 className="text-xl font-black">Waiting for the invitation response</h1>
        <p className="text-sm text-muted-foreground">
          The invited clan has not accepted this war yet.
        </p>
      </div>
    );
  }

  if (challenge.status === "in_progress" && challenge.matchId) {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <Swords className="mx-auto size-8 text-primary" />
        <h1 className="text-xl font-black">The clan war has started</h1>
        <p className="text-sm text-muted-foreground">
          The selected clan representatives are entering the battle.
        </p>
        <Button
          onClick={() => {
            const matchId = challenge.matchId;
            if (matchId) {
              void navigate({ to: "/match/$matchId", params: { matchId } });
            }
          }}
        >
          Open battle
        </Button>
      </div>
    );
  }

  async function joinWar() {
    if (!fb || !challenge || !membership || busy) return;

    const currentRoster =
      membership.clanId === challenge.challengerClanId
        ? challengerRoster
        : targetRoster;
    const field =
      membership.clanId === challenge.challengerClanId
        ? "challengerRoster"
        : "targetRoster";
    const maxRoster = Number(challenge.format.replace("v", ""));

    if (currentRoster.includes(user.uid)) return;
    if (currentRoster.length >= maxRoster) {
      toast.error(`This clan's ${challenge.format} roster is full.`);
      return;
    }

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const memberRef = doc(
          fb.db,
          "clanMembers",
          `${membership.clanId}_${user.uid}`,
        );

        const [challengeSnapshot, memberSnapshot] = await Promise.all([
          transaction.get(challengeRef),
          transaction.get(memberRef),
        ]);

        if (!memberSnapshot.exists()) {
          throw new Error("Your clan membership could not be verified.");
        }

        if (!challengeSnapshot.exists()) {
          throw new Error("This war room is no longer available.");
        }

        const data = challengeSnapshot.data();
        if (data.status !== "accepted") {
          throw new Error("The war is no longer accepting players.");
        }

        const roster = (data[field] ?? []) as string[];
        if (roster.includes(user.uid)) return;
        if (roster.length >= maxRoster) {
          throw new Error("Your clan's roster is full.");
        }

        transaction.update(challengeRef, {
          [field]: [...roster, user.uid],
        });
      });

      toast.success("You joined your clan's war roster.");
    } catch (error) {
      toast.error((error as Error).message || "Could not join the roster.");
    } finally {
      setBusy(false);
    }
  }

  async function startWar() {
    if (!fb || !user || !challenge || !canConfigure || busy) return;

    const challengerPlayers = challenge.challengerRoster ?? [];
    const targetPlayers = challenge.targetRoster ?? [];
    if (!challengerPlayers.length || !targetPlayers.length) {
      toast.error("Each clan needs at least one player in its roster.");
      return;
    }

    const seconds = Math.max(5, Math.min(120, Number(secondsPerQuestion) || 15));
    const count = Math.max(3, Math.min(50, Number(questionCount) || 20));
    const settings = {
      subject: subject.trim() || "all",
      secondsPerQuestion: seconds,
      questionCount: count,
    };

    setBusy(true);
    let createdMatchId: string | null = null;

    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const hostMembershipRef = doc(
          fb.db,
          "clanMembers",
          `${challenge.challengerClanId}_${user.uid}`,
        );

        const [challengeSnapshot, hostMembershipSnapshot] = await Promise.all([
          transaction.get(challengeRef),
          transaction.get(hostMembershipRef),
        ]);

        if (!hostMembershipSnapshot.exists()) {
          throw new Error("Only an inviting-clan officer can configure this war.");
        }

        const role = hostMembershipSnapshot.data().role;
        if (!canPerformClanAction(role, "battle")) {
          throw new Error("Your clan role cannot start a war.");
        }

        if (!challengeSnapshot.exists() || challengeSnapshot.data().status !== "accepted") {
          throw new Error("This war is not ready to start.");
        }

        const current = challengeSnapshot.data();
        if (
          !(current.challengerRoster as string[] | undefined)?.length ||
          !(current.targetRoster as string[] | undefined)?.length
        ) {
          throw new Error("Each clan needs a player in its roster.");
        }

        transaction.update(challengeRef, {
          status: "starting",
          settings,
        });
      });

      // The current match engine runs a classic 1v1. The first member
      // registered by each clan represents their side for this duel.
      const playerOneUid = challengerPlayers[0]!;
      const playerTwoUid = targetPlayers[0]!;
      const playerOneName =
        playerOneUid === user.uid
          ? profile.username
          : memberByUid.get(playerOneUid)?.username ?? "Challenger";
      const playerTwoName =
        playerTwoUid === user.uid
          ? profile.username
          : memberByUid.get(playerTwoUid)?.username ?? "Opponent";

      const room = await createRoom(
        fb.db,
        playerOneUid,
        playerOneName,
        "classic",
        settings.subject,
        {
          secondsPerQuestion: settings.secondsPerQuestion,
          questionCount: settings.questionCount,
        },
      );
      createdMatchId = room.id;

      await joinMatch(fb.db, room.id, playerTwoUid, playerTwoName);
      await updateDoc(doc(fb.db, "matches", room.id), {
        ranked: false,
        clanWarId: challenge.id,
        clanAId: challenge.challengerClanId,
        clanBId: challenge.targetClanId,
      });

      await hostStart(fb.db, room.id, playerOneUid);

      await updateDoc(doc(fb.db, "clanBattles", challenge.id), {
        status: "in_progress",
        matchId: room.id,
        playerOneUid,
        playerTwoUid,
        settings,
        startedAt: Date.now(),
      });

      await navigate({
        to: "/match/$matchId",
        params: { matchId: room.id },
      });
    } catch (error) {
      if (createdMatchId) {
        await updateDoc(doc(fb.db, "matches", createdMatchId), {
          status: "cancelled",
          lobbyKey: null,
        }).catch(() => {});
      }

      await updateDoc(doc(fb.db, "clanBattles", challenge.id), {
        status: "accepted",
      }).catch(() => {});

      toast.error((error as Error).message || "Could not start the clan war.");
    } finally {
      setBusy(false);
    }
  }

  const sideName = (clanId: string) =>
    clanId === challenge.challengerClanId
      ? challenge.challengerClanName
      : challenge.targetClanName;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="hero-card relative overflow-hidden p-6">
        <Shield className="absolute -right-4 -top-5 size-32 text-primary/10" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Swords className="size-4 text-primary" />
            Clan War Waiting Room
          </div>

          <h1 className="mt-4 text-2xl font-black sm:text-3xl">
            {challenge.challengerClanName}
            <span className="mx-3 text-primary">vs</span>
            {challenge.targetClanName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challenge.format} roster · Accepted war · Waiting for the inviting
            clan to configure and start the duel.
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {[challenge.challengerClanId, challenge.targetClanId].map((clanId) => {
          const roster =
            clanId === challenge.challengerClanId
              ? challengerRoster
              : targetRoster;
          const isMySide = clanId === membership.clanId;
          const maxRoster = Number(challenge.format.replace("v", ""));

          return (
            <div key={clanId} className="surface-card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black">{sideName(clanId)}</h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {roster.length}/{maxRoster}
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
                        {memberByUid.get(uid)?.username ??
                          (uid === user.uid ? profile.username : "Clan member")}
                        {uid === user.uid ? " (you)" : ""}
                      </span>
                      {index === 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          First duel
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No members have joined this roster yet.
                </div>
              )}

              {isMySide &&
                challenge.status === "accepted" &&
                !roster.includes(user.uid) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy || roster.length >= maxRoster}
                    onClick={() => void joinWar()}
                  >
                    <Users className="mr-2 size-4" />
                    Join your clan roster
                  </Button>
                )}
            </div>
          );
        })}
      </section>

      {canConfigure && challenge.status === "accepted" && (
        <section className="surface-card space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 font-black">
              <Crown className="size-4 text-warning" />
              Inviting clan match settings
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These settings are shared with both clans when the battle starts.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">
              Course
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="all"
                disabled={busy}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Seconds per question
              <Input
                type="number"
                min={5}
                max={120}
                value={secondsPerQuestion}
                onChange={(event) =>
                  setSecondsPerQuestion(Number(event.target.value))
                }
                disabled={busy}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Question count
              <Input
                type="number"
                min={3}
                max={50}
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(Number(event.target.value))
                }
                disabled={busy}
              />
            </label>
          </div>

          <div className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-xs text-muted-foreground">
            The existing battle engine runs a single 1v1 classic match. For
            3v3 or 5v5, this starts the first duel between the first roster
            member from each clan; a complete multi-round series is not yet
            implemented.
          </div>

          <Button
            className="w-full font-bold"
            disabled={
              busy ||
              challengerRoster.length === 0 ||
              targetRoster.length === 0
            }
            onClick={() => void startWar()}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            {busy ? "Starting war…" : "Start clan war"}
          </Button>
        </section>
      )}

      {!canConfigure && challenge.status === "accepted" && (
        <div className="surface-card flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Waiting for the inviting clan leader or officer to configure and start
          the war.
        </div>
      )}

      {challenge.status === "starting" && (
        <div className="surface-card flex items-center gap-3 p-4 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          The inviting clan is preparing the battle…
        </div>
      )}

      <div className="text-center">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clans">
            <ArrowLeft className="mr-2 size-4" />
            Return to clans
          </Link>
        </Button>
      </div>
    </div>
  );
}
