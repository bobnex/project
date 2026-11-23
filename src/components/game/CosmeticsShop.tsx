import { useMemo, useState } from "react";
import { Check, Coins, Eye, Gem, ShoppingBag, Sparkles, X, Shirt, Crown, Footprints, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/app-context";
import { EMPTY_WALLET, getCardThemeStyle, type CoinPack, type Cosmetic, type CosmeticSlot, type CosmeticWallet } from "@/lib/cosmetics";
import { buyCosmetic, equipCosmetic, submitTopup, useCosmetics } from "@/lib/cosmetics-store";
import { AVATAR_CATALOG, DEFAULT_AVATAR_CONFIG, RARITY_COLORS, type AvatarCatalogItem } from "@/lib/avatar";
import { ThreeAvatarCanvas } from "@/components/avatar/ThreeAvatarCanvas";
import { cn } from "@/lib/utils";
import { CosmeticAvatar } from "./CosmeticPreview";

export function CosmeticsShop() {
  const { fb, user, profile } = useApp();
  const { settings, wallet, requests, ready, error } = useCosmetics();
  const [category, setCategory] = useState<CosmeticSlot | "avatar" | "all">("all");
  const [avatarCategory, setAvatarCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [preview, setPreview] = useState<Cosmetic | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<AvatarCatalogItem | null>(null);
  const [purchase, setPurchase] = useState<Cosmetic | null>(null);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const ownedList = wallet.owned;
  const equippedMap = wallet.equipped;
  const name = profile?.username || "Player";

  const previewWallet: CosmeticWallet = useMemo(() => {
    if (!preview) return wallet;
    return { ...wallet, equipped: { ...wallet.equipped, [preview.slot]: preview.id } };
  }, [wallet, preview]);

  const filteredItems = useMemo(() => {
    return settings.cosmetics.filter((c) => {
      const matchCat = category === "all" || c.slot === category;
      const matchQuery = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [settings.cosmetics, category, search]);

  const filteredAvatarItems = useMemo(() => {
    return AVATAR_CATALOG.filter((i) => {
      const matchCat = avatarCategory === "all" || i.category === avatarCategory;
      const matchQuery = !search.trim() || i.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [avatarCategory, search]);

  async function action(fn: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7 pb-12">
      <section className="relative border-b pb-7 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-accent flex items-center gap-2 text-xs font-semibold uppercase">
              <Gem className="size-4" /> The Juvora Collection ({settings.cosmetics.length + AVATAR_CATALOG.length} Items)
            </p>
            <h2 className="mt-2 text-3xl font-bold font-display">Make your mark.</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              3D Avatar Gear, Frames, Badges, Profile Card Themes, and Signature Cosmetics.
            </p>
          </div>
          <div className="border-warning/30 bg-warning/10 flex items-center gap-3 rounded-lg border px-4 py-3">
            <Coins className="text-warning size-6" />
            <div>
              <p className="text-muted-foreground text-xs">Juvora coins</p>
              <p className="tabular text-xl font-bold">{wallet.balance.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">{error}</p>}

      <Tabs defaultValue="avatar-shop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="avatar-shop">
            <Sparkles className="size-4 mr-2" /> 3D Avatar Gear
          </TabsTrigger>
          <TabsTrigger value="shop">
            <ShoppingBag className="size-4 mr-2" /> Profile Cosmetics
          </TabsTrigger>
          <TabsTrigger value="closet">
            <Eye className="size-4 mr-2" /> My Locker
          </TabsTrigger>
          <TabsTrigger value="coins">
            <Coins className="size-4 mr-2" /> Coins
          </TabsTrigger>
        </TabsList>

        {/* 3D AVATAR SHOP TAB */}
        <TabsContent value="avatar-shop" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "All Gear" },
                { id: "outfit", label: "Outfits" },
                { id: "hair", label: "Hair" },
                { id: "shoes", label: "Shoes" },
                { id: "headwear", label: "Headwear" },
                { id: "backBling", label: "Wings & Bling" },
                { id: "vfx", label: "Auras" },
              ].map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={avatarCategory === c.id ? "secondary" : "ghost"}
                  onClick={() => setAvatarCategory(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Search avatar gear..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredAvatarItems.map((item) => {
              const rarity = RARITY_COLORS[item.rarity];
              const owned = item.unlockedByDefault || ownedList.includes(item.id);

              return (
                <div
                  key={item.id}
                  className="surface-card flex flex-col justify-between rounded-2xl border border-purple-500/20 p-4 text-center transition-all hover:border-purple-500/50"
                >
                  <div className="flex flex-col items-center w-full">
                    <Badge className={`${rarity.bg} ${rarity.text} ${rarity.border} border text-[9px] uppercase font-bold self-start mb-2`}>
                      {item.rarity}
                    </Badge>
                    <div className="h-16 w-full flex items-center justify-center my-1">
                      {item.category === "outfit" ? (
                        <Shirt className="size-10 text-purple-400" />
                      ) : item.category === "hair" ? (
                        <Crown className="size-10 text-amber-400" />
                      ) : item.category === "shoes" ? (
                        <Footprints className="size-10 text-emerald-400" />
                      ) : (
                        <ShieldCheck className="size-10 text-cyan-400" />
                      )}
                    </div>
                    <div className="font-bold text-sm text-foreground truncate w-full">{item.name}</div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs font-bold text-warning">
                      <Coins className="size-3.5" />
                      <span>{item.priceCoins === 0 ? "Free" : item.priceCoins}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      onClick={() => setAvatarPreview(item)}
                    >
                      3D Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* PROFILE COSMETICS TAB (Preserves all existing Frames, Badges, Titles, Card Themes) */}
        <TabsContent value="shop" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {(["all", "frame", "badge", "effect", "title", "card"] as const).map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "secondary" : "ghost"}
                  onClick={() => setCategory(c)}
                >
                  {c === "all" ? "All Items" : c === "card" ? "Card Themes" : `${c}s`}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Search cosmetics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredItems.map((item) => {
              const owned = ownedList.includes(item.id);
              const isEquipped = equippedMap[item.slot] === item.id;
              const cardStyle = getCardThemeStyle(item);

              return (
                <div
                  key={item.id}
                  className="surface-card flex flex-col justify-between rounded-xl border p-4 text-center transition-all"
                >
                  <div className="flex flex-col items-center w-full">
                    {item.slot === "card" ? (
                      <div
                        className={cn("w-full h-24 rounded-xl p-2.5 flex flex-col items-center justify-center border shadow-sm relative overflow-hidden", `cosmetic-${item.style}`)}
                        style={cardStyle}
                      >
                        <span className="text-[10px] font-bold tracking-wider">{item.name}</span>
                      </div>
                    ) : (
                      <div className="my-2">
                        <CosmeticAvatar name={name} wallet={{ balance: 0, owned: [item.id], equipped: { [item.slot]: item.id } }} size={48} showTitle={item.slot === "title"} />
                      </div>
                    )}
                    <div className="font-semibold text-sm mt-2">{item.name}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-bold text-warning">{item.price} coins</span>
                    {owned ? (
                      <Button
                        size="sm"
                        variant={isEquipped ? "default" : "secondary"}
                        className="text-xs h-7 px-2"
                        onClick={() => action(() => equipCosmetic(fb!.db, user!.uid, item.slot, isEquipped ? undefined : item.id), isEquipped ? "Unequipped" : "Equipped")}
                      >
                        {isEquipped ? "Equipped" : "Equip"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="text-xs h-7 px-2 bg-purple-600"
                        onClick={() => action(() => buyCosmetic(fb!.db, user!.uid, item.id, item.price), `Purchased ${item.name}`)}
                      >
                        Buy
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* COIN TOP-UP TAB (Preserved full bank verification) */}
        <TabsContent value="coins" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {settings.packs.map((p) => (
              <div key={p.id} className="surface-card p-5 rounded-2xl border border-warning/30 flex flex-col justify-between">
                <div>
                  <div className="text-warning font-bold text-lg flex items-center gap-2">
                    <Coins className="size-5" /> {p.name}
                  </div>
                  <div className="text-2xl font-black mt-2">{p.coins.toLocaleString()} Coins</div>
                  <div className="text-sm text-muted-foreground mt-1">₦{p.amount.toLocaleString()}</div>
                </div>
                <Button onClick={() => setPack(p)} className="mt-4 bg-warning text-black hover:bg-warning/90 font-bold">
                  Top Up
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* LOCKER TAB */}
        <TabsContent value="closet" className="space-y-4">
          <p className="text-sm text-muted-foreground">Manage your owned cosmetics and equip them for your profile card.</p>
        </TabsContent>
      </Tabs>

      {/* 3D AVATAR PREVIEW MODAL */}
      <Dialog open={Boolean(avatarPreview)} onOpenChange={() => setAvatarPreview(null)}>
        <DialogContent className="max-w-md bg-black/90 border-purple-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="size-5 text-purple-400" /> {avatarPreview?.name}
            </DialogTitle>
            <DialogDescription>
              {avatarPreview?.description}
            </DialogDescription>
          </DialogHeader>

          {avatarPreview && (
            <div className="my-2">
              <ThreeAvatarCanvas
                customization={{
                  ...DEFAULT_AVATAR_CONFIG,
                  outfitId: avatarPreview.category === "outfit" ? avatarPreview.id : DEFAULT_AVATAR_CONFIG.outfitId,
                  hairStyleId: avatarPreview.category === "hair" ? avatarPreview.id : DEFAULT_AVATAR_CONFIG.hairStyleId,
                  shoesId: avatarPreview.category === "shoes" ? avatarPreview.id : DEFAULT_AVATAR_CONFIG.shoesId,
                  headwearId: avatarPreview.category === "headwear" ? avatarPreview.id : undefined,
                  backBlingId: avatarPreview.category === "backBling" ? avatarPreview.id : undefined,
                  vfxAuraId: avatarPreview.category === "vfx" ? avatarPreview.id : undefined,
                }}
                interactive={true}
                height={340}
              />
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div className="text-sm font-bold text-warning flex items-center gap-1.5">
              <Coins className="size-4" /> {avatarPreview?.priceCoins === 0 ? "Free Default" : `${avatarPreview?.priceCoins} Coins`}
            </div>
            <Button onClick={() => setAvatarPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
