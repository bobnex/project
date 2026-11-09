import { cn } from "@/lib/utils";

/** Generated avatar from the username (no uploads needed). */
export function PlayerAvatar({ name, size = 40, className, ring }: { name: string; size?: number; className?: string; ring?: boolean }) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "bg-gradient-primary text-primary-foreground font-display grid shrink-0 place-items-center rounded-full font-bold",
        ring && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
