import { useState } from "react";
import { ArrowLeftRight, Copy, Crown, Link2, Loader2, LogOut, Play, Shield, Sparkles, Swords, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Firestore } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/game/Avatar";
import { hostStart, switchTeam } from "@/lib/engine";
import { DUO_SYNC_BONUS, DUO_TEAM_SIZE, teamOf, type Match, type Team } from "@/lib/game-rules";
import { cn } from "@/lib/utils";
import { ThreeAvatarCanvas } from "@/components/avatar/ThreeAvatarCanvas";
import { usePlayerAvatar } from "@/lib/avatar";

export const TEAM_META: Record<Team, { name: string; text: string; bg: string; border: string; soft: string }> = {
  A: { name: "Team Nova", text: "text-primary", bg: "bg-primary", border: "border-primary/60", soft: "bg-primary/10" },
  B: { name: "Team Blaze", text: "text-accent", bg: "bg-accent", border: "border-accent/60", soft: "bg-accent/10" },
};

function DuoAvatarPod({
  db,
  id,
  name,
  isHost,
  isMe,
  teamColor,
}: {
  db: Firestore;
  id: string;
  name: string;
  isHost: boolean;
  isMe: boolean;
  teamColor: string;
}) {
  const avatar = usePlayerAvatar(db, id);

  return (
    <div className="surface-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-primary/20 bg-card/60 p-2.5 text-center transition-all shadow-md">
      <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-primary/15 via-background/40 to-black/60">
        <ThreeAvatarCanvas
          customization={avatar}
          interactive={true}
          showControls={false}
          height={150}
          spinSpeed={0.005}
          className="w-full"
        />

        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none">
          {isHost && (
            <span className="bg-amber-500/90 text-black font-black flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-wider shadow">
              <Crown className="size-2.5 fill-black text-black" /> Host
            </span>
          )}
          {isMe && (
            <span className="bg-primary/90 text-primary-foreground font-black rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-wider shadow">
              You
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 w-full min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <PlayerAvatar name={name} size={18} />
          <span className="truncate text-xs font-bold">{name}</span>
        </div>
      </div>
    </div>
  );
}

export function DuoLobby({ db, m, uid, onLeave }: { db: Firestore; m: Match; uid: string; onLeave: () => void }) {
  const [busy, setBusy] = useState(false);
  const isHost = m.hostId === uid;
  const myTeam = m.players[uid]?.team;
  const filled = m.playerIds.length;
  const ready = teamOf(m, "A").length === DUO_TEAM_SIZE && teamOf(m, "B").length === DUO_TEAM_SIZE;

  async function move(t: Team) {
    try { await switchTeam(db, m.id, uid, t); } catch (e) { toast.error((e as Error).message); }
  }
  async function start() {
    setBusy(true);
    try { await hostStart(db, m.id, uid); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  function share() {
    const text = `Join my 2v2 Tag Team battle with code ${m.code}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard.writeText(text); toast.success("Invite copied"); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="hero-card relative overflow-hidden p-6 text-center">
        <Shield className="text-primary/10 absolute -top-6 -left-6 size-40 -rotate-12" />
        <Shield className="text-accent/10 absolute -right-6 -bottom-6 size-40 rotate-12" />
        <div className="relative">
          <div className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase">
            <Swords className="size-3.5" /> 2v2 Tag Team · Waiting room
          </div>
          <div className="text-muted-foreground mt-4 text-xs font-semibold uppercase">Room code</div>
          <div className="tabular font-display mt-1 text-5xl font-extrabold tracking-[0.25em] sm:text-6xl">{m.code}</div>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="glass" size="sm" onClick={() => { navigator.clipboard.writeText(m.code!); toast.success("Code copied"); }}><Copy /> Copy code</Button>
            <Button variant="glass" size="sm" onClick={share}><Link2 /> Invite</Button>
          </div>
          {/* Seat progress */}
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-1.5">
            {Array.from({ length: DUO_TEAM_SIZE * 2 }).map((_, i) => (
              <div key={i} className={cn("h-2 flex-1 rounded-full transition-colors duration-500", i < filled ? (i < 2 ? "bg-primary" : "bg-accent") : "bg-muted")} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {ready ? "All four players are in. Ready to battle!" : `${filled}/4 players · waiting for ${4 - filled} more`}
          </p>
        </div>
      </div>

      {/* Teams */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["A", "B"] as Team[]).map((t) => {
          const meta = TEAM_META[t];
          const ids = teamOf(m, t);
          const canJoin = myTeam !== t && ids.length < DUO_TEAM_SIZE;
          return (
            <div key={t} className={cn("surface-card relative overflow-hidden p-4 rounded-2xl", myTeam === t && meta.border)}>
              <div className={cn("absolute inset-x-0 top-0 h-1", meta.bg)} />
              <div className="mb-3 flex items-center gap-2">
                <Shield className={cn("size-5", meta.text)} />
                <span className="truncate font-extrabold text-sm sm:text-base">{meta.name}</span>
                <span className="tabular text-muted-foreground ml-auto text-xs font-bold">{ids.length}/{DUO_TEAM_SIZE}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: DUO_TEAM_SIZE }).map((_, i) => {
                  const id = ids[i];
                  if (!id) {
                    return (
                      <div key={i} className="text-muted-foreground flex flex-col items-center justify-center min-h-[190px] rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                        <div className="relative mb-2 grid size-10 shrink-0 place-items-center">
                          <span className={cn("animate-pulse-ring absolute inset-0 rounded-full opacity-40", meta.bg)} />
                          <UserPlus className="relative size-4" />
                        </div>
                        <span className="text-xs font-semibold">Open seat</span>
                      </div>
                    );
                  }
                  const p = m.players[id];
                  return (
                    <DuoAvatarPod
                      key={id}
                      db={db}
                      id={id}
                      name={p?.name ?? "Player"}
                      isHost={id === m.hostId}
                      isMe={id === uid}
                      teamColor={meta.text}
                    />
                  );
                })}
              </div>
              {canJoin && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => move(t)}>
                  <ArrowLeftRight className="mr-1.5 size-3.5" /> Switch to {meta.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
        {isHost && (
          <Button size="lg" className="w-full sm:w-auto font-bold" disabled={!ready || busy} onClick={start}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Start Duo Battle
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={onLeave}>
          <LogOut className="mr-2 size-4" /> Leave room
        </Button>
      </div>
    </div>
  );
}
