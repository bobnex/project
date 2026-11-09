import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, Clock, DoorOpen, Ghost, HelpCircle, KeyRound, Loader2, Lock, Plus, Search, Settings2, Shield, Sparkles, Swords, Users, Zap } from "lucide-react";
import { CourseMultiSelect } from "@/components/game/course-multiselect";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { createRoom, findClassicMatch, joinRoomByCode, joinRush } from "@/lib/engine";
import { useSubjects } from "@/lib/subjects";
import { pageMeta } from "@/lib/meta";
import { ringEveryone } from "@/components/game/RingListener";
import { play } from "@/lib/sfx";
import type { Mode } from "@/lib/game-rules";

export const Route = createFileRoute("/_player/battle")({
  head: () => pageMeta("Battle Arena", "Find a 1v1 opponent, team up for 2v2 Tag Team or join the 50 Players Rush."),
  component: Battle,
});

export function Battle() {
  const { fb, user, profile, settings } = useApp();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<string[]>([]);
  const subjects = useSubjects(fb?.db);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const cancelRef = useRef<null | (() => Promise<void>)>(null);

  // Private room modal state
  const [configureMode, setConfigureMode] = useState<Mode | null>(null);
  const [roomCourses, setRoomCourses] = useState<string[]>([]);
  const [roomSec, setRoomSec] = useState<number>(15);
  const [roomCount, setRoomCount] = useState<number>(20);

  const [waited, setWaited] = useState(false);
  const [ghostReady, setGhostReady] = useState(false);
  useEffect(() => () => { cancelRef.current?.(); }, []);
  useEffect(() => {
    if (!searching) { setWaited(false); setGhostReady(false); return; }
    const ghostWaitMs = (settings.ghostWaitSeconds ?? 25) * 1000;
    const t = setTimeout(() => setWaited(true), 10_000);
    const g = setTimeout(() => setGhostReady(true), ghostWaitMs);
    return () => { clearTimeout(t); clearTimeout(g); };
  }, [searching, settings.ghostWaitSeconds]);

  if (!fb || !user || !profile) return null;
  const locked = profile.status !== "approved";
  const go = (id: string) => navigate({ to: "/match/$matchId", params: { matchId: id } });

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  function openRoomConfig(mode: Mode) {
    setConfigureMode(mode);
    setRoomCourses(courses);
    setRoomSec(mode === "rush" ? 25 : 15);
    setRoomCount(mode === "rush" ? 25 : 20);
  }

  async function handleCreateConfiguredRoom() {
    if (!configureMode || !fb || !user || !profile) return;
    await run("custom-room", async () => {
      const r = await createRoom(fb.db, user.uid, profile.username, configureMode, roomCourses, {
        secondsPerQuestion: roomSec,
        questionCount: roomCount,
      });
      setConfigureMode(null);
      go(r.id);
    });
  }

  async function startSearch() {
    setSearching(true);
    try {
      cancelRef.current = await findClassicMatch(fb!.db, user!.uid, profile!.username, courses, (id) => {
        cancelRef.current = null;
        setSearching(false);
        play("found");
        go(id);
      }, profile!.rp ?? 0);
    } catch (e) {
      setSearching(false);
      toast.error((e as Error).message);
    }
  }
  async function cancelSearch() {
    await cancelRef.current?.();
    cancelRef.current = null;
    setSearching(false);
  }

  return (
    <div className="space-y-6">
      {locked && (
        <div className="surface-card flex items-center gap-3 p-3 text-sm">
          <Lock className="text-warning size-5" /> Battles unlock once an admin approves your account.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-sm font-semibold">Courses</span>
        <CourseMultiSelect value={courses} onChange={setCourses} subjects={subjects} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Classic */}
        <div className="hero-card relative overflow-hidden p-5">
          <Swords className="text-primary/10 absolute -top-4 -right-4 size-36" />
          <div className="bg-primary/15 text-primary mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
            <Swords className="size-3.5" /> CLASSIC 1V1
          </div>
          <h2 className="text-2xl font-extrabold">Head-to-head duel</h2>
          <p className="text-muted-foreground mt-1 text-sm">20 questions · 15 seconds each · ranked</p>
          <div className="mt-5 space-y-3">
            <Button variant="hero" size="lg" className="w-full" disabled={locked || searching} onClick={startSearch}>
              <Search /> Find opponent
            </Button>
            <Button variant="glass" size="lg" className="w-full" disabled={locked || !!busy} onClick={() => openRoomConfig("classic")}>
              <Plus /> Create private room
            </Button>
          </div>
        </div>

        {/* Rush */}
        <div className="hero-card relative overflow-hidden p-5">
          <Zap className="text-accent/15 absolute -top-4 -right-4 size-36" />
          <div className="bg-accent/15 text-accent mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
            <Zap className="size-3.5" /> 50 PLAYERS RUSH
          </div>
          <h2 className="text-2xl font-extrabold">Last one standing</h2>
          <p className="text-muted-foreground mt-1 text-sm">Up to 50 players · 25 seconds each · 2 wrong answers and you're out</p>
          <div className="mt-5 space-y-3">
            <Button variant="hero" size="lg" className="w-full" disabled={locked || !!busy}
              onClick={() => run("rush", async () => go(await joinRush(fb.db, user.uid, profile.username)))}>
              {busy === "rush" ? <Loader2 className="animate-spin" /> : <Users />} Join Rush lobby
            </Button>
            <Button variant="glass" size="lg" className="w-full" disabled={locked || !!busy} onClick={() => openRoomConfig("rush")}>
              <Plus /> Private Rush room
            </Button>
          </div>
        </div>
      </div>

      {/* 2v2 Tag Team */}
      <div className="hero-card relative overflow-hidden p-5">
        <Shield className="text-primary/10 absolute -top-4 -right-4 size-36" />
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="bg-primary/15 text-primary mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
              <Shield className="size-3.5" /> 2V2 TAG TEAM
            </div>
            <h2 className="text-2xl font-extrabold">Team up, sync up</h2>
            <p className="text-muted-foreground mt-1 text-sm">Two teams of two · 20 questions · combined score wins</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="text-warning size-4" /> Both teammates right = Sync bonus for each</p>
          </div>
          <Button variant="hero" size="lg" className="md:w-56" disabled={locked || !!busy} onClick={() => openRoomConfig("duo")}>
            <Plus /> Create 2v2 room
          </Button>
        </div>
      </div>

      {/* Join code */}
      <div className="surface-card p-5">
        <h3 className="flex items-center gap-2 font-bold"><KeyRound className="text-primary size-4" /> Join with a room code</h3>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run("code", async () => go(await joinRoomByCode(fb.db, user.uid, profile.username, code))); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7Q2XP" maxLength={6} className="tabular h-12 rounded-xl text-lg tracking-[0.3em] uppercase" />
          <Button type="submit" size="lg" disabled={locked || code.length < 6 || !!busy}>
            {busy === "code" ? <Loader2 className="animate-spin" /> : <DoorOpen />} Join
          </Button>
        </form>
      </div>

      {/* Searching Matchmaking Dialog */}
      <Dialog open={searching} onOpenChange={(open) => !open && cancelSearch()}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Search className="text-primary size-5 animate-pulse" />
              Finding Opponent…
            </DialogTitle>
          </DialogHeader>

          <div className="py-5 space-y-4">
            <div className="relative mx-auto flex size-20 items-center justify-center">
              <div className="border-primary/20 absolute inset-0 animate-ping rounded-full border-2" />
              <div className="bg-primary/10 grid size-16 place-items-center rounded-full">
                <Swords className="text-primary size-8 animate-bounce" />
              </div>
            </div>

            <p className="text-muted-foreground text-sm">
              Scanning for active players in {courses.length ? `${courses.length} selected course(s)` : "all courses"}…
            </p>

            {/* Ring everyone online option (after 10s) */}
            {waited && settings.ringEnabled && (
              <div className="surface-card p-3 space-y-2 animate-in fade-in">
                <p className="text-xs text-muted-foreground">Waiting for a duel?</p>
                <Button
                  variant="hero"
                  size="sm"
                  className="w-full"
                  disabled={busy === "ring"}
                  onClick={() => run("ring", async () => {
                    await ringEveryone(fb.db, user.uid, profile.username, courses);
                    toast.success("Rang all players online! Waiting for someone to accept.");
                  })}
                >
                  <Bell className="size-4 mr-1.5" /> Ring everyone online
                </Button>
              </div>
            )}

            {/* Ghost Rival popup option (after admin-configured ghostWaitSeconds) */}
            {ghostReady && settings.ghostEnabled && (
              <div className="surface-card p-3 space-y-2 animate-in fade-in border-primary/30">
                <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
                  <Ghost className="text-primary size-4" /> Ghost Rival ready
                </div>
                <p className="text-xs text-muted-foreground">
                  Battle the recorded answers of a real past player right now!
                </p>
                <Button
                  variant="hero"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    await cancelSearch();
                    navigate({ to: "/ghost" });
                  }}
                >
                  <Ghost className="size-4 mr-1.5" /> Battle a Ghost Rival
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" onClick={cancelSearch}>
              Cancel search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Private Room Dialog */}
      <Dialog open={!!configureMode} onOpenChange={(open) => !open && setConfigureMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="text-primary size-5" />
              {configureMode === "rush" ? "Private Rush 50 Settings" : configureMode === "duo" ? "Private 2v2 Tag Team Settings" : "Private 1v1 Duel Settings"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Courses */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Course(s)</Label>
              <CourseMultiSelect value={roomCourses} onChange={setRoomCourses} subjects={subjects} />
            </div>

            {/* Seconds per question */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Seconds per question
                </Label>
                <span className="text-sm font-extrabold tabular text-primary">{roomSec}s</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[10, 15, 20, 25, 30, 45].map((s) => (
                  <Button key={s} type="button" size="sm" variant={roomSec === s ? "default" : "outline"} className="h-8 px-3" onClick={() => setRoomSec(s)}>
                    {s}s
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={5}
                max={90}
                value={roomSec}
                onChange={(e) => setRoomSec(Math.max(5, Math.min(90, Number(e.target.value) || 15)))}
                className="tabular"
                placeholder="Custom seconds (5 - 90)"
              />
            </div>

            {/* Number of questions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HelpCircle className="size-3.5" /> Questions to answer
                </Label>
                <span className="text-sm font-extrabold tabular text-primary">{roomCount} Qs</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 25, 30].map((q) => (
                  <Button key={q} type="button" size="sm" variant={roomCount === q ? "default" : "outline"} className="h-8 px-3" onClick={() => setRoomCount(q)}>
                    {q} Qs
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={3}
                max={50}
                value={roomCount}
                onChange={(e) => setRoomCount(Math.max(3, Math.min(50, Number(e.target.value) || 20)))}
                className="tabular"
                placeholder="Custom questions (3 - 50)"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfigureMode(null)}>Cancel</Button>
            <Button variant="hero" disabled={busy === "custom-room"} onClick={handleCreateConfiguredRoom}>
              {busy === "custom-room" ? <Loader2 className="animate-spin" /> : <Plus />}
              Create Room & Get Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
