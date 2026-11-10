import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  CalendarDays,
  Check,
  Coins,
  Crown,
  Edit2,
  Flame,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import {
  CARD_PRESET_TEMPLATES,
  getCardThemeStyle,
  normalizeEconomy,
  validPositive,
  type CardThemeDesign,
  type Cosmetic,
  type EconomySettings,
  type TopupRequest,
} from "@/lib/cosmetics";
import { reviewTopup, saveEconomy, useCosmetics } from "@/lib/cosmetics-store";
import { CosmeticAvatar } from "./CosmeticPreview";

const DEFAULT_NEW_CARD: CardThemeDesign = {
  bgStart: "#120a21",
  bgEnd: "#2b0f4c",
  bgAngle: 135,
  bgType: "linear",
  borderColor: "#a855f7",
  borderWidth: 2,
  borderStyle: "solid",
  borderRadius: 20,
  glowColor: "rgba(168, 85, 247, 0.5)",
  glowIntensity: "medium",
  textColor: "#f3e8ff",
  accentColor: "#c084fc",
  badgeText: "VIP",
  badgeBg: "#a855f7",
  badgeColor: "#0d041a",
  pattern: "radial",
  description: "Custom admin-forged profile hero card theme.",
};

export function CosmeticsAdmin() {
  const { fb, user, isAdmin } = useApp();
  const { settings } = useCosmetics();
  const [draft, setDraft] = useState<EconomySettings>(settings);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setError] = useState("");

  // Card Studio state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("Royal Starlight");
  const [cardPrice, setCardPrice] = useState(850);
  const [cardActive, setCardActive] = useState(true);
  const [cardDesign, setCardDesign] = useState<CardThemeDesign>(DEFAULT_NEW_CARD);

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
    return draft.cosmetics.filter(
      c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || c.slot.toLowerCase().includes(search.toLowerCase())
    );
  }, [draft.cosmetics, search]);

  const cardThemes = useMemo(() => {
    return draft.cosmetics.filter(c => c.slot === "card");
  }, [draft.cosmetics]);

  function openCreateCardModal() {
    setEditingCardId(null);
    setCardName("Supernova Crown");
    setCardPrice(850);
    setCardActive(true);
    setCardDesign({ ...DEFAULT_NEW_CARD });
    setCardModalOpen(true);
  }

  function openEditCardModal(item: Cosmetic) {
    setEditingCardId(item.id);
    setCardName(item.name);
    setCardPrice(item.price);
    setCardActive(item.active);
    setCardDesign(item.cardDesign ? { ...item.cardDesign } : { ...DEFAULT_NEW_CARD });
    setCardModalOpen(true);
  }

  function applyPreset(presetKey: keyof typeof CARD_PRESET_TEMPLATES) {
    const template = CARD_PRESET_TEMPLATES[presetKey];
    if (!template) return;
    setCardDesign({ ...template });
    toast.success(`Applied ${presetKey} preset styling.`);
  }

  function saveCardThemeToDraft() {
    if (!cardName.trim()) return toast.error("Enter a theme name.");
    if (!validPositive(cardPrice)) return toast.error("Price must be a positive number.");

    const targetId = editingCardId || `card-custom-${Date.now()}`;
    const item: Cosmetic = {
      id: targetId,
      name: cardName.trim(),
      slot: "card",
      style: `card-${targetId}`,
      price: cardPrice,
      active: cardActive,
      cardDesign: { ...cardDesign },
    };

    const exists = draft.cosmetics.some(c => c.id === targetId);
    const updated = exists
      ? draft.cosmetics.map(c => (c.id === targetId ? item : c))
      : [...draft.cosmetics, item];

    setDraft({ ...draft, cosmetics: updated });
    setCardModalOpen(false);
    toast.success(`${cardName} added to draft. Click 'Save shop settings' below to publish.`);
  }

  function deleteCardTheme(id: string) {
    if (!window.confirm("Remove this card theme from the shop?")) return;
    setDraft({ ...draft, cosmetics: draft.cosmetics.filter(c => c.id !== id) });
    toast.success("Card theme removed from draft.");
  }

  async function save() {
    if (!fb || !isAdmin) return;
    if (
      draft.packs.some(p => !p.name.trim() || !validPositive(p.coins) || !validPositive(p.amount)) ||
      draft.cosmetics.some(c => !validPositive(c.price))
    ) {
      return toast.error("Names are required. Prices and coin amounts must be positive numbers.");
    }
    if (draft.enabled && !draft.packs.some(p => p.active)) return toast.error("Publish at least one coin pack before opening shop.");
    setBusy(true);
    try {
      await saveEconomy(fb.db, normalizeEconomy(draft));
      toast.success("Coin shop & card themes successfully saved to database!");
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

  // Mock cosmetic for live preview
  const livePreviewCosmetic: Cosmetic = {
    id: "preview-card",
    name: cardName,
    slot: "card",
    style: "preview",
    price: cardPrice,
    active: cardActive,
    cardDesign,
  };

  return (
    <div className="space-y-8 pb-10">
      <section className="space-y-4 border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Coins className="text-warning size-6" /> Coin Shop & Cosmetics Studio
            </h2>
            <p className="text-muted-foreground text-xs mt-1">
              Configure coin packs, verify manual bank transfers, and create custom profile card themes for sale.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
            <Label htmlFor="shop-enable" className="text-xs font-semibold uppercase tracking-wider">
              Shop Open
            </Label>
            <Switch id="shop-enable" checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })} />
          </div>
        </div>
      </section>

      {/* PROFILE CARD THEMES STUDIO */}
      <section className="space-y-5 rounded-2xl border bg-card/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-lg">
              <Palette className="text-accent size-5" /> Profile Card Themes Studio
            </h3>
            <p className="text-muted-foreground text-xs">
              Design unique luxury card themes for players’ profile hero cards. You control every gradient, border, glow, badge, and price.
            </p>
          </div>
          <Button size="sm" onClick={openCreateCardModal}>
            <Plus className="size-4 mr-1" /> Create Custom Card Theme
          </Button>
        </div>

        {/* Existing Card Themes Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cardThemes.map(item => {
            const previewStyle = getCardThemeStyle(item);
            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all"
                style={previewStyle}
              >
                {item.cardDesign?.badgeText && (
                  <span
                    className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      backgroundColor: item.cardDesign.badgeBg || "rgba(212, 175, 55, 0.9)",
                      color: item.cardDesign.badgeColor || "#000",
                    }}
                  >
                    {item.cardDesign.badgeText}
                  </span>
                )}
                <div className="space-y-1 pr-14">
                  <h4 className="font-extrabold text-base truncate">{item.name}</h4>
                  <p className="text-xs opacity-80 line-clamp-2">
                    {item.cardDesign?.description || "Profile hero card theme."}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-warning">
                    <Coins className="size-4" /> {item.price.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={item.active}
                      onCheckedChange={active =>
                        setDraft({
                          ...draft,
                          cosmetics: draft.cosmetics.map(x => (x.id === item.id ? { ...x, active } : x)),
                        })
                      }
                    />
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => openEditCardModal(item)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCardTheme(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* COIN PACKS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Coin Packs</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                packs: [...draft.packs, { id: crypto.randomUUID(), name: "", coins: 0, amount: 0, active: true }],
              })
            }
          >
            <Plus className="size-4 mr-1" /> Add Pack
          </Button>
        </div>
        {draft.packs.map((p, i) => (
          <div key={p.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div>
              <Label htmlFor={`p-name-${i}`}>Pack Name</Label>
              <Input
                id={`p-name-${i}`}
                value={p.name}
                onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => (x.id === p.id ? { ...x, name: e.target.value } : x)) })}
              />
            </div>
            <div>
              <Label htmlFor={`p-coins-${i}`}>Coins</Label>
              <Input
                id={`p-coins-${i}`}
                type="number"
                value={p.coins}
                onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => (x.id === p.id ? { ...x, coins: Number(e.target.value) } : x)) })}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor={`p-amount-${i}`}>Price (₦)</Label>
                <Input
                  id={`p-amount-${i}`}
                  type="number"
                  value={p.amount}
                  onChange={e => setDraft({ ...draft, packs: draft.packs.map(x => (x.id === p.id ? { ...x, amount: Number(e.target.value) } : x)) })}
                />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, packs: draft.packs.filter(x => x.id !== p.id) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* ALL COSMETICS CATALOG TABLE */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-bold">Catalog Items ({draft.cosmetics.length} Items)</h3>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input placeholder="Filter by name or slot..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-2 sm:grid-cols-2">
          {visibleCosmetics.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <span className="text-muted-foreground text-xs uppercase">
                  {c.slot} · {c.style}
                </span>
              </div>
              <Input
                className="w-24 text-right"
                type="number"
                min={1}
                value={c.price}
                onChange={e => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => (x.id === c.id ? { ...x, price: Number(e.target.value) } : x)) })}
              />
              <Switch
                checked={c.active}
                onCheckedChange={active => setDraft({ ...draft, cosmetics: draft.cosmetics.map(x => (x.id === c.id ? { ...x, active } : x)) })}
              />
            </div>
          ))}
        </div>

        <Button disabled={busy} size="lg" className="w-full sm:w-auto" onClick={save}>
          {busy ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />} Save shop settings
        </Button>
      </section>

      {/* PENDING TRANSFERS */}
      <section className="space-y-4 border-t pt-6">
        <h3 className="font-bold">Pending Coin Transfers ({requests.length})</h3>
        {requests.length === 0 && <p className="text-muted-foreground text-sm">No pending bank transfers waiting for review.</p>}
        {requests.map(r => (
          <article className="space-y-3 rounded-lg border p-4" key={r.id}>
            <div className="flex justify-between">
              <h4 className="font-bold">{r.username}</h4>
              <p className="text-warning font-semibold">
                ₦{r.amount.toLocaleString()} → {r.coins.toLocaleString()} coins
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Sender: {r.sender} | Ref: {r.reference}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(r, true)}>
                <Check className="size-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(r, false)}>
                <X className="size-4 mr-1" /> Reject
              </Button>
            </div>
          </article>
        ))}
      </section>

      {/* CARD THEME CREATOR / EDITOR DIALOG */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Palette className="text-accent size-5" />
              {editingCardId ? `Edit Card Theme: ${cardName}` : "Create Custom Card Theme"}
            </DialogTitle>
            <DialogDescription>
              Configure every detail of this profile hero card theme. Check the live preview below to see exactly how players will see it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2 pt-2">
            {/* LEFT COLUMN: LIVE PREVIEW & PRESET SWATCHES */}
            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live Interactive Card Preview
              </Label>

              <div
                className="relative flex flex-col items-center p-6 text-center transition-all duration-300"
                style={getCardThemeStyle(livePreviewCosmetic)}
              >
                {cardDesign.badgeText && (
                  <span
                    className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm"
                    style={{
                      backgroundColor: cardDesign.badgeBg || "rgba(212, 175, 55, 0.9)",
                      color: cardDesign.badgeColor || "#000",
                    }}
                  >
                    {cardDesign.badgeText}
                  </span>
                )}

                <CosmeticAvatar name="Thaboss" wallet={{ balance: 0, owned: [], equipped: {} }} size={76} showTitle={false} />

                <h3 className="mt-3 text-xl font-black">{cardName || "Theme Name"}</h3>
                <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Crown className="size-3.5 text-warning" /> Level 9
                  </span>
                  <span>•</span>
                  <span>Bronze III · 732 RP</span>
                </div>

                <div className="mt-3 w-full max-w-[200px] h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: "70%" }} />
                </div>

                <div className="mt-2 text-[10px] opacity-70 flex items-center gap-1">
                  <CalendarDays className="size-3" /> Joined 10/24/2026
                </div>

                <p className="mt-3 text-[11px] opacity-75 italic line-clamp-1">
                  {cardDesign.description || "Custom designer card theme."}
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold">Load a Quick Design Preset</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CARD_PRESET_TEMPLATES) as Array<keyof typeof CARD_PRESET_TEMPLATES>).map(key => (
                    <Button key={key} size="sm" variant="outline" className="text-xs capitalize h-7" onClick={() => applyPreset(key)}>
                      {key}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTROLS & PICKERS */}
            <div className="space-y-4">
              <Tabs defaultValue="basics" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basics">Basics</TabsTrigger>
                  <TabsTrigger value="colors">Gradients</TabsTrigger>
                  <TabsTrigger value="borders">Borders & Glow</TabsTrigger>
                </TabsList>

                {/* BASICS TAB */}
                <TabsContent value="basics" className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="c-name">Card Theme Name</Label>
                    <Input id="c-name" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="e.g. Celestial Void" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="c-price">Price (Coins)</Label>
                      <Input
                        id="c-price"
                        type="number"
                        min={1}
                        value={cardPrice}
                        onChange={e => setCardPrice(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between rounded-lg border p-2">
                        <Label htmlFor="c-active" className="text-xs cursor-pointer">
                          Active in Shop
                        </Label>
                        <Switch id="c-active" checked={cardActive} onCheckedChange={setCardActive} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="c-desc">Shop Description / Lore</Label>
                    <Input
                      id="c-desc"
                      value={cardDesign.description || ""}
                      onChange={e => setCardDesign({ ...cardDesign, description: e.target.value })}
                      placeholder="e.g. Forged from pure starlight and void titanium."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <Label htmlFor="c-badge-text">Badge Tag</Label>
                      <Input
                        id="c-badge-text"
                        value={cardDesign.badgeText || ""}
                        onChange={e => setCardDesign({ ...cardDesign, badgeText: e.target.value.toUpperCase() })}
                        placeholder="VIP"
                        maxLength={12}
                      />
                    </div>
                    <div>
                      <Label htmlFor="c-badge-bg">Badge Bg</Label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          id="c-badge-bg"
                          type="color"
                          value={cardDesign.badgeBg || "#d4af37"}
                          onChange={e => setCardDesign({ ...cardDesign, badgeBg: e.target.value })}
                          className="size-8 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.badgeBg || "#d4af37"}
                          onChange={e => setCardDesign({ ...cardDesign, badgeBg: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="c-badge-color">Badge Text</Label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          id="c-badge-color"
                          type="color"
                          value={cardDesign.badgeColor || "#000000"}
                          onChange={e => setCardDesign({ ...cardDesign, badgeColor: e.target.value })}
                          className="size-8 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.badgeColor || "#000000"}
                          onChange={e => setCardDesign({ ...cardDesign, badgeColor: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* GRADIENTS TAB */}
                <TabsContent value="colors" className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="c-bg-start">Start Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id="c-bg-start"
                          type="color"
                          value={cardDesign.bgStart || "#141108"}
                          onChange={e => setCardDesign({ ...cardDesign, bgStart: e.target.value })}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.bgStart || "#141108"}
                          onChange={e => setCardDesign({ ...cardDesign, bgStart: e.target.value })}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="c-bg-end">End Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id="c-bg-end"
                          type="color"
                          value={cardDesign.bgEnd || "#2a220e"}
                          onChange={e => setCardDesign({ ...cardDesign, bgEnd: e.target.value })}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.bgEnd || "#2a220e"}
                          onChange={e => setCardDesign({ ...cardDesign, bgEnd: e.target.value })}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <Label>Gradient Angle</Label>
                      <span className="font-mono text-muted-foreground">{cardDesign.bgAngle ?? 135}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      value={cardDesign.bgAngle ?? 135}
                      onChange={e => setCardDesign({ ...cardDesign, bgAngle: Number(e.target.value) })}
                      className="w-full accent-primary mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="c-text-color">Text Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id="c-text-color"
                          type="color"
                          value={cardDesign.textColor || "#fef3c7"}
                          onChange={e => setCardDesign({ ...cardDesign, textColor: e.target.value })}
                          className="size-8 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.textColor || "#fef3c7"}
                          onChange={e => setCardDesign({ ...cardDesign, textColor: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="c-gradient-type">Gradient Style</Label>
                      <select
                        id="c-gradient-type"
                        value={cardDesign.bgType || "linear"}
                        onChange={e => setCardDesign({ ...cardDesign, bgType: e.target.value as "linear" | "radial" })}
                        className="w-full mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="linear">Linear Angle</option>
                        <option value="radial">Radial Glow</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>

                {/* BORDERS & GLOW TAB */}
                <TabsContent value="borders" className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="c-border-color">Border Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id="c-border-color"
                          type="color"
                          value={cardDesign.borderColor || "#d4af37"}
                          onChange={e => setCardDesign({ ...cardDesign, borderColor: e.target.value })}
                          className="size-8 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.borderColor || "#d4af37"}
                          onChange={e => setCardDesign({ ...cardDesign, borderColor: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="c-border-width">Border Width</Label>
                      <select
                        id="c-border-width"
                        value={cardDesign.borderWidth ?? 2}
                        onChange={e => setCardDesign({ ...cardDesign, borderWidth: Number(e.target.value) })}
                        className="w-full mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value={1}>1px Subtle</option>
                        <option value={2}>2px Standard</option>
                        <option value={3}>3px Heavy</option>
                        <option value={4}>4px Bold</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="c-border-style">Border Style</Label>
                      <select
                        id="c-border-style"
                        value={cardDesign.borderStyle || "solid"}
                        onChange={e => setCardDesign({ ...cardDesign, borderStyle: e.target.value as "solid" | "dashed" | "double" })}
                        className="w-full mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed Laser</option>
                        <option value="double">Double Regal</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="c-border-radius">Corner Radius</Label>
                      <select
                        id="c-border-radius"
                        value={cardDesign.borderRadius ?? 20}
                        onChange={e => setCardDesign({ ...cardDesign, borderRadius: Number(e.target.value) })}
                        className="w-full mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value={14}>Sleek (14px)</option>
                        <option value={20}>Standard (20px)</option>
                        <option value={26}>Pill (26px)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label htmlFor="c-glow-color">Glow / Shadow Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id="c-glow-color"
                          type="color"
                          value={cardDesign.glowColor?.startsWith("#") ? cardDesign.glowColor : "#d4af37"}
                          onChange={e => setCardDesign({ ...cardDesign, glowColor: e.target.value })}
                          className="size-8 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={cardDesign.glowColor || "rgba(212, 175, 55, 0.4)"}
                          onChange={e => setCardDesign({ ...cardDesign, glowColor: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="c-glow-intensity">Glow Aura Intensity</Label>
                      <select
                        id="c-glow-intensity"
                        value={cardDesign.glowIntensity || "medium"}
                        onChange={e =>
                          setCardDesign({
                            ...cardDesign,
                            glowIntensity: e.target.value as "none" | "soft" | "medium" | "intense" | "ultra",
                          })
                        }
                        className="w-full mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="none">None (Flat)</option>
                        <option value="soft">Soft Ambient</option>
                        <option value="medium">Medium Glow</option>
                        <option value="intense">Intense Aura</option>
                        <option value="ultra">Ultra Neon Burst</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-4 border-t">
                <Button className="flex-1" onClick={saveCardThemeToDraft}>
                  <Check className="size-4 mr-1.5" />
                  {editingCardId ? "Update Card Theme" : "Add to Shop Catalog"}
                </Button>
                <Button variant="outline" onClick={() => setCardModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
