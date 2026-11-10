import { useMemo, useState } from "react";
import { Check, Coins, Copy, Eye, Gem, Loader2, Search, ShoppingBag, Sparkles, Tag } from "lucide-react";
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
  const { settings, wallet, error, requests } = useCosmetics();
  const [category, setCategory] = useState<CosmeticSlot | "all">("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Cosmetic | null>(null);
  const [purchase, setPurchase] = useState<Cosmetic | null>(null);
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const previewWallet = preview ? { ...wallet, equipped: { ...wallet.equipped, [preview.slot]: preview.id } } : wallet;
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
            <p className="text-muted-foreground mt-2 text-sm">Frames, badges, effects, and prestigious titles.</p>
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
          <p className="text-warning mt-4 text-sm">Collection preview · Purchases open when an admin activates the shop.</p>
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
              const owned = wallet.owned.includes(item.id);
              const equipped = wallet.equipped[item.slot] === item.id;
              return (
                <div
                  key={item.id}
                  className="surface-card cosmetic-item flex flex-col justify-between rounded-xl border p-4 text-center transition-all"
                >
                  <div className="flex flex-col items-center">
                    <CosmeticAvatar name={name} wallet={{ ...EMPTY_WALLET, equipped: { [item.slot]: item.id } }} size={48} showTitle={item.slot === "title"} />
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
                        disabled={owned || !settings.enabled || wallet.balance < item.price}
                        variant={owned ? "secondary" : "default"}
                        className="flex-1 text-xs"
                        onClick={() => setPurchase(item)}
                      >
                        {owned ? (equipped ? "Equipped" : "Owned") : "Buy"}
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
            <CosmeticAvatar name={name} wallet={wallet} size={96} showTitle={true} />
            <h3 className="mt-4 text-xl font-bold">{name}</h3>
            <p className="text-muted-foreground text-sm">Your active game signature</p>
          </div>
          <div className="space-y-4">
            <h3 className="font-bold">Your Owned Closet ({wallet.owned.length})</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {settings.cosmetics.filter(c => wallet.owned.includes(c.id)).map(item => {
                const isEquipped = wallet.equipped[item.slot] === item.id;
                return (
                  <div key={item.id} className="surface-card rounded-lg border p-3 flex flex-col justify-between items-center text-center">
                    <CosmeticAvatar name={name} wallet={{ ...EMPTY_WALLET, equipped: { [item.slot]: item.id } }} size={44} showTitle={item.slot === "title"} />
                    <span className="font-semibold text-xs mt-2 line-clamp-1">{item.name}</span>
                    <Button
                      size="sm"
                      className="mt-3 w-full text-xs"
                      variant={isEquipped ? "outline" : "default"}
                      disabled={busy}
                      onClick={() => fb && user && action(() => equipCosmetic(fb.db, user.uid, item.slot, isEquipped ? undefined : item), isEquipped ? "Unequipped" : "Equipped")}
                    >
                      {isEquipped ? "Unequip" : "Equip"}
                    </Button>
                  </div>
                );
              })}
            </div>
            {wallet.owned.length === 0 && (
              <p className="text-muted-foreground text-sm">You haven't purchased any cosmetics yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coins" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {settings.packs.map(p => (
              <div key={p.id} className="surface-card flex flex-col justify-between rounded-xl border p-5">
                <div>
                  <h4 className="font-bold text-lg">{p.name}</h4>
                  <div className="text-warning flex items-center gap-1.5 text-2xl font-black mt-2">
                    <Coins className="size-6" /> {p.coins.toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">₦{p.amount.toLocaleString()}</p>
                </div>
                <Button className="mt-5 w-full" onClick={() => setPack(p)}>Top up now</Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
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

      {/* Purchase Confirmation */}
      <Dialog open={!!purchase} onOpenChange={open => !open && setPurchase(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Unlock {purchase?.name}?</DialogTitle>
          <DialogDescription>
            This cosmetic costs {purchase?.price.toLocaleString()} Juvora coins and will be added permanently to your account.
          </DialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" onClick={() => setPurchase(null)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={() => fb && user && purchase && action(() => buyCosmetic(fb.db, user.uid, purchase), `Unlocked ${purchase.name}!`)}
            >
              {busy ? <Loader2 className="animate-spin" /> : "Confirm purchase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
