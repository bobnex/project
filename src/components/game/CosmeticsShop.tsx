import { useMemo, useState } from "react";
import { Check, Coins, Crown, Eye, Gem, ShoppingBag, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/app-context";
import { EMPTY_WALLET, getCardThemeStyle, type CoinPack, type Cosmetic, type CosmeticSlot, type CosmeticWallet } from "@/lib/cosmetics";
import { buyCosmetic, equipCosmetic, submitTopup, useCosmetics } from "@/lib/cosmetics-store";
import { cn } from "@/lib/utils";
import { CosmeticAvatar } from "./CosmeticPreview";

export function CosmeticsShop() {
  const { fb, user, profile } = useApp();
  const { settings, wallet, requests, ready, error } = useCosmetics();
  const [category, setCategory] = useState<CosmeticSlot | "all">("all");
  const [search, setSearch] = useState("");
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [preview, setPreview] = useState<Cosmetic | null>(null);
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
    return settings.cosmetics.filter(c => {
      const matchCat = category === "all" || c.slot === category;
      const matchQuery = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [settings.cosmetics, category, search]);

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
              <Gem className="size-4" /> The Juvora Collection ({settings.cosmetics.length} Items)
            </p>
            <h2 className="mt-2 text-3xl font-bold">Make your mark.</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Frames, badges, effects, profile card themes, and prestigious titles. Pure cosmetic signature.
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

      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shop">
            <ShoppingBag className="size-4 mr-2" /> Shop
          </TabsTrigger>
          <TabsTrigger value="closet">
            <Sparkles className="size-4 mr-2" /> Customize
          </TabsTrigger>
          <TabsTrigger value="coins">
            <Coins className="size-4 mr-2" /> Coins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cosmetic category">
              {(["all", "frame", "badge", "effect", "title", "card"] as const).map(c => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "secondary" : "ghost"}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                >
                  {c === "all" ? "All Items" : c === "card" ? "Card Themes" : `${c}s`}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Search cosmetics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredItems.map(item => {
              const owned = ownedList.includes(item.id);
              const isEquipped = equippedMap[item.slot] === item.id;
              const cardStyle = getCardThemeStyle(item);

              return (
                <div
                  key={item.id}
                  className="surface-card cosmetic-item flex flex-col justify-between rounded-xl border p-4 text-center transition-all"
                >
                  <div className="flex flex-col items-center w-full">
                    {item.slot === "card" ? (
                      <div
                        className={cn(
                          "w-full h-24 rounded-xl p-2.5 flex flex-col items-center justify-center border shadow-sm transition-all relative overflow-hidden",
                          `cosmetic-${item.style}`
                        )}
                        style={cardStyle}
                      >
                        {item.cardDesign?.badgeText && (
                          <span
                            className="absolute top-1 right-1 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full"
                            style={{
                              backgroundColor: item.cardDesign.badgeBg || "rgba(212, 175, 55, 0.9)",
                              color: item.cardDesign.badgeColor || "#000",
                            }}
                          >
                            {item.cardDesign.badgeText}
                          </span>
                        )}
                        <CosmeticAvatar name={name} wallet={wallet} size={32} />
                        <span className="text-xs font-bold mt-1.5 line-clamp-1">{name}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Crown className="size-3 text-warning" /> Level {profile?.level ?? 1}
                        </span>
                      </div>
                    ) : (
                      <CosmeticAvatar
                        name={name}
                        wallet={{ ...EMPTY_WALLET, equipped: { [item.slot]: item.id } }}
                        size={48}
                        showTitle={item.slot === "title"}
                      />
                    )}
                    <h4 className="mt-3 text-sm font-bold line-clamp-1">{item.name}</h4>
                    <p className="text-muted-foreground text-xs uppercase">
                      {item.slot === "card" ? "Card Theme" : item.slot}
                    </p>
                  </div>
                  <div className="mt-4 space-y-2 w-full">
                    <div className="text-warning flex items-center justify-center gap-1 font-semibold text-xs">
                      <Coins className="size-3.5" /> {item.price.toLocaleString()}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setPreview(item)}>
                        <Eye className="size-3.5 mr-1" /> Look
                      </Button>
                      <Button
                        size="sm"
                        disabled={owned || !settings.enabled || wallet.balance < item.price || busy}
                        variant={owned ? "secondary" : "default"}
                        className="flex-1 text-xs"
                        onClick={() => setPurchase(item)}
                      >
                        {owned ? (isEquipped ? "Equipped" : "Owned") : "Buy"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredItems.length === 0 && (
            <p className="text-muted-foreground text-center py-12 text-sm">No cosmetics found matching your query.</p>
          )}
        </TabsContent>

        <TabsContent value="closet" className="space-y-6">
          <div className="surface-card flex flex-col items-center justify-center rounded-2xl border p-8 text-center">
            <CosmeticAvatar name={name} wallet={previewWallet} size={96} showTitle={true} />
            <h3 className="mt-4 text-xl font-bold">{name}</h3>
            <p className="text-muted-foreground text-sm">
              {preview ? `Previewing ${preview.name}` : "Your active game signature"}
            </p>
            {preview && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPreview(null)}>
                <X className="size-4 mr-1" /> Clear preview
              </Button>
            )}
          </div>

          {(["frame", "badge", "effect", "title", "card"] as const).map(slot => {
            const ownedInSlot = settings.cosmetics.filter(c => c.slot === slot && ownedList.includes(c.id));
            const activeEquippedId = equippedMap[slot];
            const slotTitle = slot === "card" ? "Profile Card Themes" : `${slot}s`;
            return (
              <section key={slot} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold capitalize">{slotTitle}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!ready || busy || !activeEquippedId}
                    onClick={() =>
                      fb &&
                      user &&
                      action(() => equipCosmetic(fb.db, user.uid, slot, undefined), `${slot === "card" ? "Card theme" : slot} unequipped.`)
                    }
                  >
                    <X className="size-3.5 mr-1" /> Unequip {slot === "card" ? "theme" : slot}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ownedInSlot.map(item => {
                    const isEquipped = activeEquippedId === item.id;
                    return (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={isEquipped ? "default" : "outline"}
                        disabled={!ready || busy}
                        onClick={() =>
                          fb &&
                          user &&
                          action(() => equipCosmetic(fb.db, user.uid, slot, item.id), `${item.name} equipped.`)
                        }
                      >
                        {isEquipped && <Check className="size-3.5 mr-1" />}
                        {item.name}
                      </Button>
                    );
                  })}
                  {ownedInSlot.length === 0 && (
                    <p className="text-muted-foreground text-xs py-2">
                      No {slotTitle.toLowerCase()} owned yet. Visit the Shop tab to unlock!
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="coins" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {settings.packs.filter(p => p.active).map(p => (
              <div key={p.id} className="surface-card flex flex-col justify-between rounded-xl border p-5">
                <div>
                  <h4 className="font-bold text-lg">{p.name}</h4>
                  <div className="text-warning flex items-center gap-1.5 text-2xl font-black mt-2">
                    <Coins className="size-6" /> {p.coins.toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">₦{p.amount.toLocaleString()}</p>
                </div>
                <Button className="mt-5 w-full" disabled={!ready || !settings.enabled || busy} onClick={() => setPack(p)}>
                  Top up now
                </Button>
              </div>
            ))}
          </div>
          {!settings.packs.some(p => p.active) && (
            <p className="text-muted-foreground border-y py-6 text-sm">Coin packs haven’t been published yet.</p>
          )}

          <section className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-bold">Your transfer history</h3>
            {requests.length === 0 && (
              <p className="text-muted-foreground text-sm">No transfer requests submitted yet.</p>
            )}
            {requests.map(r => (
              <div key={r.id} className="surface-card flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {r.coins.toLocaleString()} coins · ₦{r.amount.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{r.reference}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold capitalize",
                    r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning"
                  )}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </section>
        </TabsContent>
      </Tabs>

      {/* Look / Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogTitle className="text-lg font-bold">{preview?.name}</DialogTitle>
          <DialogDescription className="text-xs uppercase">
            {preview?.slot === "card" ? "Profile Card Theme" : preview?.slot}
          </DialogDescription>
          <div className="py-6 flex justify-center w-full">
            {preview?.slot === "card" ? (
              <div
                className={cn(
                  "hero-card w-full flex flex-col items-center p-6 text-center rounded-2xl transition-all relative overflow-hidden",
                  `cosmetic-${preview.style}`
                )}
                style={getCardThemeStyle(preview)}
              >
                {preview.cardDesign?.badgeText && (
                  <span
                    className="absolute top-2.5 right-2.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: preview.cardDesign.badgeBg || "rgba(212, 175, 55, 0.9)",
                      color: preview.cardDesign.badgeColor || "#000",
                    }}
                  >
                    {preview.cardDesign.badgeText}
                  </span>
                )}
                <CosmeticAvatar name={name} wallet={wallet} size={72} showTitle={true} />
                <h3 className="mt-3 text-xl font-extrabold">{name}</h3>
                <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                  <Crown className="text-warning size-3.5" /> Level {profile?.level ?? 1}
                </div>
                <p className="mt-3 text-xs opacity-75 italic line-clamp-2">
                  {preview.cardDesign?.description || "Hero card theme for your player profile."}
                </p>
              </div>
            ) : (
              <CosmeticAvatar
                name={name}
                wallet={{ ...EMPTY_WALLET, equipped: { [preview?.slot || "frame"]: preview?.id } }}
                size={84}
                showTitle={preview?.slot === "title"}
              />
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>
              Close
            </Button>
            {preview && !ownedList.includes(preview.id) && (
              <Button
                className="flex-1"
                disabled={wallet.balance < preview.price}
                onClick={() => {
                  const itemToBuy = preview;
                  setPreview(null);
                  setPurchase(itemToBuy);
                }}
              >
                Buy for {preview.price.toLocaleString()} coins
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={!!purchase} onOpenChange={open => !open && setPurchase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock {purchase?.name}</DialogTitle>
            <DialogDescription>
              Spend {purchase?.price.toLocaleString()} Juvora coins to unlock this cosmetic for your signature.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-xs">Your balance after purchase</p>
            <p className="text-warning text-2xl font-black mt-1">
              {((wallet.balance || 0) - (purchase?.price || 0)).toLocaleString()} coins
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPurchase(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !purchase}
              onClick={() => {
                if (!fb || !user || !purchase) return;
                action(async () => {
                  await buyCosmetic(fb.db, user.uid, purchase.id);
                  setPurchase(null);
                }, `Unlocked ${purchase.name}! Equip it in the Customize tab.`);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coin Pack Topup Dialog */}
      <Dialog open={!!pack} onOpenChange={open => !open && setPack(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Top up {pack?.name}</DialogTitle>
            <DialogDescription>
              Transfer exactly ₦{pack?.amount.toLocaleString()} to our account, then submit your payment reference for admin confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground">Bank Payment Instructions:</p>
              <p>Account: Juvora Global / First Bank (0123456789)</p>
              <p>Amount: ₦{pack?.amount.toLocaleString()} (for {pack?.coins.toLocaleString()} coins)</p>
            </div>
            <div>
              <Label htmlFor="sender-name">Your Bank Account Name</Label>
              <Input
                id="sender-name"
                placeholder="e.g. Daniel Balogun"
                value={sender}
                onChange={e => setSender(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="payment-ref">Transfer Reference / Narration</Label>
              <Input
                id="payment-ref"
                placeholder="e.g. JUV-829104"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPack(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !sender.trim() || !reference.trim() || !pack}
              onClick={() => {
                if (!fb || !user || !pack) return;
                action(async () => {
                  await submitTopup(fb.db, user.uid, name, pack.id, sender, reference);
                  setPack(null);
                  setSender("");
                  setReference("");
                }, "Transfer submitted! Coins will be credited once confirmed.");
              }}
            >
              Submit transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
