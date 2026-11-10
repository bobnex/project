import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Check, Coins, Loader2, Plus, Search, Trash2, X } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  useEffect(() => {
    if (!fb || !isAdmin) return;
    return onSnapshot(
      query(collection(fb.db, "coin_requests"), where("status", "==", "pending")),
      s => setRequests(s.docs.map(d => ({ ...d.data(), id: d.id }) as TopupRequest).sort((a, b) => a.createdAt - b.createdAt)),
      () => setError("Coin requests cannot be loaded.")
    );
  }, [fb, isAdmin]);

  const visibleCosmetics = useMemo(() => {
    return draft.cosmetics.filter(c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || c.slot.toLowerCase().includes(search.toLowerCase()));
  }, [draft.cosmetics, search]);

  async function save() {
    if (!fb || !isAdmin) return;
    if (draft.packs.some(p => !p.name.trim() || !validPositive(p.coins) || !validPositive(p.amount)) || draft.cosmetics.some(c => !validPositive(c.price))) {
      return toast.error("Names are required. Prices and coin amounts must be positive numbers.");
    }
    if (draft.enabled && !draft.packs.some(p => p.active)) return toast.error("Publish at least one coin pack before opening shop.");
    setBusy(true);
    try {
      await saveEconomy(fb.db, normalizeEconomy(draft));
      toast.success("Coin shop settings saved.");
    } catch {
      toast.error("Couldn't save. Check permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function review(r: TopupRequest, approve: boolean) {
    if (!fb || !user || !isAdmin || !window.confirm(approve ? `Confirm receipt of ₦${r.amount.toLocaleString()} from ${r.sender}? Credits ${r.coins} coins.` : `Reject transfer?`)) return;
    setBusy(true);
    try {
      await reviewTopup(fb.db, user.uid, r.id, approve);
      toast.success(approve ? "Transfer approved." : "Transfer rejected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-7">
      <section className="space-y-4 border-b pb-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Coins className="text-warning" /> Coin shop administration</h2>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="shop-enable">Shop open to players</Label>
          <Switch id="shop-enable" checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Coin Packs</h3>
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, packs: [...draft.packs, { id: crypto.randomUUID(), name: "", coins: 0, amount: 0, active: true }] })}>
            <Plus className="size-4 mr-1" /> Add Pack
          </Button>
        </div>
        {draft.packs.map((p, i) => (
          <div key={p.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div>
              <Label htmlFor={`p-name-${i}`}>Pack Name</Label>
              <Input id={`p-name-${i}`} value={p.name} onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })} />
            </div>
            <div>
              <Label htmlFor={`p-coins-${i}`}>Coins</Label>
              <Input id={`p-coins-${i}`} type="number" value={p.coins} onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, coins: Number(e.target.value) } : x) })} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor={`p-amount-${i}`}>Price (₦)</Label>
                <Input id={`p-amount-${i}`} type="number" value={p.amount} onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => x.id === p.id ? { ...x, amount: Number(e.target.value) } : x) })} />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, packs: draft.packs.filter(x => x.id !== p.id) })}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-bold">Manage 150 Cosmetics Prices & Availability</h3>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input placeholder="Filter items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 sm:grid-cols-2">
          {visibleCosmetics.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <span className="text-muted-foreground text-xs uppercase">{c.slot} · {c.style}</span>
              </div>
              <Input
                className="w-24 text-right"
                type="number"
                min={1}
                value={c.price}
                onChange={e => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => x.id === c.id ? { ...x, price: Number(e.target.value) } : x) })}
              />
              <Switch
                checked={c.active}
                onCheckedChange={active => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => x.id === c.id ? { ...x, active } : x) })}
              />
            </div>
          ))}
        </div>

        <Button disabled={busy} onClick={save}>
          {busy ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />} Save shop settings
        </Button>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h3 className="font-bold">Pending Coin Transfers ({requests.length})</h3>
        {requests.map(r => (
          <article className="space-y-3 rounded-lg border p-4" key={r.id}>
            <div className="flex justify-between">
              <h4 className="font-bold">{r.username}</h4>
              <p className="text-warning font-semibold">₦{r.amount.toLocaleString()} → {r.coins.toLocaleString()} coins</p>
            </div>
            <p className="text-xs text-muted-foreground">Sender: {r.sender} | Ref: {r.reference}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(r, true)}><Check className="size-4 mr-1" /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(r, false)}><X className="size-4 mr-1" /> Reject</Button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
