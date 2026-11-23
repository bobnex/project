import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Shirt, 
  Footprints, 
  Crown, 
  Zap, 
  Smile, 
  Check, 
  Palette, 
  RotateCcw, 
  Save, 
  Coins,
  ShoppingBag,
  Flame,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/lib/app-context";
import { useCosmetics } from "@/lib/cosmetics-store";
import { 
  AVATAR_CATALOG, 
  DEFAULT_AVATAR_CONFIG, 
  DEFAULT_HAIR_COLORS, 
  DEFAULT_SKIN_TONES, 
  RARITY_COLORS, 
  getPlayerAvatar, 
  savePlayerAvatar, 
  type AvatarCustomization, 
  type AvatarCatalogItem 
} from "@/lib/avatar";
import { ThreeAvatarCanvas } from "@/components/avatar/ThreeAvatarCanvas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_player/avatar-studio")({
  head: () => ({
    meta: [
      { title: "Avatar Studio — Juvora 3D" },
      { name: "description", content: "Create and customize your signature full-body 3D Juvora avatar." },
      { property: "og:title", content: "Juvora Avatar Studio" },
      { property: "og:description", content: "Fortnite-inspired 3D character customization with modular outfits, hairstyles, and animations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AvatarStudioPage,
});

export function AvatarStudioPage() {
  const { user, profile, fb } = useApp();
  const { wallet } = useCosmetics();
  const navigate = useNavigate();

  const [avatar, setAvatar] = useState<AvatarCustomization>(DEFAULT_AVATAR_CONFIG);
  const [initialAvatar, setInitialAvatar] = useState<AvatarCustomization>(DEFAULT_AVATAR_CONFIG);
  const [activeTab, setActiveTab] = useState<"body" | "hair" | "outfits" | "shoes" | "accessories" | "poses" | "vfx">("outfits");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load user avatar on mount
  useEffect(() => {
    if (!fb || !user) return;
    getPlayerAvatar(fb.db, user.uid).then((loaded) => {
      setAvatar(loaded);
      setInitialAvatar(loaded);
    });
  }, [fb, user]);

  // Track unsaved modifications
  useEffect(() => {
    setHasChanges(JSON.stringify(avatar) !== JSON.stringify(initialAvatar));
  }, [avatar, initialAvatar]);

  const handleSave = async () => {
    if (!fb || !user) {
      toast.error("Sign in to save your 3D avatar!");
      return;
    }

    setSaving(true);
    try {
      await savePlayerAvatar(fb.db, user.uid, avatar);
      setInitialAvatar(avatar);
      setHasChanges(false);
      toast.success("Avatar saved successfully! Visible across all battles & leaderboards.");
    } catch (err: any) {
      toast.error("Failed to save avatar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAvatar(initialAvatar);
  };

  // Filter items by category
  const getCatalogItems = (cat: AvatarCatalogItem["category"]) => {
    return AVATAR_CATALOG.filter((i) => i.category === cat);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-6 rounded-2xl border border-purple-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-6 text-purple-400" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display">
              JUVORA AVATAR STUDIO
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Customize your signature 3D champion. Equippable in Battles, Tournaments, and Leaderboards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            <RotateCcw className="size-4" /> Reset
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
          >
            <Save className="size-4" /> {saving ? "Saving..." : "Save Character"}
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Viewport */}
        <div className="lg:col-span-6 xl:col-span-5 sticky top-20">
          <div className="glass p-4 rounded-3xl border border-purple-500/30 relative">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
              <Badge className="bg-purple-950/80 border-purple-500 text-purple-300">
                LIVE 3D VIEWPORT
              </Badge>
              {hasChanges && (
                <Badge variant="outline" className="border-amber-500 text-amber-400 animate-pulse">
                  Unsaved Changes
                </Badge>
              )}
            </div>

            <ThreeAvatarCanvas
              customization={avatar}
              interactive={true}
              height={560}
              className="w-full"
            />

            {/* Quick Pose Bar */}
            <div className="mt-4 flex items-center justify-between gap-2 overflow-x-auto p-1 bg-black/40 rounded-xl border border-border/50">
              {getCatalogItems("pose").map((p) => {
                const active = avatar.poseId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setAvatar({ ...avatar, poseId: p.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      active
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                        : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Customization Drawers & Categories */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full bg-black/40 border border-purple-500/20 p-1 rounded-2xl h-auto gap-1">
              <TabsTrigger value="outfits" className="gap-1.5 py-2.5 text-xs">
                <Shirt className="size-4" /> Outfits
              </TabsTrigger>
              <TabsTrigger value="hair" className="gap-1.5 py-2.5 text-xs">
                <Crown className="size-4" /> Hair
              </TabsTrigger>
              <TabsTrigger value="body" className="gap-1.5 py-2.5 text-xs">
                <Palette className="size-4" /> Body
              </TabsTrigger>
              <TabsTrigger value="shoes" className="gap-1.5 py-2.5 text-xs">
                <Footprints className="size-4" /> Shoes
              </TabsTrigger>
              <TabsTrigger value="accessories" className="gap-1.5 py-2.5 text-xs">
                <ShieldCheck className="size-4" /> Gear
              </TabsTrigger>
              <TabsTrigger value="poses" className="gap-1.5 py-2.5 text-xs">
                <Smile className="size-4" /> Poses
              </TabsTrigger>
              <TabsTrigger value="vfx" className="gap-1.5 py-2.5 text-xs">
                <Flame className="size-4" /> Auras
              </TabsTrigger>
            </TabsList>

            {/* Outfits Category */}
            <TabsContent value="outfits" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getCatalogItems("outfit").map((item) => {
                  const equipped = avatar.outfitId === item.id;
                  const rarity = RARITY_COLORS[item.rarity];

                  return (
                    <div
                      key={item.id}
                      onClick={() => setAvatar({ ...avatar, outfitId: item.id })}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        equipped
                          ? "border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20"
                          : "border-border/60 bg-surface-card hover:border-purple-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`${rarity.bg} ${rarity.text} ${rarity.border} border text-[10px] font-bold uppercase`}>
                          {item.rarity}
                        </Badge>
                        {equipped && (
                          <span className="flex items-center gap-1 text-xs text-purple-400 font-bold">
                            <Check className="size-3.5" /> EQUIPPED
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Hair & Style Category */}
            <TabsContent value="hair" className="mt-4 space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Select Hairstyle</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {getCatalogItems("hair").map((item) => {
                    const equipped = avatar.hairStyleId === item.id;
                    const rarity = RARITY_COLORS[item.rarity];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setAvatar({ ...avatar, hairStyleId: item.id })}
                        className={`cursor-pointer p-3 rounded-2xl border transition-all ${
                          equipped
                            ? "border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/50"
                            : "border-border/60 bg-surface-card hover:border-purple-500/30"
                        }`}
                      >
                        <Badge className={`${rarity.bg} ${rarity.text} border ${rarity.border} text-[9px] mb-2`}>
                          {item.rarity}
                        </Badge>
                        <div className="font-bold text-xs truncate">{item.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Hair Color Tint</h4>
                <div className="flex flex-wrap gap-2.5">
                  {DEFAULT_HAIR_COLORS.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setAvatar({ ...avatar, hairColor: hex })}
                      className={`size-10 rounded-full border-2 transition-transform ${
                        avatar.hairColor === hex ? "scale-110 border-white ring-2 ring-purple-500" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Body & Melanin Skin Tones */}
            <TabsContent value="body" className="mt-4 space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Melanin Skin Tone</h4>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {DEFAULT_SKIN_TONES.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setAvatar({ ...avatar, skinTone: hex })}
                      className={`h-12 rounded-2xl border-2 transition-all flex items-center justify-center ${
                        avatar.skinTone === hex ? "border-purple-500 scale-105 ring-2 ring-purple-500/40" : "border-white/10 hover:border-white/40"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {avatar.skinTone === hex && <Check className="size-4 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Eye Color</h4>
                <div className="flex flex-wrap gap-3">
                  {["#06b6d4", "#a855f7", "#eab308", "#10b981", "#ef4444", "#3b82f6", "#f43f5e"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setAvatar({ ...avatar, eyeColor: color })}
                      className={`size-9 rounded-full border-2 ${
                        avatar.eyeColor === color ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Shoes */}
            <TabsContent value="shoes" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getCatalogItems("shoes").map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setAvatar({ ...avatar, shoesId: item.id })}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      avatar.shoesId === item.id
                        ? "border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/50"
                        : "border-border/60 bg-surface-card"
                    }`}
                  >
                    <div className="font-bold text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Gear & Accessories */}
            <TabsContent value="accessories" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getCatalogItems("headwear").concat(getCatalogItems("backBling")).map((item) => {
                  const equipped = avatar.headwearId === item.id || avatar.backBlingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.category === "headwear") {
                          setAvatar({ ...avatar, headwearId: equipped ? undefined : item.id });
                        } else {
                          setAvatar({ ...avatar, backBlingId: equipped ? undefined : item.id });
                        }
                      }}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        equipped
                          ? "border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/50"
                          : "border-border/60 bg-surface-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{item.name}</span>
                        {equipped && <Badge className="bg-purple-600 text-xs">Equipped</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* VFX Auras */}
            <TabsContent value="vfx" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getCatalogItems("vfx").map((item) => {
                  const equipped = avatar.vfxAuraId === item.id;
                  const rarity = RARITY_COLORS[item.rarity];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setAvatar({ ...avatar, vfxAuraId: equipped ? undefined : item.id })}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        equipped
                          ? "border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/50"
                          : "border-border/60 bg-surface-card"
                      }`}
                    >
                      <Badge className={`${rarity.bg} ${rarity.text} border ${rarity.border} text-[10px] mb-2`}>
                        {item.rarity}
                      </Badge>
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Shop Callout */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="size-6 text-purple-400" />
              <div>
                <div className="text-sm font-bold text-foreground">Want rare and mythic gear?</div>
                <div className="text-xs text-muted-foreground">Unlock exclusive animated outfits and wings in the Shop.</div>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate({ to: "/shop" })} className="bg-purple-600 hover:bg-purple-500">
              Open Shop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
