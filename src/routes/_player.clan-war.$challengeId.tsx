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
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Loader2,
  Play,
  Shield,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullLoader } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { canPerformClanAction, type ClanDoc, type ClanMember } from "@/lib/clans";
import {
  buildClanWarQuestionSubjects,
  getClanWarQuestionCount,
  startClanWarMatch,
} from "@/lib/clan-war";

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
  settings?: {
    subjects?: string[];
    secondsPerQuestion?: number;
    questionCount?: number;
  };
};

export const Route = createFileRoute("/_player/clan-war/$challengeId")({
  component: ClanWarWaitingRoom,
  head: () => ({
    title: "Clan War Waiting Room | Juvora Esports",
    meta: [{ name: "description", content: "Set up and launch your clan war." }],
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

  const [subjects, setSubjects] = useState<string[]>(["general", "mathematics", "english"]);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(15);
  const [questionCount, setQuestionCount] = useState(10);

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
          data.settings?.questionCount ??
            getClanWarQuestionCount(data.format),
        );
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
  const canConfigure =
    isInvitingClan &&
    !!membership &&
    canPerformClanAction(membership.role, "battle");

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.uid, member])),
    [members],
  );

  useEffect(() => {
    if (
      !challenge?.matchId ||
      !user ||
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
        <h1 className="text-xl font-black">Waiting for the invite response</h1>
        <p className="text-sm text-muted-foreground">
          The invited clan still needs to accept this challenge.
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
          The selected duel is already running.
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

    const isChallengerSide = membership.clanId === challenge.challengerClanId;
    const currentRoster = isChallengerSide ? challengerRoster : targetRoster;
    const field = isChallengerSide ? "challengerRoster" : "targetRoster";

    if (currentRoster.includes(user.uid)) return;

    if (currentRoster.length >= expectedPlayers) {
      toast.error(`This clan's ${challenge.format} roster is already full.`);
      return;
    }

    setBusy(true);
    try {
      await runTransaction(fb.db, async (transaction) => {
        const challengeRef = doc(fb.db, "clanBattles", challenge.id);
        const memberRef = doc(fb.db, "clanMembers", `${membership.clanId}_${user.uid}`);

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

        if (roster.length >= expectedPlayers) {
          throw new Error("Your clan's roster is already full.");
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

    if (challengerPlayers.length < expectedPlayers || targetPlayers.length < expectedPlayers) {
      toast.error(`Both clans need ${expectedPlayers} selected members to start.`);
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
          throw new Error("This war is not ready to start.");
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
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
            {challenge.format} format • random pool from General, Mathematics and English •
            {` ${getClanWarQuestionCount(challenge.format)} questions`}
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
          const maxRoster = expectedPlayers;

          return (
            <div key={clanId} className="surface-card animate-soft-float space-y-3 p-4">
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
                        {memberLookup.get(uid)?.username ??
                          (uid === user.uid ? profile.username : "Clan member")}
                        {uid === user.uid ? " (you)" : ""}
                      </span>
                      {index === 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Lead slot
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

              {isMySide && challenge.status === "accepted" && !roster.includes(user.uid) && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy || roster.length >= maxRoster}
                  onClick={() => void joinWar()}
                >
                  <Users className="mr-2 size-4" />
                  Join this clan roster
                </Button>
              )}
            </div>
          );
        })}
      </section>

      {canConfigure && challenge.status === "accepted" && (
        <section className="surface-card animate-soft-float space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 font-black">
              <Crown className="size-4 text-warning" />
              Match setup
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select the mixed question pool, then start once both sides are filled.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">
              Question pool
              <div className="mt-1 flex flex-wrap gap-2">
                {["general", "mathematics", "english"].map((cat) => {
                  const active = subjects.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setSubjects((curr) =>
                          active
                            ? curr.filter((item) => item !== cat)
                            : [...curr, cat],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </label>

            <label className="space-y-1 text-xs font-semibold">
              Seconds per question
              <Input
                type="number"
                min={5}
                max={60}
                value={secondsPerQuestion}
                onChange={(event) => setSecondsPerQuestion(Number(event.target.value))}
                disabled={busy}
              />
            </label>

            <label className="space-y-1 text-xs font-semibold">
              Question count
              <Input
                type="number"
                min={10}
                max={30}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                disabled={busy}
              />
            </label>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
            <CheckCircle2 className="mr-2 inline-block size-4 text-primary" />
            This match uses a random pool from: {subjects.join(", ")}.
            <br />
            {challenge.format === "1v1" && "Total questions: 10"}
            {challenge.format === "3v3" && "Total questions: 25"}
            {challenge.format === "5v5" && "Total questions: 30"}
          </div>

          <Button
            className="w-full font-bold"
            disabled={
              busy ||
              challengerRoster.length < expectedPlayers ||
              targetRoster.length < expectedPlayers
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
              : challengerRoster.length >= expectedPlayers &&
                  targetRoster.length >= expectedPlayers
                ? "Start clan war"
                : `Waiting for ${expectedPlayers} players per side`}
          </Button>
        </section>
      )}

      {!canConfigure && challenge.status === "accepted" && (
        <div className="surface-card flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Waiting for the inviting clan leader or officer to set up the match.
        </div>
      )}

      {challenge.status === "starting" && (
        <div className="surface-card flex items-center gap-3 p-4 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          Launching the clan war…
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
