import { useState } from "react";
import { ArrowLeftRight, Copy, Crown, Link2, Loader2, LogOut, Play, Shield, Sparkles, Swords, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Firestore } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/game/Avatar";
import { hostStart, switchTeam } from "@/lib/engine";
import { DUO_SYNC_BONUS, DUO_TEAM_SIZE, teamOf, type Match, type Team } from "@/lib/game-rules";
import { cn } from "@/lib/utils";

export const TEAM_META: Record<Team, { name: string; text: string; bg: string; border: string; soft: string }> = {
  A: { name: "Team Nova", text: "text-primary", bg: "bg-primary", border: "border-primary/60", soft: "bg-primary/10" },
  B: { name: "Team Blaze", text: "text-accent", bg: "bg-accent", border: "border-accent/60", soft: "bg-accent/10" },
};

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
      <div className="relative grid grid-cols-2 gap-3 sm:gap-6">
        {(["A", "B"] as Team[]).map((t) => {
          const meta = TEAM_META[t];
          const ids = teamOf(m, t);
          const canJoin = myTeam !== t && ids.length < DUO_TEAM_SIZE;
          return (
            <div key={t} className={cn("surface-card relative overflow-hidden p-3 sm:p-4", myTeam === t && meta.border, t === "A" ? "animate-vs-left" : "animate-vs-right")}>
              <div className={cn("absolute inset-x-0 top-0 h-1", meta.bg)} />
              <div className="mb-3 flex items-center gap-2">
                <Shield className={cn("size-5", meta.text)} />
                <span className="truncate font-extrabold">{meta.name}</span>
                <span className="tabular text-muted-foreground ml-auto text-xs font-bold">{ids.length}/{DUO_TEAM_SIZE}</span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: DUO_TEAM_SIZE }).map((_, i) => {
                  const id = ids[i];
                  if (!id) {
                    return (
                      <div key={i} className="text-muted-foreground flex h-16 items-center gap-3 rounded-2xl border border-dashed px-3">
                        <div className="relative grid size-10 shrink-0 place-items-center">
                          <span className={cn("animate-pulse-ring absolute inset-0 rounded-full opacity-40", meta.bg)} />
                          <UserPlus className="relative size-4" />
                        </div>
                        <span className="text-xs font-semibold sm:text-sm">Open seat</span>
                      </div>
                    );
                  }
                  const p = m.players[id];
                  return (
                    <div key={id} className={cn("animate-pop flex h-16 items-center gap-3 rounded-2xl px-3", meta.soft, id === uid && "ring-2 ring-offset-0", id === uid && (t === "A" ? "ring-primary/60" : "ring-accent/60"))}>
                      <PlayerAvatar name={p.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        <div className="text-muted-foreground text-xs">{id === uid ? "You" : id === m.hostId ? "Host" : "Ready"}</div>
                      </div>
                      {id === m.hostId && <Crown className="text-warning size-4 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              {canJoin && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => move(t)}>
                  <ArrowLeftRight /> Switch here
                </Button>
              )}
            </div>
          );
        })}
        <div className="bg-background font-display text-foreground shadow-glow absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-sm font-extrabold italic sm:size-14 sm:text-base">
          VS
        </div>
      </div>

      {/* How it works */}
      <div className="surface-card grid gap-3 p-4 sm:grid-cols-3">
        <Tip icon={Sparkles} title={`Sync bonus +${DUO_SYNC_BONUS}`} text="When both teammates answer right, each earns extra points." />
        <Tip icon={Zap} title="Speed counts" text="Faster correct answers score up to 150 points." />
        <Tip icon={Shield} title="Team total wins" text="Your two scores are added together. 20 questions." />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onLeave}><LogOut /> Leave</Button>
        {isHost ? (
          <Button variant="hero" size="lg" className="flex-1" disabled={busy || !ready} onClick={start}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />} {ready ? "Start battle" : "Waiting for players"}
          </Button>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Host starts the battle
          </div>
        )}
      </div>
    </div>
  );
}

function Tip({ icon: Icon, title, text }: { icon: typeof Zap; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-xl"><Icon className="text-primary size-4" /></div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-muted-foreground text-xs">{text}</div>
      </div>
    </div>
  );
}
