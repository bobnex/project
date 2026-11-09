import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { activeSponsors, pickSponsor, type Sponsor } from "@/lib/payment";
import { cn } from "@/lib/utils";

/** Small, unobtrusive sponsor line that rotates through active sponsors one at a time. */
export function SponsorStrip({ sponsors, dismissible = false, className }: { sponsors: Sponsor[]; dismissible?: boolean; className?: string }) {
  const list = activeSponsors(sponsors);
  const [tick, setTick] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setTick(Math.floor(Math.random() * 1000));
    if (dismissible && sessionStorage.getItem("sponsor-strip-hidden") === "1") setHidden(true);
  }, [dismissible]);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), 8000);
    return () => clearInterval(t);
  }, [list.length]);

  const s = pickSponsor(list, tick);
  if (!s || hidden) return null;

  const body = (
    <>
      {s.logoUrl ? (
        <img src={s.logoUrl} alt="" className="size-7 shrink-0 rounded-md object-contain" loading="lazy" />
      ) : (
        <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold">{s.name[0]}</span>
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">Sponsored by </span>
        <b>{s.name}</b>
        {s.tagline && <span className="text-muted-foreground"> · {s.tagline}</span>}
      </span>
      {s.website && <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />}
    </>
  );

  return (
    <div key={s.id} className={cn("surface-card animate-in fade-in flex items-center gap-2 px-3 py-2 text-xs duration-500", className)}>
      {s.website ? (
        <a href={s.website} target="_blank" rel="noopener noreferrer sponsored" className="flex min-w-0 flex-1 items-center gap-2">{body}</a>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
      )}
      {dismissible && (
        <button type="button" aria-label="Hide sponsor" className="text-muted-foreground hover:text-foreground shrink-0 p-1"
          onClick={() => { sessionStorage.setItem("sponsor-strip-hidden", "1"); setHidden(true); }}>
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
