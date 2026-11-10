import { useMemo, useState } from "react";
import { Check, Coins, Copy, Eye, Gem, Loader2, Search, ShoppingBag, Sparkles, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CosmeticAvatar } from "./CosmeticPreview";
import { useApp } from "@/lib/app-context";
import { buyCosmetic, equipCosmetic, submitTopup, useCosmetics } from "@/lib/cosmetics-store";
import { EMPTY_WALLET, type CoinPack, type Cosmetic, type CosmeticSlot } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

export function CosmeticsShop() {
  const { fb, user, profile, settings: appSettings } = useApp();
  const { settings, wallet, ready, error, requests } = useCosmetics();
  const [category, setCategory] = useState<CosmeticSlot | "all">("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Cosmetic | null>(null);
  const [purchase, setPurchase] = useState<Cosmetic | null>(null);
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const equippedMap = wallet?.equipped ?? {};
  const ownedList = wallet?.owned ?? [];

  const previewWallet = preview
    ? { ...wallet, equipped: { ...equippedMap, [preview.slot]: preview.id } }
    : wallet;
  const name = profile?.username ?? "Player";

  const filteredItems = useMemo(() => {
    return settings.cosmetics.filter(item => {
      const matchesCategory = category === "all" || item.slot === category;
      const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [settings.cosmetics, category, search]);

  async function action(fn: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      setPurchase(null);
      setPack(null);
      setSender("");
      setReference("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again.");
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
              <Gem className="size-4" /> The Juvora collection (150 Items)
            </p>
            <h2 className="mt-2 text-3xl font-bold">Make your mark.</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Frames, badges, effects, and prestigious titles. Pure cosmetic signature.
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
        {error && <p role="alert" className="text-destructive mt-4 text-sm">{error}</p>}
        {!error && !settings.enabled && (
          <p className="text-warning mt-4 text-sm">
            Collection preview · Purchases open when an admin activates the shop.
          </p>
        )}
      </section>

      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shop"><ShoppingBag className="size-4 mr-2" /> Shop</TabsTrigger>
          <TabsTrigger value="closet"><Sparkles className="size-4 mr-2" /> Customize</TabsTrigger>
          <TabsTrigger value="coins"><Coins className="size-4 mr-2" /> Coins</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cosmetic category">
              {(["all", "frame", "badge", "effect", "title"] as const).map(c => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "secondary" : "ghost"}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                >
                  {c === "all" ? "All (150)" : `${c[0].toUpperCase()}${c.slice(1)}s`}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
              <Input
                placeholder="Search cosmetics..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredItems.map(item => {
              const owned = ownedList.includes(item.id);
              const isEquipped = equippedMap[item.slot] === item.id;
              return (
                <div
                  key={item.id}
                  className="surface-card cosmetic-item flex flex-col justify-between rounded-xl border p-4 text-center transition-all"
                >
                  <div className="flex flex-col items-center">
                    <CosmeticAvatar
                      name={name}
                      wallet={{ ...EMPTY_WALLET, equipped: { [item.slot]: item.id } }}
                      size={48}
                      showTitle={item.slot === "title"}
                    />
                    <h4 className="mt-3 text-sm font-bold line-clamp-1">{item.name}</h4>
                    <p className="text-muted-foreground text-xs uppercase">{item.slot}</p>
                  </div>
                  <div className="mt-4 space-y-2">
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

          {(["frame", "badge", "effect", "title"] as const).map(slot => {
            const ownedInSlot = settings.cosmetics.filter(c => c.slot === slot && ownedList.includes(c.id));
            const activeEquippedId = equippedMap[slot];
            return (
              <section key={slot} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold capitalize">{slot}s</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!ready || busy || !activeEquippedId}
                    onClick={() =>
                      fb &&
                      user &&
                      action(() => equipCosmetic(fb.db, user.uid, slot, undefined), `${slot} unequipped.`)
                    }
                  >
                    <X className="size-3.5 mr-1" /> Unequip {slot}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ownedInSlot.map(c => {
                    const isEquipped = activeEquippedId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "surface-card rounded-lg border p-3 flex flex-col justify-between items-center text-center transition-all",
                          isEquipped && "border-primary shadow-glow"
                        )}
                      >
                        <CosmeticAvatar
                          name={name}
                          wallet={{ ...EMPTY_WALLET, equipped: { [c.slot]: c.id } }}
                          size={44}
                          showTitle={c.slot === "title"}
                        />
                        <span className="font-semibold text-xs mt-2 line-clamp-1">{c.name}</span>
                        <Button
                          size="sm"
                          className="mt-3 w-full text-xs"
                          variant={isEquipped ? "outline" : "default"}
                          disabled={busy || !ready}
                          onClick={() =>
                            fb &&
                            user &&
                            action(
                              () => equipCosmetic(fb.db, user.uid, slot, isEquipped ? undefined : c.id),
                              isEquipped ? `${c.name} unequipped.` : `${c.name} equipped.`
                            )
                          }
                        >
                          {isEquipped ? "Unequip" : "Equip"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {ownedInSlot.length === 0 && (
                  <p className="text-muted-foreground text-xs">No {slot}s unlocked yet.</p>
                )}
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="coins" className="space-y-6">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <Wallet className="text-warning size-5" /> Top up your coins
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Pay by direct bank transfer. Your Juvora coins are credited as soon as an admin approves your payment.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Shop coins are separate from battle reward coins.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
        <DialogContent className="max-w-xs text-center">
          <DialogTitle className="text-lg font-bold">{preview?.name}</DialogTitle>
          <DialogDescription className="text-xs uppercase">{preview?.slot}</DialogDescription>
          <div className="py-6 flex justify-center">
            <CosmeticAvatar name={name} wallet={previewWallet} size={84} showTitle={true} />
          </div>
          <Button onClick={() => setPreview(null)}>Close preview</Button>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={!!purchase} onOpenChange={open => !busy && !open && setPurchase(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Unlock {purchase?.name}?</DialogTitle>
          <DialogDescription>
            This cosmetic costs {purchase?.price.toLocaleString()} Juvora coins and will be added permanently to your account.
          </DialogDescription>
          <p className="text-sm">Balance: {wallet.balance.toLocaleString()} coins</p>
          {purchase && wallet.balance < purchase.price && (
            <p className="text-warning text-sm">You need {(purchase.price - wallet.balance).toLocaleString()} more coins.</p>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" disabled={busy} onClick={() => setPurchase(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !purchase || wallet.balance < (purchase?.price ?? 0)}
              onClick={() =>
                fb &&
                user &&
                purchase &&
                action(() => buyCosmetic(fb.db, user.uid, purchase.id), `Unlocked ${purchase.name}!`)
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : "Confirm purchase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top-Up Payment Transfer Dialog */}
      <Dialog open={!!pack} onOpenChange={open => !busy && !open && setPack(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md">
          <DialogTitle>Buy {pack?.coins.toLocaleString()} coins</DialogTitle>
          <DialogDescription>
            Transfer ₦{pack?.amount.toLocaleString()} and submit your transfer details below for admin verification.
          </DialogDescription>

          <dl className="space-y-2 border-y py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="font-semibold">{appSettings.payment.bank}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Account number</dt>
              <dd className="flex items-center gap-1 font-mono font-bold">
                {appSettings.payment.accountNumber}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy account number"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(appSettings.payment.accountNumber)
                      .then(() => toast.success("Account copied"))
                      .catch(() => toast.error("Please copy manually."))
                  }
                >
                  <Copy className="size-4" />
                </Button>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Account name</dt>
              <dd className="font-semibold">{appSettings.payment.accountName}</dd>
            </div>
          </dl>

          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              if (fb && user && pack) {
                void action(
                  () => submitTopup(fb.db, user.uid, name, pack.id, sender, reference),
                  "Transfer submitted! Coins will be credited once verified by an admin."
                );
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="coin-sender">Sender name</Label>
              <Input
                id="coin-sender"
                required
                maxLength={100}
                placeholder="Name on your bank account"
                value={sender}
                onChange={e => setSender(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coin-reference">Bank transfer reference / Narration</Label>
              <Input
                id="coin-reference"
                required
                maxLength={100}
                placeholder="Session ID, reference code, or narration"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={busy || !ready} type="submit">
              {busy ? <Loader2 className="animate-spin" /> : <Check className="size-4 mr-2" />}
              I’ve paid · Submit payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
