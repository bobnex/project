import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  ArrowLeft, Award, Eye, CalendarClock, Check, Crown, Loader2, Play, RefreshCw, ShieldCheck, Swords, Trash2, Trophy, UserMinus, UserPlus, X,
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
    const a = onSnapshot(doc(fb.db, "tournaments", tournamentId),
      (s) => setT(s.exists() ? ({ id: s.id, ...(s.data() as Omit<Tournament, "id">) }) : null), () => setT(null));
    const b = onSnapshot(query(collection(fb.db, "t_players"), where("tournamentId", "==", tournamentId)),
      (s) => setPlayers(s.docs.map((d) => d.data() as TournamentPlayer)), () => {});
    const c = onSnapshot(query(collection(fb.db, "t_fixtures"), where("tournamentId", "==", tournamentId)),
      (s) => setFixtures(s.docs.filter((d) => !d.id.startsWith("_")).map((d) => ({ ...(d.data() as Fixture), id: d.id }))), () => {});
    return () => { a(); b(); c(); };
  }, [fb, tournamentId]);

  const me = players.find((p) => p.uid === user?.uid);
  const myFixtures = useMemo(() => fixtures
    .filter((f) => f.aId === user?.uid || f.bId === user?.uid)
    .sort((a, b) => a.round - b.round), [fixtures, user]);
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
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
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

  return (
    <div className="space-y-5">
      <Link to="/tournaments" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground">
        <ArrowLeft className="size-4" /> All tournaments
      </Link>

      <div className="hero-card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">{t.name}</h1>
            <p className="text-muted-foreground text-sm">
              {FORMAT_LABELS[t.format]}{t.format === "league" ? ` · Season ${t.season}` : ""} · {coursePickLabel(parseCoursePick(t.subject))} · {t.questionsPerMatch} questions
            </p>
          </div>
          <Badge variant={t.status === "running" ? "default" : "secondary"}>{STATUS_LABEL[t.status]}</Badge>
        </div>
        {t.description && <p className="text-sm">{t.description}</p>}
        {champion && (
          <div className="bg-warning/12 text-warning flex items-center gap-2 rounded-xl px-3 py-2 font-semibold">
            <Crown className="size-5" /> Champion: {champion.name}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {t.status === "registration" && !registered && (
            <Button disabled={!!busy} onClick={() => run("reg", () => registerForTournament(db, t.id, user.uid, profile.username),
              t.requireApproval ? "Request sent — an admin will review it." : "You're in!")}>
              <UserPlus className="size-4" /> {t.requireApproval ? "Request to join" : "Join tournament"}
            </Button>
          )}
          {t.status === "registration" && registered && (
            <>
              <Badge variant="outline">{me!.status === "pending" ? "Waiting for approval" : "Registered"}</Badge>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run("leave", () => leaveTournament(db, t.id, user.uid), "You left the tournament.")}>
                <UserMinus className="size-4" /> Leave
              </Button>
            </>
          )}
          {me?.status === "rejected" && <Badge variant="destructive">Your entry was declined</Badge>}
          {me?.status === "eliminated" && <Badge variant="secondary">You were knocked out</Badge>}
          {nextMatch && t.status === "running" && (
            <Button disabled={!!busy} onClick={() => play(nextMatch)}>
              {busy === `play-${nextMatch.id}` ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Play vs {nextMatch.aId === user.uid ? nextMatch.bName : nextMatch.aName}
            </Button>
          )}
          <span className="text-muted-foreground text-sm">{t.participantCount}/{t.maxParticipants} players</span>
        </div>
      </div>

      <PrizeCard t={t} isAdmin={isAdmin} />
      <LiveWatchDialog fixture={watching} onClose={() => setWatching(null)} />

      <Tabs defaultValue={t.status === "registration" ? "players" : "table"} className="space-y-4">
        <TabsList className={cn("grid w-full rounded-xl", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="table">{t.format === "elimination" ? "Bracket" : "Table"}</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin"><ShieldCheck className="size-4" /></TabsTrigger>}
        </TabsList>
        <TabsContent value="table"><Standings t={t} players={players} fixtures={fixtures} uid={user.uid} onWatch={setWatching} /></TabsContent>
        <TabsContent value="matches">
          <MatchList t={t} fixtures={fixtures} uid={user.uid} busy={busy} onPlay={play} onWatch={setWatching} />
        </TabsContent>
        <TabsContent value="players"><PlayerList players={players} /></TabsContent>
        {isAdmin && (
          <TabsContent value="admin">
            <AdminPanel t={t} players={players} fixtures={fixtures} busy={busy} run={run}
              onDeleted={() => navigate({ to: "/tournaments" })} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ---------------- Standings / bracket ---------------- */

function Standings({ t, players, fixtures, uid, onWatch }: { t: Tournament; players: TournamentPlayer[]; fixtures: Fixture[]; uid: string; onWatch: (f: Fixture) => void }) {
  const inPlay = players.filter((p) => p.status !== "pending" && p.status !== "rejected");
  if (t.status === "registration")
    return <Empty icon={CalendarClock} title="Not started yet" text="The draw happens when an admin starts the tournament." />;

  const knockout = fixtures.filter((f) => f.stage === "knockout");
  if (t.format === "elimination") return <BracketTree fixtures={knockout} uid={uid} onWatch={onWatch} />;

  if (t.format === "groups") {
    const gCount = Math.max(0, ...inPlay.map((p) => (p.group ?? 0) + 1));
    return (
      <div className="space-y-5">
        {knockout.length > 0 && <Section title="Knockout" icon={Swords}><BracketTree fixtures={knockout} uid={uid} onWatch={onWatch} /></Section>}
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
          <Table rows={standings(inPlay.filter((p) => p.division === d), t.tiebreakers)} uid={uid}
            highlightTop={d > 0 ? t.promoteSlots : 0} highlightBottom={d < dCount - 1 ? t.relegateSlots : 0} />
        </Section>
      ))}
      <p className="text-muted-foreground text-xs">Green rows go up a division and red rows go down when the season ends.</p>
    </div>
  );
}

function Table({ rows, uid, highlightTop = 0, highlightBottom = 0 }: { rows: TournamentPlayer[]; uid: string; highlightTop?: number; highlightBottom?: number }) {
  if (!rows.length) return <div className="text-muted-foreground text-sm">No players.</div>;
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-b">
            <th className="p-2 text-left">#</th><th className="p-2 text-left">Player</th>
            <th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th>
            <th className="p-2">+/-</th><th className="p-2">Pts</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((p, i) => {
            const up = i < highlightTop;
            const down = highlightBottom > 0 && rows.length > highlightTop + highlightBottom && i >= rows.length - highlightBottom;
            return (
              <tr key={p.uid} className={cn("border-b last:border-0", p.uid === uid && "bg-primary/10", up && "border-l-2 border-l-success", down && "border-l-2 border-l-destructive")}>
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-semibold">
                  <span className="flex items-center gap-2">{p.name}{p.status === "eliminated" && <span className="text-muted-foreground text-xs">out</span>}</span>
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

function MatchList({ t, fixtures, uid, busy, onPlay, onWatch }: { t: Tournament; fixtures: Fixture[]; uid: string; busy: string | null; onPlay: (f: Fixture) => void; onWatch: (f: Fixture) => void }) {
  const [mine, setMine] = useState(true);
  const list = fixtures.filter((f) => !mine || f.aId === uid || f.bId === uid)
    .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "knockout" ? 1 : -1) || a.round - b.round);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={mine ? "default" : "outline"} onClick={() => setMine(true)}>My matches</Button>
        <Button size="sm" variant={!mine ? "default" : "outline"} onClick={() => setMine(false)}>All matches</Button>
      </div>
      {list.length === 0 ? (
        <Empty icon={Swords} title="No matches yet" text={t.status === "registration" ? "Matches appear once the tournament starts." : ""} />
      ) : list.map((f) => <FixtureRow key={f.id} f={f} uid={uid} busy={busy} onPlay={t.status === "running" ? onPlay : undefined}
          admin={f.status === "ready" && f.matchId && f.aId !== uid && f.bId !== uid
            ? <Button size="sm" variant="outline" onClick={() => onWatch(f)}><Eye className="size-4" /> Watch live</Button> : undefined} />)}
    </div>
  );
}

function FixtureRow({ f, uid, busy, onPlay, admin }: { f: Fixture; uid: string; busy: string | null; onPlay?: ((f: Fixture) => void) | undefined; admin?: React.ReactNode }) {
  const mineFx = f.aId === uid || f.bId === uid;
  const open = f.status === "scheduled" || f.status === "ready";
  const late = open && f.deadline && Date.now() > f.deadline;
  return (
    <div className={cn("surface-card space-y-2 p-3", mineFx && "border-primary/40")}>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{stageLabel(f)}</span>
        <span>{f.status === "completed" ? (f.decidedBy === "walkover" ? "Set by admin" : "Finished") : late ? "Deadline passed" : f.deadline ? `Play by ${new Date(f.deadline).toLocaleDateString()}` : ""}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className={cn("flex-1 truncate text-right font-semibold", f.winnerId === f.aId && "text-success")}>{f.aName}</div>
        <div className="tabular bg-muted rounded-lg px-2 py-1 text-sm font-bold">{f.status === "completed" ? `${f.scoreA} – ${f.scoreB}` : "vs"}</div>
        <div className={cn("flex-1 truncate font-semibold", f.winnerId === f.bId && "text-success")}>{f.bName}</div>
      </div>
      {(onPlay && mineFx && open && !late) || admin ? (
        <div className="flex flex-wrap justify-end gap-2">
          {onPlay && mineFx && open && !late && (
            <Button size="sm" disabled={!!busy} onClick={() => onPlay(f)}>
              {busy === `play-${f.id}` ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {f.status === "ready" ? "Join match" : "Play"}
            </Button>
          )}
          {admin}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Players ---------------- */

function PlayerList({ players }: { players: TournamentPlayer[] }) {
  const list = players.filter((p) => p.status !== "rejected").sort((a, b) => a.seed - b.seed);
  if (!list.length) return <Empty icon={UserPlus} title="No one has joined yet" />;
  const badge: Record<string, string> = { pending: "Pending", approved: "Registered", active: "Playing", eliminated: "Out", champion: "Champion" };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((p) => (
        <div key={p.uid} className="surface-card flex items-center gap-3 p-3">
          <PlayerAvatar name={p.name} size={32} />
          <span className="flex-1 truncate font-semibold">{p.name}</span>
          <Badge variant={p.status === "champion" ? "default" : "secondary"}>{badge[p.status] ?? p.status}</Badge>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Admin ---------------- */

function AdminPanel({ t, players, fixtures, busy, run, onDeleted }: {
  t: Tournament; players: TournamentPlayer[]; fixtures: Fixture[]; busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, ok?: string) => Promise<void>; onDeleted: () => void;
}) {
  const { fb } = useApp();
  const db = fb!.db;
  const [edit, setEdit] = useState<Fixture | null>(null);
  const pending = players.filter((p) => p.status === "pending");
  const approved = players.filter((p) => p.status === "approved");
  const open = fixtures.filter((f) => f.status === "scheduled" || f.status === "ready").sort((a, b) => a.round - b.round);
  const seasonComplete = (t as Tournament & { seasonComplete?: boolean }).seasonComplete;

  return (
    <div className="space-y-5">
      <Section title="Controls" icon={ShieldCheck}>
        <div className="flex flex-wrap gap-2">
          {t.status === "registration" && (
            <Button disabled={!!busy} onClick={() => run("start", () => startTournament(db, t.id), "Tournament started — fixtures drawn.")}>
              <Play className="size-4" /> Start ({approved.length} players)
            </Button>
          )}
          {t.status === "running" && (
            <Button variant="outline" disabled={!!busy} onClick={() => run("adv", () => maybeAdvance(db, t.id), "Progress checked.")}>
              <RefreshCw className="size-4" /> Check progress
            </Button>
          )}
          {t.format === "league" && t.status === "running" && (
            <Button variant={seasonComplete ? "default" : "outline"} disabled={!!busy}
              onClick={() => { if (seasonComplete || confirm("Some matches are unplayed. End the season anyway?")) run("season", () => endSeason(db, t.id), "New season started."); }}>
              <Trophy className="size-4" /> End season &amp; start next
            </Button>
          )}
          {t.format === "league" && t.status === "running" && (
            <Button variant="outline" disabled={!!busy} onClick={() => run("finish", () => updateTournament(db, t.id, { status: "completed" }), "League closed.")}>
              Close league
            </Button>
          )}
          {(t.status === "registration" || t.status === "running") && (
            <Button variant="outline" disabled={!!busy} onClick={() => confirm("Cancel this tournament?") && run("cancel", () => updateTournament(db, t.id, { status: "cancelled" }), "Tournament cancelled.")}>
              <X className="size-4" /> Cancel
            </Button>
          )}
          <Button variant="destructive" disabled={!!busy} onClick={() => confirm("Delete this tournament and all its matches?") && run("del", async () => { await deleteTournament(db, t.id); onDeleted(); }, "Tournament deleted.")}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </Section>

      {pending.length > 0 && (
        <Section title={`Sign-up requests (${pending.length})`} icon={UserPlus}>
          {pending.map((p) => (
            <div key={p.uid} className="surface-card flex items-center gap-2 p-3">
              <span className="flex-1 font-semibold">{p.name}</span>
              <Button size="sm" onClick={() => run(`ap-${p.uid}`, () => adminUpdateParticipant(db, t.id, p.uid, { status: "approved" }))}><Check className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => run(`rj-${p.uid}`, () => adminUpdateParticipant(db, t.id, p.uid, { status: "rejected" }))}><X className="size-4" /></Button>
            </div>
          ))}
        </Section>
      )}

      {t.status === "registration" && approved.length > 0 && (
        <Section title="Registered players" icon={UserMinus}>
          {approved.map((p) => (
            <div key={p.uid} className="surface-card flex items-center gap-2 p-3">
              <span className="flex-1 font-semibold">{p.name}</span>
              <Button size="sm" variant="outline" onClick={() => run(`rm-${p.uid}`, () => adminUpdateParticipant(db, t.id, p.uid, { status: "rejected" }), "Player removed.")}>Remove</Button>
            </div>
          ))}
        </Section>
      )}

      {open.length > 0 && (
        <Section title={`Unplayed matches (${open.length})`} icon={Swords}>
          {open.map((f) => (
            <FixtureRow key={f.id} f={f} uid="" busy={busy} admin={
              <>
                <Button size="sm" variant="outline" onClick={() => setEdit(f)}>Set result</Button>
                <Button size="sm" variant="outline" onClick={() => run(`rs-${f.id}`, () => adminRescheduleFixture(db, f.id, Date.now() + 2 * DAY_MS), "Deadline moved 2 days out.")}>+2 days</Button>
                <Button size="sm" variant="ghost" onClick={() => confirm("Delete this match?") && run(`df-${f.id}`, () => adminDeleteFixture(db, f.id))}><Trash2 className="size-4" /></Button>
              </>
            } />
          ))}
        </Section>
      )}

      <ResultDialog f={edit} onClose={() => setEdit(null)} onSave={(a, b, w) => edit && run("res", async () => {
        await adminSetFixtureResult(db, edit.id, a, b, w);
        await maybeAdvance(db, t.id);
        setEdit(null);
      }, "Result saved.")} />
    </div>
  );
}

function ResultDialog({ f, onClose, onSave }: { f: Fixture | null; onClose: () => void; onSave: (a: number, b: number, winner: string | null) => void }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  useEffect(() => { setA(0); setB(0); setWinner(null); }, [f?.id]);
  if (!f) return null;
  const knockout = f.stage === "knockout";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set result</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm"><span>{f.aName}</span><Input type="number" min={0} value={a} onChange={(e) => setA(Number(e.target.value))} /></label>
          <label className="space-y-1 text-sm"><span>{f.bName}</span><Input type="number" min={0} value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={winner === f.aId ? "default" : "outline"} onClick={() => setWinner(f.aId)}>{f.aName} wins</Button>
          <Button size="sm" variant={winner === f.bId ? "default" : "outline"} onClick={() => setWinner(f.bId)}>{f.bName} wins</Button>
          {!knockout && <Button size="sm" variant={winner === null ? "default" : "outline"} onClick={() => setWinner(null)}>Draw</Button>}
        </div>
        <Button disabled={knockout && !winner} onClick={() => onSave(a, b, winner)}>Save result</Button>
      </DialogContent>
    </Dialog>
  );
}
