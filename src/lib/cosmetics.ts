export type CosmeticSlot = "frame" | "badge" | "effect" | "title" | "card";

export interface CardThemeDesign {
  bgStart?: string;
  bgEnd?: string;
  bgAngle?: number;
  bgType?: "linear" | "radial";
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "double";
  borderRadius?: number;
  glowColor?: string;
  glowIntensity?: "none" | "soft" | "medium" | "intense" | "ultra";
  textColor?: string;
  accentColor?: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  pattern?: "none" | "dots" | "grid" | "diagonal" | "radial";
  description?: string;
}

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  style: string;
  price: number;
  active: boolean;
  iconName?: string;
  cardDesign?: CardThemeDesign;
}

export interface CoinPack {
  id: string;
  name: string;
  coins: number;
  amount: number;
  active: boolean;
}

export interface EconomySettings {
  enabled: boolean;
  cosmetics: Cosmetic[];
  packs: CoinPack[];
}

export interface CosmeticWallet {
  balance: number;
  owned: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
}

export interface TopupRequest {
  id: string;
  uid: string;
  username: string;
  packId: string;
  packName: string;
  coins: number;
  amount: number;
  sender: string;
  reference: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

export const EMPTY_WALLET: CosmeticWallet = { balance: 0, owned: [], equipped: {} };

const FRAMES: Cosmetic[] = [
  { id: "frame-sovereign", name: "Sovereign Crest", slot: "frame", style: "gold", price: 500, active: true },
  { id: "frame-imperial", name: "Imperial Laurel", slot: "frame", style: "gold", price: 450, active: true },
  { id: "frame-diamond-crown", name: "Diamond Crown", slot: "frame", style: "cyan", price: 600, active: true },
  { id: "frame-archon", name: "Archon Crest", slot: "frame", style: "gold", price: 550, active: true },
  { id: "frame-dragon", name: "Dragon Scale", slot: "frame", style: "ruby", price: 650, active: true },
  { id: "frame-phoenix", name: "Phoenix Wing", slot: "frame", style: "amber", price: 650, active: true },
  { id: "frame-valkyrie", name: "Valkyrie Gold", slot: "frame", style: "gold", price: 500, active: true },
  { id: "frame-pharaoh", name: "Pharaoh Regalia", slot: "frame", style: "gold", price: 550, active: true },
  { id: "frame-knight", name: "Knight Steel", slot: "frame", style: "silver", price: 350, active: true },
  { id: "frame-samurai", name: "Samurai Crest", slot: "frame", style: "ruby", price: 500, active: true },
  { id: "frame-cyber-hex", name: "Cyber Hex", slot: "frame", style: "neon", price: 400, active: true },
  { id: "frame-matrix", name: "Matrix Grid", slot: "frame", style: "emerald", price: 420, active: true },
  { id: "frame-neon-pulse", name: "Neon Pulse", slot: "frame", style: "violet", price: 400, active: true },
  { id: "frame-holo-shard", name: "Holo Shard", slot: "frame", style: "cyan", price: 450, active: true },
  { id: "frame-quantum", name: "Quantum Ring", slot: "frame", style: "sapphire", price: 500, active: true },
  { id: "frame-plasma", name: "Plasma Coil", slot: "frame", style: "rose", price: 420, active: true },
  { id: "frame-overdrive", name: "Overdrive Core", slot: "frame", style: "amber", price: 480, active: true },
  { id: "frame-synthwave", name: "Synthwave Grid", slot: "frame", style: "violet", price: 450, active: true },
  { id: "frame-glitch", name: "Glitch Edge", slot: "frame", style: "neon", price: 400, active: true },
  { id: "frame-laser-tag", name: "Laser Sight", slot: "frame", style: "ruby", price: 380, active: true },
  { id: "frame-inferno", name: "Inferno Ring", slot: "frame", style: "ruby", price: 550, active: true },
  { id: "frame-blaze", name: "Solar Blaze", slot: "frame", style: "amber", price: 500, active: true },
  { id: "frame-magma", name: "Magma Forge", slot: "frame", style: "ruby", price: 480, active: true },
  { id: "frame-frost", name: "Glacial Ice", slot: "frame", style: "cyan", price: 480, active: true },
  { id: "frame-blizzard", name: "Blizzard Crown", slot: "frame", style: "silver", price: 520, active: true },
  { id: "frame-tempest", name: "Tempest Storm", slot: "frame", style: "sapphire", price: 500, active: true },
  { id: "frame-lightning", name: "Thunder Bolt", slot: "frame", style: "gold", price: 550, active: true },
  { id: "frame-meteor", name: "Meteor Trail", slot: "frame", style: "amber", price: 500, active: true },
  { id: "frame-earthquake", name: "Rupture Stone", slot: "frame", style: "obsidian", price: 420, active: true },
  { id: "frame-oceanic", name: "Ocean Trench", slot: "frame", style: "sapphire", price: 450, active: true },
  { id: "frame-cosmic-ring", name: "Cosmic Orbit", slot: "frame", style: "violet", price: 600, active: true },
  { id: "frame-nebula", name: "Nebula Veil", slot: "frame", style: "rose", price: 580, active: true },
  { id: "frame-supernova", name: "Supernova Flare", slot: "frame", style: "gold", price: 650, active: true },
  { id: "frame-blackhole", name: "Singularity", slot: "frame", style: "obsidian", price: 700, active: true },
  { id: "frame-starlight", name: "Starlight Halo", slot: "frame", style: "silver", price: 500, active: true },
  { id: "frame-eclipse", name: "Solar Eclipse", slot: "frame", style: "obsidian", price: 620, active: true },
  { id: "frame-aurora", name: "Northern Glow", slot: "frame", style: "emerald", price: 540, active: true },
  { id: "frame-pulsar", name: "Pulsar Beam", slot: "frame", style: "cyan", price: 560, active: true },
  { id: "frame-void", name: "Void Walker", slot: "frame", style: "obsidian", price: 680, active: true },
  { id: "frame-galaxy", name: "Spiral Galaxy", slot: "frame", style: "violet", price: 620, active: true },
  { id: "frame-seraph", name: "Seraph Halo", slot: "frame", style: "gold", price: 580, active: true },
  { id: "frame-abyss", name: "Abyssal Thorn", slot: "frame", style: "obsidian", price: 520, active: true },
  { id: "frame-spectral", name: "Spectral Wisp", slot: "frame", style: "cyan", price: 460, active: true },
  { id: "frame-phantom", name: "Phantom Shroud", slot: "frame", style: "violet", price: 480, active: true },
  { id: "frame-runic", name: "Elder Rune", slot: "frame", style: "sapphire", price: 500, active: true },
  { id: "frame-mystic", name: "Mystic Sigil", slot: "frame", style: "emerald", price: 480, active: true },
  { id: "frame-celestial", name: "Celestial Dawn", slot: "frame", style: "gold", price: 600, active: true },
  { id: "frame-chronos", name: "Time Wheel", slot: "frame", style: "amber", price: 550, active: true },
  { id: "frame-aegis", name: "Aegis Shield", slot: "frame", style: "silver", price: 480, active: true },
  { id: "frame-infinity", name: "Infinity Knot", slot: "frame", style: "violet", price: 750, active: true },
];

const BADGES: Cosmetic[] = [
  { id: "badge-crown", name: "Monarch Crown", slot: "badge", style: "gold", price: 300, active: true, iconName: "Crown" },
  { id: "badge-trophy", name: "Golden Cup", slot: "badge", style: "gold", price: 300, active: true, iconName: "Trophy" },
  { id: "badge-medal", name: "Grand Medal", slot: "badge", style: "amber", price: 280, active: true, iconName: "Medal" },
  { id: "badge-award", name: "Honors Rosette", slot: "badge", style: "violet", price: 280, active: true, iconName: "Award" },
  { id: "badge-shield", name: "Knight Aegis", slot: "badge", style: "silver", price: 250, active: true, iconName: "Shield" },
  { id: "badge-swords", name: "Duelist Blades", slot: "badge", style: "ruby", price: 320, active: true, iconName: "Swords" },
  { id: "badge-target", name: "Bullseye Cross", slot: "badge", style: "ruby", price: 260, active: true, iconName: "Target" },
  { id: "badge-flame", name: "Eternal Flame", slot: "badge", style: "amber", price: 350, active: true, iconName: "Flame" },
  { id: "badge-zap", name: "Thunder Bolt", slot: "badge", style: "gold", price: 280, active: true, iconName: "Zap" },
  { id: "badge-gem", name: "Royal Diamond", slot: "badge", style: "cyan", price: 400, active: true, iconName: "Gem" },
  { id: "badge-sparkles", name: "Pure Starlight", slot: "badge", style: "silver", price: 250, active: true, iconName: "Sparkles" },
  { id: "badge-star", name: "Champion Star", slot: "badge", style: "gold", price: 300, active: true, iconName: "Star" },
  { id: "badge-heart", name: "Heart of Gold", slot: "badge", style: "rose", price: 260, active: true, iconName: "Heart" },
  { id: "badge-skull", name: "Reaper Mark", slot: "badge", style: "obsidian", price: 350, active: true, iconName: "Skull" },
  { id: "badge-ghost", name: "Shadow Phantom", slot: "badge", style: "cyan", price: 320, active: true, iconName: "Ghost" },
  { id: "badge-anchor", name: "Iron Anchor", slot: "badge", style: "sapphire", price: 240, active: true, iconName: "Anchor" },
  { id: "badge-feather", name: "Phoenix Plume", slot: "badge", style: "amber", price: 280, active: true, iconName: "Feather" },
  { id: "badge-compass", name: "Pathfinder", slot: "badge", style: "gold", price: 270, active: true, iconName: "Compass" },
  { id: "badge-key", name: "Master Key", slot: "badge", style: "gold", price: 290, active: true, iconName: "Key" },
  { id: "badge-lock", name: "Vault Keeper", slot: "badge", style: "silver", price: 260, active: true, iconName: "Lock" },
  { id: "badge-rocket", name: "Cosmic Ascent", slot: "badge", style: "ruby", price: 340, active: true, iconName: "Rocket" },
  { id: "badge-hourglass", name: "Chrono Sands", slot: "badge", style: "amber", price: 280, active: true, iconName: "Hourglass" },
  { id: "badge-eye", name: "All-Seeing Eye", slot: "badge", style: "violet", price: 330, active: true, iconName: "Eye" },
  { id: "badge-sun", name: "Solar Radiance", slot: "badge", style: "gold", price: 300, active: true, iconName: "Sun" },
  { id: "badge-moon", name: "Lunar Crescent", slot: "badge", style: "silver", price: 280, active: true, iconName: "Moon" },
  { id: "badge-crosshair", name: "Sniper Focus", slot: "badge", style: "neon", price: 290, active: true, iconName: "Crosshair" },
  { id: "badge-dices", name: "High Roller", slot: "badge", style: "ruby", price: 310, active: true, iconName: "Dices" },
  { id: "badge-clover", name: "Lucky Clover", slot: "badge", style: "emerald", price: 270, active: true, iconName: "Clover" },
  { id: "badge-diamond", name: "Solitaire Jewel", slot: "badge", style: "cyan", price: 380, active: true, iconName: "Diamond" },
  { id: "badge-infinity", name: "Boundless", slot: "badge", style: "violet", price: 420, active: true, iconName: "Infinity" },
  { id: "badge-axe", name: "Viking Axe", slot: "badge", style: "silver", price: 280, active: true, iconName: "Axe" },
  { id: "badge-bomb", name: "Nitro Blast", slot: "badge", style: "ruby", price: 320, active: true, iconName: "Bomb" },
  { id: "badge-circuit", name: "Cyber Node", slot: "badge", style: "neon", price: 300, active: true, iconName: "Cpu" },
  { id: "badge-radioactive", name: "Hazard Core", slot: "badge", style: "amber", price: 320, active: true, iconName: "Radio" },
  { id: "badge-atom", name: "Quantum Atom", slot: "badge", style: "cyan", price: 340, active: true, iconName: "Atom" },
  { id: "badge-sparkle", name: "Gleam Mark", slot: "badge", style: "silver", price: 240, active: true, iconName: "Sparkle" },
  { id: "badge-flag", name: "Conqueror Banner", slot: "badge", style: "ruby", price: 260, active: true, iconName: "Flag" },
  { id: "badge-bell", name: "Triumph Chime", slot: "badge", style: "gold", price: 250, active: true, iconName: "Bell" },
  { id: "badge-shield-alert", name: "Bastion Guard", slot: "badge", style: "sapphire", price: 280, active: true, iconName: "ShieldAlert" },
  { id: "badge-shield-check", name: "Verified Ace", slot: "badge", style: "emerald", price: 300, active: true, iconName: "ShieldCheck" },
  { id: "badge-swords-crossed", name: "War Cry", slot: "badge", style: "ruby", price: 330, active: true, iconName: "Sword" },
  { id: "badge-bookmark", name: "Scholar Seal", slot: "badge", style: "violet", price: 240, active: true, iconName: "Bookmark" },
  { id: "badge-globe", name: "World Ranker", slot: "badge", style: "sapphire", price: 350, active: true, iconName: "Globe" },
  { id: "badge-fingerprint", name: "Cipher Ghost", slot: "badge", style: "neon", price: 310, active: true, iconName: "Fingerprint" },
  { id: "badge-radar", name: "Sonar Radar", slot: "badge", style: "emerald", price: 280, active: true, iconName: "Radar" },
  { id: "badge-magnet", name: "Coin Magnet", slot: "badge", style: "rose", price: 270, active: true, iconName: "Magnet" },
  { id: "badge-scale", name: "Grand Justice", slot: "badge", style: "gold", price: 310, active: true, iconName: "Scale" },
  { id: "badge-wand", name: "Mage Wand", slot: "badge", style: "violet", price: 320, active: true, iconName: "Wand2" },
  { id: "badge-trophy-gold", name: "Undisputed Champion", slot: "badge", style: "gold", price: 500, active: true, iconName: "Trophy" },
  { id: "badge-crown-diamond", name: "Imperial Sovereign", slot: "badge", style: "cyan", price: 550, active: true, iconName: "Crown" },
];

const EFFECTS: Cosmetic[] = [
  { id: "effect-gold-halo", name: "Sovereign Halo", slot: "effect", style: "gold", price: 450, active: true },
  { id: "effect-royal-shimmer", name: "Royal Shimmer", slot: "effect", style: "gold", price: 420, active: true },
  { id: "effect-sun-burst", name: "Solar Burst", slot: "effect", style: "amber", price: 480, active: true },
  { id: "effect-fire-aura", name: "Inferno Aura", slot: "effect", style: "ruby", price: 500, active: true },
  { id: "effect-ember-drift", name: "Ember Drift", slot: "effect", style: "ruby", price: 420, active: true },
  { id: "effect-magma-glow", name: "Magma Heat", slot: "effect", style: "amber", price: 440, active: true },
  { id: "effect-frost-haze", name: "Glacial Haze", slot: "effect", style: "cyan", price: 440, active: true },
  { id: "effect-arctic-mist", name: "Arctic Mist", slot: "effect", style: "silver", price: 400, active: true },
  { id: "effect-ocean-surge", name: "Abyssal Wave", slot: "effect", style: "sapphire", price: 460, active: true },
  { id: "effect-storm-charge", name: "Lightning Field", slot: "effect", style: "gold", price: 520, active: true },
  { id: "effect-cyber-pulse", name: "Neon Matrix", slot: "effect", style: "neon", price: 420, active: true },
  { id: "effect-synth-glow", name: "Synthwave Glow", slot: "effect", style: "violet", price: 440, active: true },
  { id: "effect-glitch-field", name: "Digital Glitch", slot: "effect", style: "neon", price: 400, active: true },
  { id: "effect-quantum-flux", name: "Quantum Flux", slot: "effect", style: "cyan", price: 480, active: true },
  { id: "effect-matrix-rain", name: "Data Cascade", slot: "effect", style: "emerald", price: 450, active: true },
  { id: "effect-void-smoke", name: "Dark Singularity", slot: "effect", style: "obsidian", price: 550, active: true },
  { id: "effect-cosmic-dust", name: "Cosmic Sparkles", slot: "effect", style: "violet", price: 480, active: true },
  { id: "effect-nebula-glow", name: "Nebula Mist", slot: "effect", style: "rose", price: 460, active: true },
  { id: "effect-supernova", name: "Supernova Flare", slot: "effect", style: "gold", price: 600, active: true },
  { id: "effect-blackhole-pulse", name: "Graviton Well", slot: "effect", style: "obsidian", price: 650, active: true },
  { id: "effect-emerald-pulse", name: "Emerald Radiance", slot: "effect", style: "emerald", price: 420, active: true },
  { id: "effect-jade-mist", name: "Jade Spirit", slot: "effect", style: "emerald", price: 400, active: true },
  { id: "effect-violet-flare", name: "Amethyst Pulse", slot: "effect", style: "violet", price: 440, active: true },
  { id: "effect-rose-shimmer", name: "Rose Quartz Shimmer", slot: "effect", style: "rose", price: 410, active: true },
  { id: "effect-spectral-veil", name: "Ghostly Veil", slot: "effect", style: "cyan", price: 450, active: true },
  { id: "effect-crimson-mist", name: "Blood Moon Glow", slot: "effect", style: "ruby", price: 480, active: true },
  { id: "effect-seraph-wings", name: "Seraph Light", slot: "effect", style: "gold", price: 520, active: true },
  { id: "effect-prismatic", name: "Prismatic Aura", slot: "effect", style: "cyan", price: 580, active: true },
  { id: "effect-aurora-borealis", name: "Aurora Crown", slot: "effect", style: "emerald", price: 530, active: true },
  { id: "effect-god-tier", name: "Immortal Radiance", slot: "effect", style: "gold", price: 800, active: true },
];

const TITLES: Cosmetic[] = [
  { id: "title-sovereign", name: "The Sovereign", slot: "title", style: "gold", price: 350, active: true },
  { id: "title-conqueror", name: "The Conqueror", slot: "title", style: "ruby", price: 350, active: true },
  { id: "title-archon", name: "Archon Prime", slot: "title", style: "gold", price: 400, active: true },
  { id: "title-warlord", name: "Iron Warlord", slot: "title", style: "ruby", price: 320, active: true },
  { id: "title-champion", name: "Grand Champion", slot: "title", style: "amber", price: 350, active: true },
  { id: "title-immortal", name: "The Immortal", slot: "title", style: "gold", price: 500, active: true },
  { id: "title-mythic", name: "Mythic Legend", slot: "title", style: "violet", price: 450, active: true },
  { id: "title-prodigy", name: "Quiz Prodigy", slot: "title", style: "cyan", price: 300, active: true },
  { id: "title-mastermind", name: "The Mastermind", slot: "title", style: "sapphire", price: 380, active: true },
  { id: "title-oracle", name: "All-Knowing Oracle", slot: "title", style: "emerald", price: 360, active: true },
  { id: "title-apex", name: "Apex Predator", slot: "title", style: "ruby", price: 380, active: true },
  { id: "title-celestial", name: "Celestial Being", slot: "title", style: "gold", price: 420, active: true },
  { id: "title-voidwalker", name: "Void Walker", slot: "title", style: "obsidian", price: 400, active: true },
  { id: "title-phantom", name: "The Phantom", slot: "title", style: "cyan", price: 320, active: true },
  { id: "title-glitch", name: "Glitch King", slot: "title", style: "neon", price: 320, active: true },
  { id: "title-cybergod", name: "Cyber Deity", slot: "title", style: "neon", price: 450, active: true },
  { id: "title-unstoppable", name: "Unstoppable", slot: "title", style: "amber", price: 360, active: true },
  { id: "title-diamond", name: "Diamond Blood", slot: "title", style: "cyan", price: 420, active: true },
  { id: "title-zenith", name: "At The Zenith", slot: "title", style: "violet", price: 450, active: true },
  { id: "title-undefeated", name: "The Undefeated", slot: "title", style: "gold", price: 600, active: true },
];

export const CARD_PRESET_TEMPLATES: Record<string, CardThemeDesign> = {
  gold: {
    bgStart: "#141108",
    bgEnd: "#2a220e",
    bgAngle: 135,
    bgType: "linear",
    borderColor: "#d4af37",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(212, 175, 55, 0.4)",
    glowIntensity: "medium",
    textColor: "#fef3c7",
    accentColor: "#fbbf24",
    badgeText: "VIP",
    badgeBg: "#d4af37",
    badgeColor: "#000000",
    pattern: "diagonal",
    description: "Deep noir brushed with imperial burnished gold and regal metallic border.",
  },
  cyber: {
    bgStart: "#030f14",
    bgEnd: "#062b33",
    bgAngle: 145,
    bgType: "linear",
    borderColor: "#00f0ff",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 18,
    glowColor: "rgba(0, 240, 255, 0.5)",
    glowIntensity: "intense",
    textColor: "#cffafe",
    accentColor: "#22d3ee",
    badgeText: "CYBER",
    badgeBg: "#00f0ff",
    badgeColor: "#021217",
    pattern: "grid",
    description: "High-octane neon cyan circuitry with electric edge glow.",
  },
  dragon: {
    bgStart: "#1c0406",
    bgEnd: "#3a090e",
    bgAngle: 135,
    bgType: "linear",
    borderColor: "#ff2244",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(255, 34, 68, 0.45)",
    glowIntensity: "intense",
    textColor: "#ffe4e6",
    accentColor: "#fb7185",
    badgeText: "MYTHIC",
    badgeBg: "#ff2244",
    badgeColor: "#ffffff",
    pattern: "dots",
    description: "Blood-red volcanic molten core forged in the heat of dragon fire.",
  },
  celestial: {
    bgStart: "#0a061c",
    bgEnd: "#1a0f3d",
    bgAngle: 160,
    bgType: "linear",
    borderColor: "#a855f7",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 22,
    glowColor: "rgba(168, 85, 247, 0.45)",
    glowIntensity: "medium",
    textColor: "#f3e8ff",
    accentColor: "#c084fc",
    badgeText: "VOID",
    badgeBg: "#a855f7",
    badgeColor: "#0f0728",
    pattern: "radial",
    description: "Interstellar deep purple void sprinkled with distant starlight nebulae.",
  },
  emerald: {
    bgStart: "#04140b",
    bgEnd: "#0b2e1a",
    bgAngle: 135,
    bgType: "linear",
    borderColor: "#10b981",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(16, 185, 129, 0.4)",
    glowIntensity: "medium",
    textColor: "#d1fae5",
    accentColor: "#34d399",
    badgeText: "JADE",
    badgeBg: "#10b981",
    badgeColor: "#021a0d",
    pattern: "grid",
    description: "Imperial jade matrix with opulent emerald luminescence.",
  },
  glacial: {
    bgStart: "#07131e",
    bgEnd: "#0e2a3f",
    bgAngle: 140,
    bgType: "linear",
    borderColor: "#38bdf8",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(56, 189, 248, 0.4)",
    glowIntensity: "medium",
    textColor: "#e0f2fe",
    accentColor: "#7dd3fc",
    badgeText: "FROST",
    badgeBg: "#38bdf8",
    badgeColor: "#051624",
    pattern: "dots",
    description: "Sub-zero diamond frost with crystalline blue luminescence.",
  },
  solar: {
    bgStart: "#1a0e03",
    bgEnd: "#3a1f06",
    bgAngle: 130,
    bgType: "linear",
    borderColor: "#f59e0b",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(245, 158, 11, 0.45)",
    glowIntensity: "medium",
    textColor: "#fef3c7",
    accentColor: "#fde68a",
    badgeText: "SOLAR",
    badgeBg: "#f59e0b",
    badgeColor: "#1c0d02",
    pattern: "radial",
    description: "Supercharged solar flare with intense warmth and radiant amber light.",
  },
  obsidian: {
    bgStart: "#09090b",
    bgEnd: "#18181b",
    bgAngle: 180,
    bgType: "linear",
    borderColor: "#52525b",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(255, 255, 255, 0.15)",
    glowIntensity: "soft",
    textColor: "#fafafa",
    accentColor: "#a1a1aa",
    badgeText: "STEALTH",
    badgeBg: "#27272a",
    badgeColor: "#ffffff",
    pattern: "none",
    description: "Ultra-clean stealth obsidian matte with pure titanium edge.",
  },
  synthwave: {
    bgStart: "#1c0724",
    bgEnd: "#2e083c",
    bgAngle: 125,
    bgType: "linear",
    borderColor: "#ec4899",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(236, 72, 153, 0.45)",
    glowIntensity: "intense",
    textColor: "#fce7f3",
    accentColor: "#f472b6",
    badgeText: "RETRO",
    badgeBg: "#ec4899",
    badgeColor: "#1e0427",
    pattern: "diagonal",
    description: "Retro-futuristic dusk horizon with electric magenta glow.",
  },
  amethyst: {
    bgStart: "#12061e",
    bgEnd: "#280b43",
    bgAngle: 135,
    bgType: "linear",
    borderColor: "#c084fc",
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 20,
    glowColor: "rgba(192, 132, 252, 0.45)",
    glowIntensity: "medium",
    textColor: "#f3e8ff",
    accentColor: "#e9d5ff",
    badgeText: "ROYAL",
    badgeBg: "#c084fc",
    badgeColor: "#170627",
    pattern: "radial",
    description: "Regal sovereign amethyst with velvet purple depth and diamond shimmer.",
  },
};

const CARD_THEMES: Cosmetic[] = [
  { id: "card-gold", name: "Noir & Gold Luxe", slot: "card", style: "card-gold", price: 800, active: true, cardDesign: CARD_PRESET_TEMPLATES.gold },
  { id: "card-cyber", name: "Cyberpunk Matrix", slot: "card", style: "card-cyber", price: 750, active: true, cardDesign: CARD_PRESET_TEMPLATES.cyber },
  { id: "card-dragon", name: "Dragon Inferno", slot: "card", style: "card-dragon", price: 850, active: true, cardDesign: CARD_PRESET_TEMPLATES.dragon },
  { id: "card-celestial", name: "Celestial Void", slot: "card", style: "card-celestial", price: 900, active: true, cardDesign: CARD_PRESET_TEMPLATES.celestial },
  { id: "card-emerald", name: "Jade Sovereign", slot: "card", style: "card-emerald", price: 750, active: true, cardDesign: CARD_PRESET_TEMPLATES.emerald },
  { id: "card-glacial", name: "Glacial Frost", slot: "card", style: "card-glacial", price: 700, active: true, cardDesign: CARD_PRESET_TEMPLATES.glacial },
  { id: "card-solar", name: "Solar Aurora", slot: "card", style: "card-solar", price: 750, active: true, cardDesign: CARD_PRESET_TEMPLATES.solar },
  { id: "card-obsidian", name: "Obsidian Stealth", slot: "card", style: "card-obsidian", price: 650, active: true, cardDesign: CARD_PRESET_TEMPLATES.obsidian },
  { id: "card-synthwave", name: "Synthwave Dusk", slot: "card", style: "card-synthwave", price: 700, active: true, cardDesign: CARD_PRESET_TEMPLATES.synthwave },
  { id: "card-amethyst", name: "Royal Amethyst", slot: "card", style: "card-amethyst", price: 800, active: true, cardDesign: CARD_PRESET_TEMPLATES.amethyst },
];

export const DEFAULT_COSMETICS: Cosmetic[] = [...FRAMES, ...BADGES, ...EFFECTS, ...TITLES, ...CARD_THEMES];

export const DEFAULT_ECONOMY: EconomySettings = { enabled: false, cosmetics: DEFAULT_COSMETICS, packs: [] };

export function validPositive(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value <= 10000000;
}

export function getCardThemeStyle(c?: Cosmetic): React.CSSProperties {
  if (!c || c.slot !== "card") return {};
  const d = c.cardDesign;
  if (!d) return {};

  const style: React.CSSProperties = {};

  if (d.bgStart && d.bgEnd) {
    if (d.bgType === "radial") {
      style.background = `radial-gradient(circle at 50% 20%, ${d.bgEnd} 0%, ${d.bgStart} 100%)`;
    } else {
      style.background = `linear-gradient(${d.bgAngle ?? 135}deg, ${d.bgStart} 0%, ${d.bgEnd} 100%)`;
    }
  }

  if (d.borderColor) style.borderColor = d.borderColor;
  if (d.borderWidth) style.borderWidth = `${d.borderWidth}px`;
  if (d.borderStyle) style.borderStyle = d.borderStyle;
  if (d.borderRadius) style.borderRadius = `${d.borderRadius}px`;

  if (d.glowColor && d.glowIntensity && d.glowIntensity !== "none") {
    const spread =
      d.glowIntensity === "soft"
        ? "0 4px 20px -2px"
        : d.glowIntensity === "medium"
        ? "0 8px 30px 2px"
        : d.glowIntensity === "intense"
        ? "0 10px 42px 6px"
        : d.glowIntensity === "ultra"
        ? "0 0 55px 12px"
        : "0 8px 30px 2px";
    style.boxShadow = `${spread} ${d.glowColor}`;
  }

  if (d.textColor) style.color = d.textColor;

  return style;
}

export function normalizeEconomy(raw: unknown): EconomySettings {
  if (!raw || typeof raw !== "object") return DEFAULT_ECONOMY;
  const d = raw as Partial<EconomySettings>;
  const validPacks = Array.isArray(d.packs)
    ? d.packs.filter(
        p => p && typeof p.id === "string" && /^[a-z0-9_-]{1,60}$/.test(p.id) && typeof p.name === "string" && p.name.trim() && validPositive(p.coins) && validPositive(p.amount)
      )
    : [];

  const rawCosmetics = Array.isArray(d.cosmetics) ? d.cosmetics : [];

  // Merge default catalog items with stored overrides
  const mergedDefaults = DEFAULT_COSMETICS.map(base => {
    const custom = rawCosmetics.find(c => c && c.id === base.id);
    if (custom && validPositive(custom.price)) {
      return {
        ...base,
        price: custom.price,
        active: typeof custom.active === "boolean" ? custom.active : base.active,
        ...((custom.cardDesign ?? base.cardDesign) ? { cardDesign: custom.cardDesign ?? base.cardDesign } : {}),
      };
    }
    return base;
  });

  // Preserve admin-created custom cosmetics (such as new custom card themes)
  const customItems = rawCosmetics.filter(
    c =>
      c &&
      typeof c.id === "string" &&
      !DEFAULT_COSMETICS.some(base => base.id === c.id) &&
      typeof c.name === "string" &&
      c.name.trim() &&
      ["frame", "badge", "effect", "title", "card"].includes(c.slot) &&
      validPositive(c.price)
  );

  return { enabled: d.enabled === true, cosmetics: [...mergedDefaults, ...customItems], packs: validPacks };
}

export function purchaseWallet(wallet: CosmeticWallet, item: Cosmetic): CosmeticWallet {
  if (!item.active || !validPositive(item.price)) throw new Error("This cosmetic is not available.");
  if (wallet.owned.includes(item.id)) throw new Error("You already own this cosmetic.");
  if (!Number.isSafeInteger(wallet.balance) || wallet.balance < item.price) throw new Error("You need more Juvora coins.");
  return { ...wallet, balance: wallet.balance - item.price, owned: [...wallet.owned, item.id] };
}

export function creditWallet(wallet: CosmeticWallet, request: Pick<TopupRequest, "status" | "coins">): CosmeticWallet {
  if (request.status !== "pending") throw new Error("This transfer has already been reviewed.");
  if (!validPositive(request.coins) || !Number.isSafeInteger(wallet.balance) || wallet.balance < 0 || !Number.isSafeInteger(wallet.balance + request.coins))
    throw new Error("Invalid coin amount.");
  return { ...wallet, balance: wallet.balance + request.coins };
}

export function equipWallet(wallet: CosmeticWallet, slot: CosmeticSlot, item?: Cosmetic): CosmeticWallet {
  if (item && (item.slot !== slot || !wallet.owned.includes(item.id))) throw new Error("You can only equip a cosmetic you own in its matching slot.");
  const equipped = { ...wallet.equipped };
  if (item) equipped[slot] = item.id;
  else delete equipped[slot];
  return { ...wallet, equipped };
}
