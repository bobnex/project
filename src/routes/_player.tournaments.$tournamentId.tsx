import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  ArrowLeft, Award, Eye, CalendarClock, Check, Crown, Loader2, Play, Radio, RefreshCw, ShieldCheck, Swords, Trash2, Trophy, UserMinus, UserPlus, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, FullLoader, Section } from "@/components/game/ui";
import { PlayerAvatar } from "@/components/game/Avatar";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/meta";
import { BracketTree, LiveWatchDialog, PrizeCard, useOpponentReadyAlert } from "@/components/game/tournament-extras";
import { coursePickLabel, parseCoursePick } from "@/lib/course-pick";
import {
  adminDeleteFixture, adminRescheduleFixture, adminSetFixtureResult, adminUpdateParticipant, DAY_MS,
  deleteTournament, endSeason, enterFixture, leaveTournament, maybeAdvance, registerForTournament,
  startTournament, updateTournament,
} from "@/lib/tournament-engine";
import {
  divisionNames, FORMAT_LABELS, STATUS_LABEL, standings, type Fixture, type Tournament, type TournamentPlayer,
} from "@/lib/tournament-rules";

export const Route = createFileRoute("/_player/tournaments/$tournamentId")({
  head: () => pageMeta("Tournament", "Standings, bracket and your upcoming tournament matches."),
  component: TournamentPage,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

function TournamentPage() {
  const { tournamentId } = Route.useParams();
  const { fb, user, profile, isAdmin } = useApp();
  const navigate = useNavigate();
  const [t, setT] = useState<Tournament | null | undefined>(undefined);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [watching, setWatching] = useState<Fixture | null>(null);

  useEffect(() => {
    if (!fb) return;
    const a = onSnapshot(
      doc(fb.db, "tournaments", tournamentId),
      (s) => setT(s.exists() ? ({ id: s.id, ...(s.data() as Omit<Tournament, "id">) }) : null),
      () => setT(null)
    );
    const b = onSnapshot(
      query(collection(fb.db, "t_players"), where("tournamentId", "==", tournamentId)),
      (s) => setPlayers(s.docs.map((d) => d.data() as TournamentPlayer)),
      () => {}
    );
    const c = onSnapshot(
      query(collection(fb.db, "t_fixtures"), where("tournamentId", "==", tournamentId)),
      (s) => setFixtures(s.docs.filter((d) => !d.id.startsWith("_")).map((d) => ({ ...(d.data() as Fixture), id: d.id }))),
      () => {}
    );
    return () => {
      a();
      b();
      c();
    };
  }, [fb, tournamentId]);

  const me = players.find((p) => p.uid === user?.uid);
  const myFixtures = useMemo(
    () => fixtures.filter((f) => f.aId === user?.uid || f.bId === user?.uid).sort((a, b) => a.round - b.round),
    [fixtures, user]
  );
  const nextMatch = myFixtures.find((f) => f.status === "scheduled" || f.status === "ready");
  const joinRef = useRef<(f: Fixture) => void>(() => {});
  const onJoin = useCallback((f: Fixture) => joinRef.current(f), []);
  useOpponentReadyAlert(fixtures, user?.uid, onJoin);

  if (t === undefined) return <FullLoader />;
  if (t === null) return <Empty icon={Award} title="Tournament not found" text="It may have been removed by an admin." />;
  if (!fb || !user || !profile) return null;
  const db = fb.db;

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function play(f: Fixture) {
    await run(`play-${f.id}`, async () => {
      const id = await enterFixture(db, user!.uid, profile!.username, f, t!);
      navigate({ to: "/match/$matchId", params: { matchId: id } });
    });
  }

  joinRef.current = play;
  const registered = me && me.status !== "rejected";
  const champion = players.find((p) => p.status === "champion");
  const opponentName = nextMatch ? (nextMatch.aId === user.uid ? nextMatch.bName : nextMatch.aName) : "";

  return (
    <div className="space-y-5">
      <Link to="/tournaments" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground">
        <ArrowLeft className="size-4" /> All tournaments
      </Link>

      {/* Main Tournament Hero Card */}
      <div className="hero-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">{t.name}</h1>
            <p className="text-muted-foreground text-sm">
              {FORMAT_LABELS[t.format]}
              {t.format === "league" ? ` · Season ${t.season}` : ""} · {coursePickLabel(parseCoursePick(t.subject))} · {t.questionsPerMatch} questions
            </p>
          </div>
          <Badge variant={t.status === "running" ? "default" : "secondary"}>{STATUS_LABEL[t.status]}</Badge>
        </div>

        {t.description && <p className="text-sm">{t.description}</p>}

        {/* Feature 1: Golden Champion Announcement Banner */}
        {champion && (
          <div className="surface-card animate-shimmer border-warning/50 bg-gradient-to-r from-warning/15 via-warning/25 to-warning/15 text-warning flex items-center justify-between rounded-2xl p-4 font-bold shadow-lg shadow-warning/10">
            <div className="flex items-center gap-3">
              <Crown className="size-7 animate-bounce text-warning drop-shadow" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-warning/80">Reigning Champion</div>
                <div className="text-lg font-black text-foreground">{champion.name}</div>
              </div>
            </div>
            <Trophy className="size-6 text-warning opacity-90" />
          </div>
        )}

        {/* Action strip: registration / statuses */}
        <div className="flex flex-wrap items-center gap-2">
          {t.status === "registration" && !registered && (
            <Button
              disabled={!!busy}
              onClick={() =>
                run(
                  "reg",
                  () => registerForTournament(db, t.id, user.uid, profile.username),
                  t.requireApproval ? "Request sent — an admin will review it." : "You're in!"
                )
              }
            >
              <UserPlus className="size-4" /> {t.requireApproval ? "Request to join" : "Join tournament"}
            </Button>
          )}
          {t.status === "registration" && registered && (
            <>
              <Badge variant="outline">{me!.status === "pending" ? "Waiting for approval" : "Registered"}</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={!!busy}
                onClick={() => run("leave", () => leaveTournament(db, t.id, user.uid), "You left the tournament.")}
              >
                <UserMinus className="size-4" /> Leave
              </Button>
            </>
          )}
          {me?.status === "rejected" && <Badge variant="destructive">Your entry was declined</Badge>}
          {me?.status === "eliminated" && <Badge variant="secondary">You were knocked out</Badge>}
          <span className="text-muted-foreground ml-auto text-sm">{t.participantCount}/{t.maxParticipants} players</span>
        </div>
      </div>

      {/* Feature 3: Next Match Ready / Versus Clash Hero Banner */}
      {nextMatch && t.status === "running" && (
        <div className="surface-card border-primary/50 relative overflow-hidden p-5 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Swords className="size-4" /> Next tournament match ready
            </span>
            {nextMatch.status === "ready" && (
              <Badge variant="default" className="bg-destructive text-destructive-foreground animate-pulse text-xs">
                Opponent waiting!
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 py-2">
            {/* Player Avatar */}
            <div className="animate-vs-left flex flex-1 flex-col items-center gap-1">
              <PlayerAvatar name={profile.username} size={52} />
              <span className="max-w-28 truncate text-xs font-bold">{profile.username}</span>
              <span className="text-muted-foreground text-[10px]">You</span>
            </div>

            {/* VS Clash Badge */}
            <div className="flex flex-col items-center gap-1 px-2">
              <div className="animate-pop flex size-10 items-center justify-center rounded-full bg-primary font-black text-primary-foreground shadow-lg shadow-primary/25">
                VS
              </div>
              <span className="text-muted-foreground text-[10px] font-semibold">Round {nextMatch.round}</span>
            </div>

            {/* Opponent Avatar */}
            <div className="animate-vs-right flex flex-1 flex-col items-center gap-1">
              <PlayerAvatar name={opponentName} size={52} />
              <span className="max-w-28 truncate text-xs font-bold">{opponentName}</span>
              <span className="text-muted-foreground text-[10px]">Rival</span>
            </div>
          </div>

          <Button
            className="mt-4 w-full font-bold"
            size="lg"
            disabled={!!busy}
            onClick={() => play(nextMatch)}
          >
            {busy === `play-${nextMatch.id}` ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Play className="size-5 fill-current" />
            )}
            {nextMatch.status === "ready" ? `Enter Arena vs ${opponentName}` : `Play Match vs ${opponentName}`}
          </Button>
        </div>
      )}

      <PrizeCard t={t} isAdmin={isAdmin} />
      <LiveWatchDialog fixture={watching} onClose={() => setWatching(null)} />

      <Tabs defaultValue={t.status === "registration" ? "players" : "table"} className="space-y-4">
        <TabsList className={cn("grid w-full rounded-xl", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="table">{t.format === "elimination" ? "Bracket" : "Table"}</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin">
              <ShieldCheck className="size-4" />
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="table">
          <Standings t={t} players={players} fixtures={fixtures} uid={user.uid} onWatch={setWatching} />
        </TabsContent>
        <TabsContent value="matches">
          <MatchList t={t} fixtures={fixtures} uid={user.uid} busy={busy} onPlay={play} onWatch={setWatching} />
        </TabsContent>
        <TabsContent value="players">
          <PlayerList players={players} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin">
            <AdminPanel
              t={t}
              players={players}
              fixtures={fixtures}
              busy={busy}
              run={run}
              onDeleted={() => navigate({ to: "/tournaments" })}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ---------------- Standings / bracket ---------------- */

function Standings({
  t,
  players,
  fixtures,
  uid,
  onWatch,
}: {
  t: Tournament;
  players: TournamentPlayer[];
  fixtures: Fixture[];
  uid: string;
  onWatch: (f: Fixture) => void;
}) {
  const inPlay = players.filter((p) => p.status !== "pending" && p.status !== "rejected");
  if (t.status === "registration")
    return <Empty icon={CalendarClock} title="Not started yet" text="The draw happens when an admin starts the tournament." />;

  const knockout = fixtures.filter((f) => f.stage === "knockout");
  if (t.format === "elimination") return <BracketTree fixtures={knockout} uid={uid} onWatch={onWatch} />;

  if (t.format === "groups") {
    const gCount = Math.max(0, ...inPlay.map((p) => (p.group ?? 0) + 1));
    return (
      <div className="space-y-5">
        {knockout.length > 0 && (
          <Section title="Knockout" icon={Swords}>
            <BracketTree fixtures={knockout} uid={uid} onWatch={onWatch} />
          </Section>
        )}
        {Array.from({ length: gCount }, (_, g) => (
          <Section key={g} title={`Group ${String.fromCharCode(65 + g)}`}>
            <Table rows={standings(inPlay.filter((p) => p.group === g), t.tiebreakers)} uid={uid} highlightTop={t.qualifiers} />
          </Section>
        ))}
      </div>
    );
  }

  const names = divisionNames(t.divisionCount, t.divisionNames);
  const dCount = Math.max(1, ...inPlay.map((p) => p.division + 1));
  return (
    <div className="space-y-5">
      {(t as Tournament & { seasonComplete?: boolean }).seasonComplete && (
        <div className="surface-card p-3 text-sm">Season {t.season} is complete — waiting for an admin to start the next season.</div>
      )}
      {Array.from({ length: dCount }, (_, d) => (
        <Section key={d} title={names[d] ?? `Division ${d + 1}`} icon={Trophy}>
          <Table
            rows={standings(inPlay.filter((p) => p.division === d), t.tiebreakers)}
            uid={uid}
            highlightTop={d > 0 ? t.promoteSlots : 0}
            highlightBottom={d < dCount - 1 ? t.relegateSlots : 0}
          />
        </Section>
      ))}
      <p className="text-muted-foreground text-xs">Green rows go up a division and red rows go down when the season ends.</p>
    </div>
  );
}

function Table({
  rows,
  uid,
  highlightTop = 0,
  highlightBottom = 0,
}: {
  rows: TournamentPlayer[];
  uid: string;
  highlightTop?: number;
  highlightBottom?: number;
}) {
  if (!rows.length) return <div className="text-muted-foreground text-sm">No players.</div>;
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-b">
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Player</th>
            <th className="p-2">P</th>
            <th className="p-2">W</th>
            <th className="p-2">D</th>
            <th className="p-2">L</th>
            <th className="p-2">+/-</th>
            <th className="p-2">Pts</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((p, i) => {
            const up = i < highlightTop;
            const down = highlightBottom > 0 && rows.length > highlightTop + highlightBottom && i >= rows.length - highlightBottom;
            return (
              <tr
                key={p.uid}
                className={cn(
                  "border-b last:border-0",
                  p.uid === uid && "bg-primary/10",
                  up && "border-l-2 border-l-success",
                  down && "border-l-2 border-l-destructive"
                )}
              >
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-semibold">
                  <span className="flex items-center gap-2">
                    {p.name}
                    {p.status === "eliminated" && <span className="text-muted-foreground text-xs">out</span>}
                  </span>
                </td>
                <td className="p-2 text-center">{p.played}</td>
                <td className="p-2 text-center">{p.won}</td>
                <td className="p-2 text-center">{p.drawn}</td>
                <td className="p-2 text-center">{p.lost}</td>
                <td className="p-2 text-center">{p.scoreFor - p.scoreAgainst}</td>
                <td className="p-2 text-center font-bold">{p.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Matches ---------------- */

function stageLabel(f: Fixture) {
  if (f.stage === "knockout") return `Knockout · Round ${f.round}`;
  if (f.stage === "group") return `Group ${String.fromCharCode(65 + (f.group ?? 0))} · Matchday ${f.round}`;
  return `Gameweek ${f.round}`;
}

function MatchList({
  t,
  fixtures,
  uid,
  busy,
  onPlay,
  onWatch,
}: {
  t: Tournament;
  fixtures: Fixture[];
  uid: string;
  busy: string | null;
  onPlay: (f: Fixture) => void;
  onWatch: (f: Fixture) => void;
}) {
  const [mine, setMine] = useState(true);
  const list = fixtures
    .filter((f) => !mine || f.aId === uid || f.bId === uid)
    .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "knockout" ? 1 : -1) || a.round - b.round);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={mine ? "default" : "outline"} onClick={() => setMine(true)}>
          My matches
        </Button>
        <Button size="sm" variant={!mine ? "default" : "outline"} onClick={() => setMine(false)}>
          All matches
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty icon={Swords} title="No matches yet" text={t.status === "registration" ? "Matches appear once the tournament starts." : ""} />
      ) : (
        list.map((f) => {
          const isLiveMatch = f.status === "ready" && !!f.matchId;
          return (
            <FixtureRow
              key={f.id}
              f={f}
              uid={uid}
              busy={busy}
              onPlay={t.status === "running" ? onPlay : undefined}
              spectatorAction={
                isLiveMatch ? (
                  <Button size="sm" variant="outline" className="border-warning/60 text-warning hover:bg-warning/10" onClick={() => onWatch(f)}>
                    <Radio className="size-3.5 animate-pulse" /> Spectate
                  </Button>
                ) : undefined
              }
            />
          );
        })
      )}
    </div>
  );
}

function FixtureRow({
  f,
  uid,
  busy,
  onPlay,
  spectatorAction,
}: {
  f: Fixture;
  uid: string;
  busy: string | null;
  onPlay?: ((f: Fixture) => void) | undefined;
  spectatorAction?: React.ReactNode;
}) {
  const mineFx = f.aId === uid || f.bId === uid;
  const open = f.status === "scheduled" || f.status === "ready";
  const late = open && f.deadline && Date.now() > f.deadline;
  const isLive = f.status === "ready" && !!f.matchId;

  return (
    <div className={cn("surface-card space-y-2 p-3 transition-colors", mineFx && "border-primary/40", isLive && "border-warning/60 bg-warning/5")}>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          {isLive && <span className="size-2 animate-ping rounded-full bg-warning" />}
          {stageLabel(f)}
        </span>
        <span>
          {f.status === "completed"
            ? f.decidedBy === "walkover"
              ? "Set by admin"
              : "Finished"
            : late
            ? "Deadline passed"
            : f.deadline
            ? `Play by ${new Date(f.deadline).toLocaleDateString()}`
            : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className={cn("flex-1 truncate text-right font-semibold", f.winnerId === f.aId && "text-success font-bold")}>{f.aName}</div>
        <div className="tabular bg-muted rounded-lg px-2 py-1 text-sm font-bold">
          {f.status === "completed" ? `${f.scoreA} – ${f.scoreB}` : "vs"}
        </div>
        <div className={cn("flex-1 truncate font-semibold", f.winnerId === f.bId && "text-success font-bold")}>{f.bName}</div>
      </div>
      {(onPlay && mineFx && open && !late) || spectatorAction ? (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {onPlay && mineFx && open && !late && (
            <Button size="sm" disabled={!!busy} onClick={() => onPlay(f)}>
              {busy === `play-${f.id}` ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {f.status === "ready" ? "Join match" : "Play"}
            </Button>
          )}
          {spectatorAction}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Players ---------------- */

function PlayerList({ players }: { players: TournamentPlayer[] }) {
  const list = players.filter((p) => p.status !== "rejected").sort((a, b) => a.seed - b.seed);
  if (!list.length) return <Empty icon={UserPlus} title="No one has joined yet" />;
  const badge: Record<string, string> = {
    pending: "Pending",
    approved: "Registered",
    active: "Playing",
    eliminated: "Out",
    champion: "Champion",
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((p) => (
        <div key={p.uid} className="surface-card flex items-center gap-3 p-3">
          <PlayerAvatar name={p.name} size={32} />
          <span className="flex-1 truncate font-semibold">{p.name}</span>
          <Badge variant={p.status === "champion" ? "default" : p.status === "eliminated" ? "secondary" : "outline"}>
            {badge[p.status] ?? p.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Admin controls ---------------- */

function AdminPanel({
  t,
  players,
  fixtures,
  busy,
  run,
  onDeleted,
}: {
  t: Tournament;
  players: TournamentPlayer[];
  fixtures: Fixture[];
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, ok?: string) => Promise<unknown>;
  onDeleted: () => void;
}) {
  const { fb } = useApp();
  const db = fb!.db;
  const pending = players.filter((p) => p.status === "pending");

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <Section title={`Pending approvals (${pending.length})`} icon={UserPlus}>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.uid} className="surface-card flex items-center justify-between gap-2 p-3">
                <span className="truncate font-semibold">{p.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => run(`app-${p.uid}`, () => adminUpdateParticipant(db, t.id, p.uid, "approved"), "Player approved")}
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() => run(`rej-${p.uid}`, () => adminUpdateParticipant(db, t.id, p.uid, "rejected"), "Player declined")}
                  >
                    <X className="size-4" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Tournament flow" icon={Play}>
        <div className="surface-card space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {t.status === "registration" && (
              <Button disabled={!!busy} onClick={() => run("start", () => startTournament(db, t), "Tournament started!")}>
                <Play className="size-4" /> Start tournament
              </Button>
            )}
            {t.format === "league" && t.status === "running" && (
              <Button disabled={!!busy} variant="outline" onClick={() => run("end-season", () => endSeason(db, t), "Season ended!")}>
                End season
              </Button>
            )}
            {t.format !== "league" && t.status === "running" && (
              <Button disabled={!!busy} variant="outline" onClick={() => run("advance", () => maybeAdvance(db, t), "Advancement checked.")}>
                <RefreshCw className="size-4" /> Check advancement
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Danger zone" icon={Trash2}>
        <div className="surface-card border-destructive/40 space-y-2 p-4">
          <p className="text-muted-foreground text-xs">Deleting a tournament drops its registrations, fixtures and standings.</p>
          <Button
            variant="destructive"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              confirm(`Delete "${t.name}" permanently?`) &&
              run("del", async () => {
                await deleteTournament(db, t.id);
                onDeleted();
              }, "Tournament deleted.")
            }
          >
            <Trash2 className="size-4" /> Delete tournament
          </Button>
        </div>
      </Section>
    </div>
  );
}
