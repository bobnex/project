import * as LucideIcons from "lucide-react";
import { Crown } from "lucide-react";
import { PlayerAvatar } from "./Avatar";
import { DEFAULT_COSMETICS, type CosmeticWallet } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

function resolveIcon(name?: string) {
  if (!name) return Crown;
  const match = (LucideIcons as Record<string, unknown>)[name];
  return typeof match === "function" ? (match as React.ComponentType<{ className?: string }>) : Crown;
}

export function CosmeticAvatar({
  name,
  wallet,
  size = 72,
  showTitle = false,
}: {
  name: string;
  wallet: CosmeticWallet;
  size?: number;
  showTitle?: boolean;
}) {
  const frame = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.frame);
  const badge = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.badge);
  const effect = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.effect);
  const title = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.title);

  const BadgeIcon = resolveIcon(badge?.iconName);

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "cosmetic-avatar relative inline-flex shrink-0 items-center justify-center rounded-full p-2.5 transition-transform duration-300",
          frame && `cosmetic-frame-${frame.style}`,
          effect && `cosmetic-effect-${effect.style}`
        )}
      >
        <PlayerAvatar name={name} size={size} />
        {badge && (
          <span
            className={cn(
              "cosmetic-badge absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-background shadow-md",
              `cosmetic-tone-${badge.style}`
            )}
            title={badge.name}
          >
            <BadgeIcon className="size-3.5" />
          </span>
        )}
      </div>
      {showTitle && title && (
        <span className={cn("text-xs font-semibold tracking-wide", `cosmetic-text-${title.style}`)}>
          « {title.name} »
        </span>
      )}
    </div>
  );
}
