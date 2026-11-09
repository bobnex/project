import { Shield } from "lucide-react";
import { rankFor, type RankedConfig, type RankedState } from "@/lib/ranked";
import { cn } from "@/lib/utils";

/** Shows a player's ranked tier, division and progress to the next one. */
export function RankBadge({ state, cfg, showProgress = false, className }: { state: RankedState; cfg: RankedConfig; showProgress?: boolean; className?: string }) {
  const hasCompletedPlacement = !!state.placed || (state.placementPlayed ?? 0) >= cfg.placementMatches;

  if (!hasCompletedPlacement) {
    const played = state.placementPlayed ?? 0;
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", className)}>
        <Shield className="text-muted-foreground size-4" />
        Unranked · placement {played}/{cfg.placementMatches}
      </div>
    );
  }

  const rp = state.rp ?? 0;
  const r = rankFor(rp, cfg);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="inline-flex items-center gap-1.5 text-sm font-bold">
        <Shield className="size-4" style={{ color: r.tier.color, fill: r.tier.color }} />
        {r.label} · <span className="tabular">{rp} RP</span>
      </div>
      {showProgress && (
        <div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(r.progress * 100)}%`, background: r.tier.color }} />
          </div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">{r.nextAt === null ? "Top rank reached" : `${r.nextAt - rp} RP to next rank`}</div>
        </div>
      )}
    </div>
  );
}
