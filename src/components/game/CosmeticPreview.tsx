import { Crown, Zap } from "lucide-react";
import { PlayerAvatar } from "./Avatar";
import { DEFAULT_COSMETICS, type CosmeticWallet } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

export function CosmeticAvatar({ name, wallet, size = 72 }: { name: string; wallet: CosmeticWallet; size?: number }) {
  const frame = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.frame);
  const badge = DEFAULT_COSMETICS.find(c => c.id === wallet.equipped.badge);
  const effect = wallet.equipped.effect === "halo";
  return <div className={cn("cosmetic-avatar relative inline-flex shrink-0 items-center justify-center rounded-full p-2", frame && `cosmetic-frame-${frame.style}`, effect && "cosmetic-halo")}>
    <PlayerAvatar name={name} size={size} />
    {badge && <span className={cn("cosmetic-badge absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-background", `cosmetic-tone-${badge.style}`)}>{badge.id === "crown" ? <Crown className="size-4" /> : <Zap className="size-4" />}</span>}
  </div>;
}