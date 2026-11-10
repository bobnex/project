import { useState } from "react";
import { Check, Coins, Copy, Crown, Eye, Gem, Loader2, ShoppingBag, Sparkles, Wallet, X } from "lucide-react";
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
  const [preview, setPreview] = useState<Cosmetic | null>(null);
  const [purchase, setPurchase] = useState<Cosmetic | null>(null);
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<void>, message: string) {
    setBusy(true);
    try { await fn(); toast.success(message); setPurchase(null); setPack(null); setSender(""); setReference(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const previewWallet = preview ? { ...wallet, equipped: { ...wallet.equipped, [preview.slot]: preview.id } } : wallet;
  const name = profile?.username ?? "Player";
  return <div className="space-y-7">
    <section className="relative border-b pb-7 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-accent flex items-center gap-2 text-xs font-semibold uppercase"><Gem className="size-4" /> The Juvora collection</p><h2 className="mt-2 text-3xl font-bold">Make your mark.</h2><p className="text-muted-foreground mt-2 text-sm">Your style. Your signature. No competitive advantage.</p></div>
        <div className="border-warning/30 bg-warning/10 flex items-center gap-3 rounded-lg border px-4 py-3"><Coins className="text-warning size-6" /><div><p className="text-muted-foreground text-xs">Juvora coins</p><p className="tabular text-xl font-bold">{wallet.balance.toLocaleString()}</p></div></div>
      </div>
      {error && <p role="alert" className="text-destructive mt-4 text-sm">{error}</p>}
      {!error && !settings.enabled && <p className="text-warning mt-4 text-sm">Collection preview · Purchases open when an admin activates the shop.</p>}
    </section>
    <Tabs defaultValue="shop" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="shop"><ShoppingBag className="size-4" /> Shop</TabsTrigger><TabsTrigger value="closet"><Sparkles className="size-4" /> Customize</TabsTrigger><TabsTrigger value="coins"><Coins className="size-4" /> Coins</TabsTrigger></TabsList>
      <TabsContent value="shop" className="space-y-5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Cosmetic category">{(["all", "frame", "badge", "effect"] as const).map(c => <Button key={c} size="sm" variant={category === c ? "secondary" : "ghost"} onClick={() => setCategory(c)} aria-pressed={category === c}>{c === "all" ? "All items" : `${c[0].toUpperCase()}${c.slice(1)}s`}</Button>)}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{settings.cosmetics.filter(c => c.active && (category === "all" || category === c.slot)).map(item => {
          const owned = wallet.owned.includes(item.id);
          return <article key={item.id} className="cosmetic-item overflow-hidden rounded-lg border bg-card">
            <div className={cn("cosmetic-stage grid h-40 place-items-center border-b", `cosmetic-tone-${item.style}`)}><CosmeticAvatar name={name} wallet={{ ...EMPTY_WALLET, equipped: { [item.slot]: item.id } }} size={62} /></div>
            <div className="space-y-3 p-3"><div><p className="text-muted-foreground text-[10px] uppercase">{item.slot}</p><h3 className="mt-1 text-sm font-bold">{item.name}</h3></div><p className="text-warning tabular flex items-center gap-1 text-sm font-semibold"><Coins className="size-4" />{item.price.toLocaleString()}</p>
              <div className="flex gap-1"><Button variant="outline" size="icon" aria-label={`Preview ${item.name}`} title={`Preview ${item.name}`} onClick={() => setPreview(item)}><Eye /></Button><Button className="min-w-0 flex-1 px-2 text-xs" disabled={owned || !ready || !settings.enabled || busy} onClick={() => setPurchase(item)}>{owned ? <><Check /> Owned</> : "Buy"}</Button></div>
            </div>
          </article>;
        })}</div>
      </TabsContent>
      <TabsContent value="closet" className="space-y-6">
        <div className="flex flex-col items-center gap-4 border-b py-6"><CosmeticAvatar name={name} wallet={previewWallet} size={96} /><div className="text-center"><h3 className="text-xl font-bold">{name}</h3><p className="text-muted-foreground mt-1 text-xs">{preview ? `Previewing ${preview.name}` : "Your equipped look"}</p></div>{preview && <Button variant="ghost" size="sm" onClick={() => setPreview(null)}><X /> Clear preview</Button>}</div>
        {(["frame", "badge", "effect"] as const).map(slot => <section key={slot} className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold capitalize">{slot}s</h3><Button variant="ghost" size="sm" disabled={!ready || busy || !wallet.equipped[slot]} onClick={() => fb && user && action(() => equipCosmetic(fb.db, user.uid, slot), "Cosmetic removed.")}><X /> Remove</Button></div>
          <div className="flex flex-wrap gap-2">{settings.cosmetics.filter(c => c.slot === slot && wallet.owned.includes(c.id)).map(c => <Button key={c.id} variant={wallet.equipped[slot] === c.id ? "default" : "outline"} disabled={busy || !ready} onClick={() => fb && user && action(() => equipCosmetic(fb.db, user.uid, slot, c.id), `${c.name} equipped.`)}>{wallet.equipped[slot] === c.id && <Check />}{c.name}</Button>)}{!settings.cosmetics.some(c => c.slot === slot && wallet.owned.includes(c.id)) && <p className="text-muted-foreground text-sm">No {slot}s collected yet.</p>}</div>
        </section>)}
      </TabsContent>
      <TabsContent value="coins" className="space-y-6">
        <div><h3 className="flex items-center gap-2 text-xl font-bold"><Wallet className="text-warning size-5" /> Top up your coins</h3><p className="text-muted-foreground mt-2 text-sm">Pay by bank transfer. Coins arrive after an admin confirms your payment.</p><p className="text-muted-foreground mt-1 text-xs">Shop coins are separate from battle reward coins.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{settings.packs.filter(p => p.active).map(p => <article className="rounded-lg border bg-card p-5" key={p.id}><Coins className="text-warning mb-3 size-8" /><h3 className="text-sm font-bold">{p.name}</h3><p className="tabular mt-2 text-2xl font-bold">{p.coins.toLocaleString()} <span className="text-muted-foreground text-xs">coins</span></p><p className="mt-2 text-sm">₦{p.amount.toLocaleString()}</p><Button className="mt-4 w-full" disabled={!ready || !settings.enabled || busy} onClick={() => setPack(p)}>Select pack</Button></article>)}</div>
        {!settings.packs.some(p => p.active) && <p className="text-muted-foreground border-y py-6 text-sm">Coin packs haven’t been published yet.</p>}
        <section className="space-y-3"><h3 className="text-sm font-bold">Your transfers</h3>{requests.length === 0 && <p className="text-muted-foreground text-sm">No transfers submitted.</p>}{requests.map(r => <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="text-sm font-semibold">{r.coins.toLocaleString()} coins · ₦{r.amount.toLocaleString()}</p><p className="text-muted-foreground truncate text-xs">{r.reference}</p></div><span className={cn("text-xs font-semibold capitalize", r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning")}>{r.status}</span></div>)}</section>
      </TabsContent>
    </Tabs>
    <Dialog open={!!preview} onOpenChange={open => !open && setPreview(null)}><DialogContent><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>Cosmetic preview · {preview?.slot}</DialogDescription><div className="grid min-h-48 place-items-center"><CosmeticAvatar name={name} wallet={previewWallet} size={110} /></div><Button variant="outline" onClick={() => setPreview(null)}>Done</Button></DialogContent></Dialog>
    <Dialog open={!!purchase} onOpenChange={open => !busy && !open && setPurchase(null)}><DialogContent><DialogTitle>Collect {purchase?.name}?</DialogTitle><DialogDescription>Spend {purchase?.price.toLocaleString()} Juvora coins. This item is permanently added to your collection.</DialogDescription><p className="text-sm">Balance: {wallet.balance.toLocaleString()} coins</p>{purchase && wallet.balance < purchase.price && <p className="text-warning text-sm">You need {(purchase.price - wallet.balance).toLocaleString()} more coins.</p>}<Button disabled={busy || !purchase || wallet.balance < (purchase?.price ?? 0)} onClick={() => fb && user && purchase && action(() => buyCosmetic(fb.db, user.uid, purchase.id), "Added to your collection!")} >{busy ? <Loader2 className="animate-spin" /> : <Gem />}Confirm purchase</Button></DialogContent></Dialog>
    <Dialog open={!!pack} onOpenChange={open => !busy && !open && setPack(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Buy {pack?.coins.toLocaleString()} coins</DialogTitle><DialogDescription>Transfer ₦{pack?.amount.toLocaleString()} and submit the payment details for admin review.</DialogDescription><dl className="space-y-2 border-y py-3 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Bank</dt><dd>{appSettings.payment.bank}</dd></div><div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Account</dt><dd className="flex items-center gap-1">{appSettings.payment.accountNumber}<Button size="icon" variant="ghost" aria-label="Copy account number" onClick={() => navigator.clipboard.writeText(appSettings.payment.accountNumber).then(() => toast.success("Account copied")).catch(() => toast.error("Please copy the account number manually."))}><Copy /></Button></dd></div><div><dt className="text-muted-foreground">Account name</dt><dd>{appSettings.payment.accountName}</dd></div></dl><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (fb && user && pack) void action(() => submitTopup(fb.db, user.uid, name, pack.id, sender, reference), "Transfer submitted. Awaiting admin approval."); }}><div className="space-y-2"><Label htmlFor="coin-sender">Sender name</Label><Input id="coin-sender" required maxLength={100} value={sender} onChange={e => setSender(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="coin-reference">Bank transfer reference</Label><Input id="coin-reference" required maxLength={100} value={reference} onChange={e => setReference(e.target.value)} /></div><Button className="w-full" disabled={busy || !ready} type="submit">{busy ? <Loader2 className="animate-spin" /> : <Check />}I’ve paid · Submit</Button></form></DialogContent></Dialog>
  </div>;
}