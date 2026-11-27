import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Orbit, 
  Sparkles, 
  Zap, 
  Palette, 
  RotateCcw, 
  Save, 
  Coins, 
  ShoppingBag, 
  Check, 
  Layers, 
  ArrowUpCircle,
  ShieldCheck,
  Flame
} from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/lib/app-context";
import { useCosmetics } from "@/lib/cosmetics-store";
import { 
  DEFAULT_ORIGIN_ENTITY, 
  ENTITY_CATALOG, 
  EVOLUTION_STAGES, 
  RARITY_THEMES,
  canEntityEvolve,
  getNextEvolutionStage,
  type PlayerEntity, 
  type EntityCustomization,
  type CoreShape
} from "@/lib/entity";
import { 
  loadPlayerEntities, 
  setActivePlayerEntity, 
  saveEntityCustomization, 
  evolvePlayerEntity, 
  purchaseEntityArchetype 
} from "@/lib/entity-store";
import { Entity3DCanvas } from "@/components/entity/Entity3DCanvas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_player/avatar-studio")({
  head: () => ({
    meta: [
      { title: "Entity Studio — Juvora 2.0" },
      { name: "description", content: "Customize your abstract Juvora Entity, unlock new geometric cores, and evolve your digital consciousness." },
      { property: "og:title", content: "Juvora Entity Studio" },
      { property: "og:description", content: "Abstract digital identities with 3D crystal geometry, particle coronas, and hybrid evolution." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EntityStudioPage,
});

export function EntityStudioPage() {
  const { user, fb } = useApp();
  const { wallet } = useCosmetics();

  const [entities, setEntities] = useState<PlayerEntity[]>([DEFAULT_ORIGIN_ENTITY]);
  const [activeEntityId, setActiveEntityId] = useState<string>("origin");
  const [selectedEntity, setSelectedEntity] = useState<PlayerEntity>(DEFAULT_ORIGIN_ENTITY);
  const [customization, setCustomization] = useState<EntityCustomization>(DEFAULT_ORIGIN_ENTITY.customization);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fb || !user) return;
    loadPlayerEntities(fb.db, user.uid).then((res) => {
      setEntities(res.entities);
      setActiveEntityId(res.activeEntityId);
      const active = res.entities.find((e) => e.id === res.activeEntityId) || res.entities[0] || DEFAULT_ORIGIN_ENTITY;
      setSelectedEntity(active);
      setCustomization(active.customization);
      setLoading(false);
    });
  }, [fb, user]);

  const handleSetActive = async (entityId: string) => {
    if (!fb || !user) return;
    try {
      await setActivePlayerEntity(fb.db, user.uid, entityId);
      setActiveEntityId(entityId);
      const ent = entities.find((e) => e.id === entityId);
      if (ent) {
        setSelectedEntity(ent);
        setCustomization(ent.customization);
      }
      toast.success("Active Entity updated across Juvora!");
    } catch {
      toast.error("Failed to activate Entity.");
    }
  };

  const handleSaveCustomization = async () => {
    if (!fb || !user) return;
    setSaving(true);
    try {
      await saveEntityCustomization(fb.db, user.uid, selectedEntity.id, customization);
      setEntities((prev) =>
        prev.map((e) => (e.id === selectedEntity.id ? { ...e, customization } : e))
      );
      toast.success("Entity geometry & energy harmonics saved!");
    } catch {
      toast.error("Failed to save customization.");
    } finally {
      setSaving(false);
    }
  };

  const handleEvolve = async () => {
    if (!fb || !user) return;
    try {
      const res = await evolvePlayerEntity(fb.db, user.uid, selectedEntity);
      if (res.success && res.newStage) {
        toast.success(res.message);
        setEntities((prev) =>
          prev.map((e) => (e.id === selectedEntity.id ? { ...e, stage: res.newStage! } : e))
        );
        setSelectedEntity((prev) => ({ ...prev, stage: res.newStage! }));
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Evolution sequence interrupted.");
    }
  };

  const handleBuyEntity = async (archetypeId: string) => {
    if (!fb || !user) return;
    try {
      const res = await purchaseEntityArchetype(fb.db, user.uid, archetypeId, wallet.balance);
      if (res.success && res.newEntity) {
        toast.success(res.message);
        setEntities((prev) => [...prev, res.newEntity!]);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Purchase failed.");
    }
  };

  const nextStage = getNextEvolutionStage(selectedEntity.stage);
  const nextStageReq = nextStage ? EVOLUTION_STAGES[nextStage] : null;
  const xpPercent = nextStageReq
    ? Math.min(100, Math.round((selectedEntity.currentXp / nextStageReq.minXp) * 100))
    : 100;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/80 via-zinc-950 to-indigo-950/80 p-6">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/40">Juvora 2.0</Badge>
              <span className="text-xs font-mono text-zinc-400">ACTIVE: {selectedEntity.name.toUpperCase()}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">ENTITY STUDIO</h1>
            <p className="text-sm text-zinc-300 max-w-xl mt-0.5">
              Your abstract digital identity. Gain Entity XP in battles to unlock higher geometric evolution stages.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900/80 border border-purple-500/20 px-4 py-2.5 rounded-2xl">
            <Coins className="size-5 text-amber-400" />
            <div>
              <div className="text-xs text-zinc-400">Coins Available</div>
              <div className="text-lg font-bold text-white tabular">{wallet.balance}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Tabs */}
      <Tabs defaultValue="my-entity" className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-zinc-900/90 border border-purple-500/20 p-1 rounded-2xl h-auto">
          <TabsTrigger value="my-entity" className="py-2.5 text-xs sm:text-sm font-semibold gap-1.5 data-[state=active]:bg-purple-600">
            <Orbit className="size-4" />
            <span>My Entity</span>
          </TabsTrigger>
          <TabsTrigger value="collection" className="py-2.5 text-xs sm:text-sm font-semibold gap-1.5 data-[state=active]:bg-purple-600">
            <Layers className="size-4" />
            <span>Collection</span>
          </TabsTrigger>
          <TabsTrigger value="customize" className="py-2.5 text-xs sm:text-sm font-semibold gap-1.5 data-[state=active]:bg-purple-600">
            <Palette className="size-4" />
            <span>Customize</span>
          </TabsTrigger>
          <TabsTrigger value="evolution" className="py-2.5 text-xs sm:text-sm font-semibold gap-1.5 data-[state=active]:bg-purple-600">
            <ArrowUpCircle className="size-4" />
            <span>Evolution</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="py-2.5 text-xs sm:text-sm font-semibold gap-1.5 data-[state=active]:bg-purple-600">
            <ShoppingBag className="size-4" />
            <span>Store</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. MY ENTITY */}
        <TabsContent value="my-entity" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <Entity3DCanvas
                customization={customization}
                stage={selectedEntity.stage}
                height={420}
                className="w-full shadow-2xl shadow-purple-950/40"
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl border border-purple-500/20 bg-zinc-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={`${RARITY_THEMES[selectedEntity.rarity].bg} ${RARITY_THEMES[selectedEntity.rarity].text} border ${RARITY_THEMES[selectedEntity.rarity].border}`}>
                    {selectedEntity.rarity.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-purple-300">
                    {EVOLUTION_STAGES[selectedEntity.stage].name}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">{selectedEntity.name}</h2>
                  <p className="text-xs text-zinc-400">{selectedEntity.title}</p>
                </div>

                {/* XP Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Entity XP</span>
                    <span className="text-purple-300 font-mono">
                      {selectedEntity.currentXp} {nextStageReq ? `/ ${nextStageReq.minXp}` : "(MAX)"}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                  {EVOLUTION_STAGES[selectedEntity.stage].description}
                </div>

                <div className="pt-2 flex gap-3">
                  {activeEntityId === selectedEntity.id ? (
                    <Button disabled className="w-full bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                      <Check className="size-4 mr-2" /> Activated Everywhere
                    </Button>
                  ) : (
                    <Button onClick={() => handleSetActive(selectedEntity.id)} className="w-full bg-purple-600 hover:bg-purple-700">
                      Set As Active Entity
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. COLLECTION */}
        <TabsContent value="collection" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {entities.map((ent) => {
              const isActive = activeEntityId === ent.id;
              const isSelected = selectedEntity.id === ent.id;

              return (
                <div
                  key={ent.id}
                  onClick={() => {
                    setSelectedEntity(ent);
                    setCustomization(ent.customization);
                  }}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-900/30"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={`${RARITY_THEMES[ent.rarity].bg} ${RARITY_THEMES[ent.rarity].text} border ${RARITY_THEMES[ent.rarity].border} text-[10px]`}>
                      {ent.rarity}
                    </Badge>
                    {isActive && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="h-32 mb-2">
                    <Entity3DCanvas
                      customization={ent.customization}
                      stage={ent.stage}
                      height={128}
                      interactive={false}
                    />
                  </div>

                  <h3 className="font-bold text-white text-sm">{ent.name}</h3>
                  <p className="text-xs text-zinc-400 truncate">{ent.title}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* 3. CUSTOMIZE */}
        <TabsContent value="customize" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <Entity3DCanvas
                customization={customization}
                stage={selectedEntity.stage}
                height={400}
                className="w-full"
              />
            </div>

            <div className="lg:col-span-5 p-6 rounded-2xl border border-purple-500/20 bg-zinc-900/60 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Core Geometry Shape</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(["octahedron", "icosahedron", "hypercube", "torus_core", "crystal_cluster", "celestial_star"] as CoreShape[]).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setCustomization((prev) => ({ ...prev, coreShape: shape }))}
                      className={`text-xs p-2 rounded-xl border capitalize ${
                        customization.coreShape === shape
                          ? "border-purple-500 bg-purple-950 text-white font-bold"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {shape.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Colors */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Primary Energy Hue</h3>
                <div className="flex gap-2">
                  {["#a855f7", "#38bdf8", "#f59e0b", "#10b981", "#ef4444", "#ffffff"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCustomization((prev) => ({ ...prev, primaryColor: color }))}
                      style={{ backgroundColor: color }}
                      className={`size-8 rounded-full border-2 transition-transform ${
                        customization.primaryColor === color ? "scale-110 border-white" : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Orbital Particle Density</h3>
                <div className="grid grid-cols-4 gap-2">
                  {(["subtle", "balanced", "intense", "hyper"] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => setCustomization((prev) => ({ ...prev, particleDensity: density }))}
                      className={`text-xs py-1.5 rounded-lg border capitalize ${
                        customization.particleDensity === density
                          ? "border-purple-500 bg-purple-950 text-white font-bold"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSaveCustomization}
                disabled={saving}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Save className="size-4 mr-2" /> {saving ? "Aligning Matrices..." : "Save Customization"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* 4. EVOLUTION */}
        <TabsContent value="evolution" className="mt-6 space-y-6">
          <div className="p-6 rounded-3xl border border-purple-500/20 bg-zinc-900/80">
            <h2 className="text-xl font-bold text-white mb-1">Hybrid Evolution Chamber</h2>
            <p className="text-xs text-zinc-400 mb-6">
              When your Entity absorbs sufficient battle XP, you may trigger the ascension ritual to permanently mutate its visual frequency.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(["awakened", "evolved", "ascended", "transcendent"] as const).map((stageKey, idx) => {
                const req = EVOLUTION_STAGES[stageKey];
                const isCurrent = selectedEntity.stage === stageKey;
                const isUnlocked = selectedEntity.currentXp >= req.minXp;

                return (
                  <div
                    key={stageKey}
                    className={`p-4 rounded-2xl border ${
                      isCurrent
                        ? "border-purple-500 bg-purple-950/40"
                        : isUnlocked
                          ? "border-zinc-700 bg-zinc-900/60"
                          : "border-zinc-900 bg-zinc-950/40 opacity-50"
                    }`}
                  >
                    <div className="text-xs font-mono text-purple-400">STAGE {idx + 1}</div>
                    <div className="text-sm font-bold text-white mt-0.5">{req.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">Req: {req.minXp} XP</div>

                    <div className="mt-3 space-y-1">
                      {req.unlockedPerks.map((p) => (
                        <div key={p} className="text-[10px] text-zinc-300 flex items-center gap-1">
                          <Check className="size-3 text-purple-400" /> {p}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-center">
              {canEntityEvolve(selectedEntity) ? (
                <Button onClick={handleEvolve} className="px-8 py-6 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-purple-900/40">
                  <Sparkles className="size-5 mr-2" /> Evolve Entity Now
                </Button>
              ) : (
                <Button disabled className="px-8 bg-zinc-800 text-zinc-500">
                  Insufficient XP for Next Evolution ({selectedEntity.currentXp} / {nextStageReq?.minXp || 3000})
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 5. STORE */}
        <TabsContent value="store" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ENTITY_CATALOG.filter((a) => !entities.some((e) => e.archetypeId === a.id)).map((archetype) => (
              <div key={archetype.id} className="p-5 rounded-3xl border border-purple-500/20 bg-zinc-900/70 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={`${RARITY_THEMES[archetype.rarity].bg} ${RARITY_THEMES[archetype.rarity].text} border ${RARITY_THEMES[archetype.rarity].border}`}>
                    {archetype.rarity.toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                    <Coins className="size-4" /> {archetype.priceCoins}
                  </div>
                </div>

                <div className="h-36">
                  <Entity3DCanvas
                    customization={{
                      ...DEFAULT_ORIGIN_ENTITY.customization,
                      coreShape: archetype.defaultShape,
                      primaryColor: archetype.defaultPrimary,
                      secondaryColor: archetype.defaultSecondary,
                    }}
                    stage="awakened"
                    height={144}
                    interactive={false}
                  />
                </div>

                <div>
                  <h3 className="font-bold text-white text-base">{archetype.name}</h3>
                  <p className="text-xs text-purple-300 font-mono">{archetype.title}</p>
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{archetype.description}</p>
                </div>

                <Button
                  onClick={() => handleBuyEntity(archetype.id)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Unlock Entity
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
