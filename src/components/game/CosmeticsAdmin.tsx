import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Check, Coins, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { normalizeEconomy, validPositive, type EconomySettings, type TopupRequest } from "@/lib/cosmetics";
import { reviewTopup, saveEconomy, useCosmetics } from "@/lib/cosmetics-store";

export function CosmeticsAdmin() {
  const { fb, user, isAdmin } = useApp();
  const { settings } = useCosmetics();
  const [draft, setDraft] = useState<EconomySettings>(settings);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    if (!fb || !isAdmin) return;
    return onSnapshot(query(collection(fb.db, "coin_requests"), where("status", "==", "pending")), s => setRequests(s.docs.map(d => ({ ...d.data(), id: d.id }) as TopupRequest).sort((a,b) => a.createdAt - b.createdAt)), () => setError("Coin requests cannot be loaded. Check the Firebase shop rules."));
  }, [fb, isAdmin]);
  async function save() {
    if (!fb || !isAdmin) return;
    if (draft.packs.some(p => !p.name.trim() || !validPositive(p.coins) || !validPositive(p.amount)) || draft.cosmetics.some(c => !validPositive(c.price))) return toast.error("Names are required. Prices and coin amounts must be positive whole numbers.");
    if (draft.enabled && !draft.packs.some(p => p.active)) return toast.error("Publish at least one coin pack before opening the shop.");
    setBusy(true);
    try { await saveEconomy(fb.db, normalizeEconomy(draft)); toast.success("Coin shop settings saved."); } catch { toast.error("Couldn’t save. Check your admin permissions."); } finally { setBusy(false); }
  }
  async function review(r: TopupRequest, approve: boolean) {
    if (!fb || !user || !isAdmin || !window.confirm(approve ? `Confirm receipt of ₦${r.amount.toLocaleString()} from ${r.sender}? This credits ${r.coins} coins to ${r.username}.` : `Reject the transfer from ${r.sender}?`)) return;
    setBusy(true);
    try { await reviewTopup(fb.db, user.uid, r.id, approve); toast.success(approve ? "Transfer approved and coins credited." : "Transfer rejected."); } catch (e) { toast.error(e instanceof Error ? e.message : "Review failed."); } finally { setBusy(false); }
  }
  if (!isAdmin) return null;
  return <div className="space-y-7">
    <section className="space-y-4 border-b pb-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Coins className="text-warning" /> Coin shop</h2><div className="flex items-center justify-between gap-4"><Label htmlFor="shop-enable">Shop open</Label><Switch id="shop-enable" checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })} /></div><p className="text-muted-foreground text-sm">Bank details are shared with registration payments. Only approve transfers you have received.</p></section>
    <section className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold">Coin packs</h3><Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, packs: [...draft.packs, { id: crypto.randomUUID(), name: "", coins: 0, amount: 0, active: true }] })}><Plus /> Add pack</Button></div>
      {draft.packs.length === 0 && <p className="text-muted-foreground text-sm">Set your own coin quantities and naira prices before opening sales.</p>}
      {draft.packs.map((p, i) => <div key={p.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3"><div><Label htmlFor={`pack-name-${i}`}>Pack name</Label><Input id={`pack-name-${i}`} value={p.name} maxLength={60} onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })} /></div>{(["coins", "amount"] as const).map(k => <div key={k}><Label htmlFor={`${k}-${i}`}>{k === "coins" ? "Coins" : "Price (₦)"}</Label><Input id={`${k}-${i}`} type="number" min={1} step={1} value={p[k]} onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, [k]: Number(e.target.value) } : x) })} /></div>)}<div className="flex items-center gap-3"><Switch aria-label={`${p.name || "Pack"} available`} checked={p.active} onCheckedChange={active => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, active } : x) })} /><Button size="icon" variant="ghost" aria-label="Delete coin pack" onClick={() => setDraft({ ...draft, packs: draft.packs.filter(x => x.id !== p.id) })}><Trash2 /></Button></div></div>)}
    </section>
    <section className="space-y-3"><h3 className="font-bold">Cosmetic prices</h3><div className="grid gap-3 sm:grid-cols-2">{draft.cosmetics.map(c => <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3"><Label className="flex-1" htmlFor={`price-${c.id}`}>{c.name}<span className="text-muted-foreground block text-xs">{c.slot}</span></Label><Input className="w-24" id={`price-${c.id}`} type="number" min={1} step={1} value={c.price} onChange={e => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => x.id === c.id ? { ...x, price: Number(e.target.value) } : x) })} /><Switch aria-label={`${c.name} available`} checked={c.active} onCheckedChange={active => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => x.id === c.id ? { ...x, active } : x) })} /></div>)}</div><Button disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Save shop settings</Button></section>
    <section className="space-y-4 border-t pt-6"><h3 className="font-bold">Pending coin transfers ({requests.length})</h3>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}{!error && requests.length === 0 && <p className="text-muted-foreground text-sm">No transfers awaiting approval.</p>}{requests.map(r => <article className="space-y-3 rounded-lg border p-4" key={r.id}><div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{r.username}</h4><p className="text-warning text-sm font-semibold">₦{r.amount.toLocaleString()} → {r.coins.toLocaleString()} coins</p></div><dl className="text-sm"><dt className="text-muted-foreground">Sender</dt><dd>{r.sender}</dd><dt className="text-muted-foreground mt-2">Transfer reference</dt><dd className="break-all">{r.reference}</dd></dl><div className="flex gap-2"><Button disabled={busy} onClick={() => review(r, true)}><Check /> Approve</Button><Button variant="outline" disabled={busy} onClick={() => review(r, false)}><X /> Reject</Button></div></article>)}</section>
  </div>;
}