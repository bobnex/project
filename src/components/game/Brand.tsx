import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("bg-gradient-primary text-primary-foreground shadow-glow grid place-items-center rounded-2xl", className)}
      style={{ width: size, height: size }}
    >
      <Swords style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.4} />
    </div>
  );
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-extrabold tracking-tight", className)}>
      JUVORA
    </span>
  );
}
