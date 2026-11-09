import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, icon: Icon, action, children, className }: { title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {Icon && <Icon className="size-4 text-primary" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, icon: Icon, tone = "primary" }: { label: string; value: ReactNode; icon: LucideIcon; tone?: "primary" | "accent" | "success" | "destructive" | "warning" }) {
  const tones = {
    primary: "text-primary bg-primary/12",
    accent: "text-accent bg-accent/12",
    success: "text-success bg-success/12",
    destructive: "text-destructive bg-destructive/12",
    warning: "text-warning bg-warning/12",
  };
  return (
    <div className="surface-card flex items-center gap-3 p-3">
      <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="tabular font-display text-lg leading-tight font-bold">{value}</div>
        <div className="text-muted-foreground truncate text-xs">{label}</div>
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="surface-card flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-2xl">
        <Icon className="size-5" />
      </div>
      <div className="font-semibold">{title}</div>
      {text && <p className="text-muted-foreground max-w-xs text-sm">{text}</p>}
      {children}
    </div>
  );
}

export function FullLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="text-primary size-7 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
