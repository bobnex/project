// src/components/game/VoiceChat.tsx
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Firestore } from "firebase/firestore";
import {
  GripVertical,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoiceSession } from "@/lib/voice-session";
import { clampVoicePosition } from "@/lib/voice-rules";

type State = "idle" | "joining" | "waiting" | "live" | "error";

export function VoiceChat({
  db,
  matchId,
  uid,
  playerIds,
}: {
  db: Firestore;
  matchId: string;
  uid: string;
  playerIds: string[];
}) {
  const [state, setState] = useState<State>("idle");
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const session = useRef<VoiceSession | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);

  const players = useRef(playerIds);
  players.current = playerIds;

  function stop() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    session.current?.stop();
    session.current = null;
  }

  useEffect(() => () => stop(), [db, matchId, uid]);

  useEffect(() => {
    session.current?.setPlayers(playerIds);
  }, [playerIds]);

  function place(x: number, y: number) {
    const rect = widget.current?.getBoundingClientRect();
    if (!rect) return;

    setPosition(
      clampVoicePosition(
        x,
        y,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      ),
    );
  }

  useEffect(() => {
    const fit = () => {
      const rect = widget.current?.getBoundingClientRect();
      if (rect) place(rect.left, rect.top);
    };

    const observer = new ResizeObserver(fit);

    if (widget.current) observer.observe(widget.current);

    window.addEventListener("resize", fit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  async function join(automatic = false) {
    stop();

    if (!automatic) retries.current = 0;

    setState("joining");
    setConnected(0);
    setBlocked(false);

    let next: VoiceSession;

    const fail = (message: string) => {
      if (session.current !== next) return;

      next.stop();
      session.current = null;

      if (retries.current < 2) {
        retries.current += 1;
        setState("joining");

        retryTimer.current = setTimeout(() => {
          void join(true);
        }, 1_500 * retries.current);
      } else {
        setState("error");
        toast.error(message);
      }
    };

    next = new VoiceSession(
      db,
      matchId,
      uid,
      players.current,
      (count, total) => {
        if (session.current !== next) return;

        setConnected(count);
        setState(
          count > 0
            ? "live"
            : total > 0
              ? "joining"
              : "waiting",
        );
      },
      fail,
      () => {
        if (session.current === next) setBlocked(true);
      },
    );

    session.current = next;

    try {
      await next.start();

      if (session.current === next) {
        next.setMuted(muted);
        setState((current) =>
          current === "joining" ? "waiting" : current,
        );
      }
    } catch (error) {
      if (session.current !== next) return;

      stop();
      setState("error");

      const name = error instanceof Error ? error.name : "";

      toast.error(
        name === "NotAllowedError"
          ? "Microphone access blocked. Allow it in your browser, then retry."
          : name === "NotFoundError"
            ? "No microphone found. Connect one, then retry."
            : "Couldn't start voice. Check microphone and room access, then retry.",
      );
    }
  }

  function leave() {
    stop();
    retries.current = 0;
    setState("idle");
    setMuted(false);
    setBlocked(false);
    setConnected(0);
  }

  function toggleMute() {
    const next = !muted;
    session.current?.setMuted(next);
    setMuted(next);
  }

  function startDrag(e: PointerEvent<HTMLButtonElement>) {
    const rect = widget.current?.getBoundingClientRect();
    if (!rect) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      top: rect.top,
    };
  }

  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;

    if (start) {
      place(
        start.left + e.clientX - start.x,
        start.top + e.clientY - start.y,
      );
    }
  }

  function moveKeyboard(e: KeyboardEvent<HTMLButtonElement>) {
    const rect = widget.current?.getBoundingClientRect();
    if (!rect) return;

    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;
    }

    e.preventDefault();

    place(
      rect.left +
        (e.key === "ArrowLeft"
          ? -24
          : e.key === "ArrowRight"
            ? 24
            : 0),
      rect.top +
        (e.key === "ArrowUp"
          ? -24
          : e.key === "ArrowDown"
            ? 24
            : 0),
    );
  }

  return (
    <div
      ref={widget}
      role="region"
      aria-label="Voice controls"
      className="surface-card fixed right-4 bottom-24 z-40 flex max-w-[calc(100vw-16px)] items-center gap-1.5 p-2 shadow-lg md:bottom-6"
      style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
    >
      <Button
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 touch-none cursor-grab active:cursor-grabbing"
        aria-label="Move voice controls"
        title="Move voice controls"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={moveKeyboard}
      >
        <GripVertical className="size-4" />
      </Button>

      {state === "idle" || state === "error" ? (
        <Button size="sm" variant="hero" onClick={() => join()}>
          {state === "error" ? <RotateCcw /> : <Phone />}
          {state === "error" ? "Retry voice" : "Join voice"}
        </Button>
      ) : (
        <>
          <span
            aria-live="polite"
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 px-1 text-xs font-semibold"
          >
            {state === "joining" ? (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                Connecting…
              </>
            ) : state === "waiting" ? (
              <>
                <Mic className="size-3.5 shrink-0" />
                Waiting for players
              </>
            ) : (
              <>
                <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
                Voice · {connected} connected
              </>
            )}
          </span>

          {blocked && (
            <Button
              size="icon"
              variant="glass"
              aria-label="Enable voice audio"
              title="Enable voice audio"
              onClick={async () => {
                try {
                  await session.current?.resumeAudio();
                  setBlocked(false);
                } catch {
                  toast.error(
                    "Audio playback blocked. Tap again to enable it.",
                  );
                }
              }}
            >
              <Volume2 />
            </Button>
          )}

          <Button
            size="icon"
            variant="glass"
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted ? <MicOff /> : <Mic />}
          </Button>

          <Button
            size="icon"
            variant="destructive"
            aria-label="Leave voice"
            title="Leave voice"
            onClick={leave}
          >
            <PhoneOff />
          </Button>
        </>
      )}
    </div>
  );
}
