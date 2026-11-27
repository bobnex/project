export type EntityRarity = "common" | "rare" | "epic" | "legendary" | "mythic" | "transcendent";

export type EvolutionStage = "awakened" | "evolved" | "ascended" | "transcendent";

export interface EvolutionRequirement {
  stage: EvolutionStage;
  name: string;
  minXp: number;
  unlockedPerks: string[];
  resonanceMultiplier: number;
  description: string;
}

export const EVOLUTION_STAGES: Record<EvolutionStage, EvolutionRequirement> = {
  awakened: {
    stage: "awakened",
    name: "Stage I: Awakened",
    minXp: 0,
    unlockedPerks: ["Basic Geometric Core", "Primary Energy Glow", "Single Orbit Ring"],
    resonanceMultiplier: 1.0,
    description: "The initial manifestation of your digital consciousness.",
  },
  evolved: {
    stage: "evolved",
    name: "Stage II: Evolved",
    minXp: 400,
    unlockedPerks: ["Refracted Facets", "Dual Harmonic Resonance", "Particle Corona"],
    resonanceMultiplier: 1.25,
    description: "Crystalline matrices deepen, pulsing with rhythmic battle momentum.",
  },
  ascended: {
    stage: "ascended",
    name: "Stage III: Ascended",
    minXp: 1200,
    unlockedPerks: ["Tri-Axial Orbit Lattice", "Chrono-Phase Shifting", "Supercharged Core"],
    resonanceMultiplier: 1.6,
    description: "Transcends singular geometries into high-density energy dynamics.",
  },
  transcendent: {
    stage: "transcendent",
    name: "Stage IV: Transcendent",
    minXp: 3000,
    unlockedPerks: ["Infinite Void Corona", "Singularity Pulses", "Omnipresent Aura"],
    resonanceMultiplier: 2.0,
    description: "The absolute pinnacle of digital abstraction and competitive prestige.",
  },
};

export type CoreShape = 
  | "octahedron" 
  | "icosahedron" 
  | "hypercube" 
  | "torus_core" 
  | "crystal_cluster" 
  | "celestial_star";

export interface EntityCustomization {
  primaryColor: string;
  secondaryColor: string;
  coreShape: CoreShape;
  particleDensity: "subtle" | "balanced" | "intense" | "hyper";
  orbitalRings: 0 | 1 | 2 | 3;
  resonanceSpeed: "calm" | "pulsing" | "overdrive";
  trailEffect: "none" | "stardust" | "plasma" | "void_warp";
}

export interface PlayerEntity {
  id: string;
  archetypeId: string;
  name: string;
  title: string;
  rarity: EntityRarity;
  stage: EvolutionStage;
  currentXp: number;
  obtainedAt: number;
  customization: EntityCustomization;
}

export interface EntityArchetype {
  id: string;
  name: string;
  title: string;
  rarity: EntityRarity;
  defaultShape: CoreShape;
  defaultPrimary: string;
  defaultSecondary: string;
  priceCoins: number;
  unlockedByDefault?: boolean;
  description: string;
  lore: string;
}

export const DEFAULT_ENTITY_CUSTOMIZATION: EntityCustomization = {
  primaryColor: "#a855f7", // Juvora Royal Purple
  secondaryColor: "#38bdf8", // Celestial Sky Blue
  coreShape: "octahedron",
  particleDensity: "balanced",
  orbitalRings: 1,
  resonanceSpeed: "pulsing",
  trailEffect: "plasma",
};

export const DEFAULT_ORIGIN_ENTITY: PlayerEntity = {
  id: "origin",
  archetypeId: "origin",
  name: "Origin",
  title: "The Primordial Core",
  rarity: "common",
  stage: "awakened",
  currentXp: 0,
  obtainedAt: 1700000000000,
  customization: DEFAULT_ENTITY_CUSTOMIZATION,
};

export const ENTITY_CATALOG: EntityArchetype[] = [
  {
    id: "origin",
    name: "Origin",
    title: "The Primordial Core",
    rarity: "common",
    defaultShape: "octahedron",
    defaultPrimary: "#a855f7",
    defaultSecondary: "#38bdf8",
    priceCoins: 0,
    unlockedByDefault: true,
    description: "Standard harmonic core imbued in every newly initiated player.",
    lore: "Forged in the initial ignition of the Juvora network, Origin balances all elemental energy lines.",
  },
  {
    id: "void_singularity",
    name: "Void Singularity",
    title: "Gravitational Nexus",
    rarity: "epic",
    defaultShape: "hypercube",
    defaultPrimary: "#818cf8",
    defaultSecondary: "#f43f5e",
    priceCoins: 350,
    description: "Distorts space and light with high-mass graviton particles.",
    lore: "Born from collapsed test arenas, this entity draws ambient intelligence into an infinite focal point.",
  },
  {
    id: "solar_nexus",
    name: "Solar Nexus",
    title: "Coronal Reactor",
    rarity: "legendary",
    defaultShape: "celestial_star",
    defaultPrimary: "#f59e0b",
    defaultSecondary: "#ef4444",
    priceCoins: 600,
    description: "Radiates blinding fusion bursts and twin coronal solar storms.",
    lore: "Unstable nuclear harmonics captured during the first championship solar cycle.",
  },
  {
    id: "chrono_matrix",
    name: "Chrono Matrix",
    title: "Temporal Hyperlattice",
    rarity: "legendary",
    defaultShape: "icosahedron",
    defaultPrimary: "#10b981",
    defaultSecondary: "#06b6d4",
    priceCoins: 750,
    description: "Perpetually refolding geometric time-folds operating in 4D space.",
    lore: "Maintains absolute calculation speed and temporal equilibrium under battle pressure.",
  },
  {
    id: "prism_lattice",
    name: "Prism Lattice",
    title: "Refractive Monolith",
    rarity: "rare",
    defaultShape: "crystal_cluster",
    defaultPrimary: "#ec4899",
    defaultSecondary: "#8b5cf6",
    priceCoins: 250,
    description: "Splits radiant incoming thought patterns into sharp crystalline spectra.",
    lore: "Formed through thousands of peer battles resolving simultaneously in crystallised unison.",
  },
  {
    id: "aether_torus",
    name: "Aether Torus",
    title: "Fluid Harmonic Vortex",
    rarity: "mythic",
    defaultShape: "torus_core",
    defaultPrimary: "#38bdf8",
    defaultSecondary: "#a855f7",
    priceCoins: 1200,
    description: "A continuous fluidic loop with no beginning or end.",
    lore: "An ethereal phenomenon visible only to grandmasters who have transcended traditional thought.",
  },
];

export const RARITY_THEMES: Record<EntityRarity, { text: string; bg: string; border: string; glow: string }> = {
  common: { text: "text-zinc-400", bg: "bg-zinc-800/80", border: "border-zinc-700", glow: "shadow-zinc-500/20" },
  rare: { text: "text-cyan-400", bg: "bg-cyan-950/70", border: "border-cyan-500", glow: "shadow-cyan-500/30" },
  epic: { text: "text-purple-400", bg: "bg-purple-950/70", border: "border-purple-500", glow: "shadow-purple-500/40" },
  legendary: { text: "text-amber-400", bg: "bg-amber-950/70", border: "border-amber-500", glow: "shadow-amber-500/50" },
  mythic: { text: "text-rose-400", bg: "bg-rose-950/80", border: "border-rose-500", glow: "shadow-rose-500/60" },
  transcendent: { text: "text-fuchsia-300", bg: "bg-fuchsia-950/80", border: "border-fuchsia-400", glow: "shadow-fuchsia-500/70" },
};

export function getNextEvolutionStage(current: EvolutionStage): EvolutionStage | null {
  if (current === "awakened") return "evolved";
  if (current === "evolved") return "ascended";
  if (current === "ascended") return "transcendent";
  return null;
}

export function canEntityEvolve(entity: PlayerEntity): boolean {
  const next = getNextEvolutionStage(entity.stage);
  if (!next) return false;
  return entity.currentXp >= EVOLUTION_STAGES[next].minXp;
}

export function calculateEntityMatchXp(correctAnswers: number, won: boolean): number {
  const base = won ? 35 : 15;
  return base + correctAnswers * 6;
}
