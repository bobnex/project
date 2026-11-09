import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface HistoryItem { id: string; mode: string; result: string; score: number; opponents: string[]; players: number; ratingDelta: number; at: number }

export function HistoryRow({ h }: { h: HistoryItem }) {
  const tone = h.result === "win" ? "text-success bg-success/12" : h.result === "draw" ? "text-warning bg-warning/12" : "text-destructive bg-destructive/12";
  return (
    <Link to="/review/$matchId" params={{ matchId: h.id }} className="surface-card hover:border-primary/50 flex items-center gap-3 p-3 transition-colors">
      <span className={`grid size-10 place-items-center rounded-xl text-xs font-extrabold uppercase ${tone}`}>{h.result}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {h.mode === "rush" ? `Rush · ${h.players} players` : h.mode === "duo" ? `2v2 vs ${h.opponents.join(" & ") || "team"}` : `vs ${h.opponents[0] ?? "opponent"}`}
        </div>
        <div className="text-muted-foreground text-xs">{new Date(h.at).toLocaleString()}</div>
      </div>
      <div className="text-right">
        <div className="tabular text-sm font-bold">{h.score}</div>
        {h.ratingDelta !== 0 && <div className={`tabular text-xs ${h.ratingDelta > 0 ? "text-success" : "text-destructive"}`}>{h.ratingDelta > 0 ? "+" : ""}{h.ratingDelta} SR</div>}
      </div>
      <ChevronRight className="text-muted-foreground size-4" />
    </Link>
  );
}
