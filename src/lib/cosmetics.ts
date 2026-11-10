export type CosmeticSlot = "frame" | "badge" | "effect" | "title" | "card";

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  style: string;
  price: number;
  active: boolean;
  iconName?: string;
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
  { id: "frame-celestial", name: "Celestial Halo", slot: "frame", style: "violet", price: 600, active: true },
  { id: "frame-rose", name: "Rose Quartz", slot: "frame", style: "rose", price: 300, active: true },
  { id: "frame-ion", name: "Ion Circuit", slot: "frame", style: "cyan", price: 350, active: true },
  { id: "frame-emerald", name: "Emerald Cut", slot: "frame", style: "emerald", price: 400, active: true },
  { id: "frame-ruby", name: "Ruby Crest", slot: "frame", style: "ruby", price: 450, active: true },
  { id: "frame-amethyst", name: "Amethyst Ring", slot: "frame", style: "violet", price: 400, active: true },
  { id: "frame-sapphire", name: "Sapphire Glow", slot: "frame", style: "cyan", price: 450, active: true },
  { id: "frame-platinum", name: "Platinum Polish", slot: "frame", style: "silver", price: 500, active: true },
  { id: "frame-titanium", name: "Titanium Edge", slot: "frame", style: "silver", price: 400, active: true },
  { id: "frame-bronze", name: "Ancient Bronze", slot: "frame", style: "amber", price: 250, active: true },
  { id: "frame-onyx", name: "Deep Onyx", slot: "frame", style: "obsidian", price: 500, active: true },
  { id: "frame-silver", name: "Pure Silver", slot: "frame", style: "silver", price: 300, active: true },
  { id: "frame-pearl", name: "Starlight Pearl", slot: "frame", style: "silver", price: 400, active: true },
  { id: "frame-topaz", name: "Topaz Spark", slot: "frame", style: "amber", price: 350, active: true },
  { id: "frame-opal", name: "Opal Prism", slot: "frame", style: "cyan", price: 450, active: true },
  { id: "frame-obsidian", name: "Obsidian Shadow", slot: "frame", style: "obsidian", price: 550, active: true },
  { id: "frame-inferno", name: "Inferno Flame", slot: "frame", style: "amber", price: 500, active: true },
  { id: "frame-cryo", name: "Cryo Frost", slot: "frame", style: "cyan", price: 400, active: true },
  { id: "frame-storm", name: "Electric Storm", slot: "frame", style: "cyan", price: 450, active: true },
  { id: "frame-toxic", name: "Toxic Surge", slot: "frame", style: "emerald", price: 350, active: true },
  { id: "frame-void", name: "Void Rift", slot: "frame", style: "violet", price: 600, active: true },
  { id: "frame-terra", name: "Terra Stone", slot: "frame", style: "amber", price: 300, active: true },
  { id: "frame-solar", name: "Solar Flare", slot: "frame", style: "gold", price: 500, active: true },
  { id: "frame-lunar", name: "Lunar Mist", slot: "frame", style: "silver", price: 400, active: true },
  { id: "frame-ocean", name: "Oceanic Wave", slot: "frame", style: "cyan", price: 350, active: true },
  { id: "frame-gale", name: "Gale Wind", slot: "frame", style: "silver", price: 300, active: true },
  { id: "frame-plasma", name: "Plasma Core", slot: "frame", style: "ruby", price: 550, active: true },
  { id: "frame-magma", name: "Magma Vein", slot: "frame", style: "amber", price: 450, active: true },
  { id: "frame-supernova", name: "Supernova Ring", slot: "frame", style: "gold", price: 700, active: true },
  { id: "frame-biohazard", name: "Biohazard", slot: "frame", style: "emerald", price: 350, active: true },
  { id: "frame-darkmatter", name: "Dark Matter", slot: "frame", style: "obsidian", price: 650, active: true },
  { id: "frame-neon", name: "Neon Grid", slot: "frame", style: "cyan", price: 400, active: true },
  { id: "frame-matrix", name: "Matrix Cipher", slot: "frame", style: "emerald", price: 450, active: true },
  { id: "frame-glitch", name: "Holo Glitch", slot: "frame", style: "violet", price: 500, active: true },
  { id: "frame-synthwave", name: "Synthwave Sunset", slot: "frame", style: "rose", price: 450, active: true },
  { id: "frame-pixel", name: "8-Bit Pixel", slot: "frame", style: "cyan", price: 300, active: true },
  { id: "frame-bubble", name: "Bubble Pop", slot: "frame", style: "cyan", price: 250, active: true },
  { id: "frame-comic", name: "Comic Ink", slot: "frame", style: "obsidian", price: 350, active: true },
  { id: "frame-starburst", name: "Starburst", slot: "frame", style: "gold", price: 400, active: true },
  { id: "frame-laser", name: "Laser Beam", slot: "frame", style: "ruby", price: 450, active: true },
  { id: "frame-carbon", name: "Carbon Fiber", slot: "frame", style: "obsidian", price: 350, active: true },
];

const BADGES: Cosmetic[] = [
  { id: "badge-crown", name: "Royal Crown", slot: "badge", style: "gold", price: 250, active: true, iconName: "Crown" },
  { id: "badge-bolt", name: "Quick Thinker", slot: "badge", style: "cyan", price: 200, active: true, iconName: "Zap" },
  { id: "badge-trophy", name: "Victory Trophy", slot: "badge", style: "gold", price: 300, active: true, iconName: "Trophy" },
  { id: "badge-medal", name: "Golden Medal", slot: "badge", style: "gold", price: 250, active: true, iconName: "Medal" },
  { id: "badge-star", name: "Champion Star", slot: "badge", style: "amber", price: 200, active: true, iconName: "Star" },
  { id: "badge-flame", name: "Wildfire", slot: "badge", style: "amber", price: 250, active: true, iconName: "Flame" },
  { id: "badge-skull", name: "Grim Skull", slot: "badge", style: "obsidian", price: 300, active: true, iconName: "Skull" },
  { id: "badge-target", name: "Bullseye", slot: "badge", style: "ruby", price: 200, active: true, iconName: "Target" },
  { id: "badge-shield", name: "Royal Shield", slot: "badge", style: "cyan", price: 220, active: true, iconName: "Shield" },
  { id: "badge-swords", name: "Dual Swords", slot: "badge", style: "ruby", price: 280, active: true, iconName: "Swords" },
  { id: "badge-book", name: "Open Book", slot: "badge", style: "cyan", price: 180, active: true, iconName: "BookOpen" },
  { id: "badge-brain", name: "Quantum Brain", slot: "badge", style: "rose", price: 350, active: true, iconName: "Brain" },
  { id: "badge-grad", name: "Graduation Cap", slot: "badge", style: "violet", price: 220, active: true, iconName: "GraduationCap" },
  { id: "badge-bulb", name: "Eureka Lightbulb", slot: "badge", style: "amber", price: 180, active: true, iconName: "Lightbulb" },
  { id: "badge-compass", name: "Navigator Compass", slot: "badge", style: "gold", price: 200, active: true, iconName: "Compass" },
  { id: "badge-quill", name: "Ancient Quill", slot: "badge", style: "silver", price: 180, active: true, iconName: "Feather" },
  { id: "badge-atom", name: "Atom Core", slot: "badge", style: "cyan", price: 260, active: true, iconName: "Atom" },
  { id: "badge-cpu", name: "Microchip", slot: "badge", style: "emerald", price: 240, active: true, iconName: "Cpu" },
  { id: "badge-scroll", name: "Sacred Scroll", slot: "badge", style: "amber", price: 200, active: true, iconName: "Scroll" },
  { id: "badge-calc", name: "Calculator", slot: "badge", style: "silver", price: 150, active: true, iconName: "Calculator" },
  { id: "badge-moon", name: "Crescent Moon", slot: "badge", style: "silver", price: 200, active: true, iconName: "Moon" },
  { id: "badge-sun", name: "Radiant Sun", slot: "badge", style: "gold", price: 250, active: true, iconName: "Sun" },
  { id: "badge-rocket", name: "Deep Space Rocket", slot: "badge", style: "ruby", price: 280, active: true, iconName: "Rocket" },
  { id: "badge-snow", name: "Ice Crystal", slot: "badge", style: "cyan", price: 180, active: true, iconName: "Snowflake" },
  { id: "badge-mountain", name: "Mountain Peak", slot: "badge", style: "silver", price: 180, active: true, iconName: "Mountain" },
  { id: "badge-clover", name: "Lucky Clover", slot: "badge", style: "emerald", price: 220, active: true, iconName: "Clover" },
  { id: "badge-gem", name: "Mystic Gem", slot: "badge", style: "rose", price: 300, active: true, iconName: "Gem" },
  { id: "badge-heart", name: "Warm Heart", slot: "badge", style: "rose", price: 180, active: true, iconName: "Heart" },
  { id: "badge-sparkles", name: "Twin Sparks", slot: "badge", style: "gold", price: 200, active: true, iconName: "Sparkles" },
  { id: "badge-infinity", name: "Infinity Loop", slot: "badge", style: "violet", price: 320, active: true, iconName: "Infinity" },
  { id: "badge-dice", name: "High Roller Dice", slot: "badge", style: "obsidian", price: 220, active: true, iconName: "Dices" },
  { id: "badge-key", name: "Master Key", slot: "badge", style: "gold", price: 240, active: true, iconName: "Key" },
  { id: "badge-lock", name: "Vault Lock", slot: "badge", style: "amber", price: 180, active: true, iconName: "Lock" },
  { id: "badge-anchor", name: "Iron Anchor", slot: "badge", style: "cyan", price: 200, active: true, iconName: "Anchor" },
  { id: "badge-eye", name: "All-Seeing Eye", slot: "badge", style: "violet", price: 300, active: true, iconName: "Eye" },
  { id: "badge-award", name: "Prestige Award", slot: "badge", style: "gold", price: 260, active: true, iconName: "Award" },
  { id: "badge-check", name: "Verified Mind", slot: "badge", style: "cyan", price: 350, active: true, iconName: "CheckCircle2" },
  { id: "badge-flag", name: "Battle Flag", slot: "badge", style: "ruby", price: 200, active: true, iconName: "Flag" },
  { id: "badge-flare", name: "Radiant Flare", slot: "badge", style: "amber", price: 240, active: true, iconName: "Flare" },
  { id: "badge-beacon", name: "Alert Beacon", slot: "badge", style: "ruby", price: 180, active: true, iconName: "AlertCircle" },
  { id: "badge-thunder", name: "Thunder Strike", slot: "badge", style: "amber", price: 220, active: true, iconName: "Zap" },
  { id: "badge-flametorch", name: "Flame Torch", slot: "badge", style: "amber", price: 200, active: true, iconName: "Flame" },
  { id: "badge-shieldguard", name: "Shield Guard", slot: "badge", style: "emerald", price: 220, active: true, iconName: "Shield" },
  { id: "badge-crosshair", name: "Crosshair Aim", slot: "badge", style: "ruby", price: 240, active: true, iconName: "Target" },
  { id: "badge-bookmark", name: "Bookmark Seal", slot: "badge", style: "violet", price: 160, active: true, iconName: "Bookmark" },
  { id: "badge-starnode", name: "Star Node", slot: "badge", style: "cyan", price: 200, active: true, iconName: "Star" },
  { id: "badge-crystal", name: "Aura Crystal", slot: "badge", style: "rose", price: 280, active: true, iconName: "Gem" },
  { id: "badge-hex", name: "Hex Ward", slot: "badge", style: "violet", price: 250, active: true, iconName: "Shield" },
  { id: "badge-orbit", name: "Orbit Node", slot: "badge", style: "cyan", price: 240, active: true, iconName: "Atom" },
  { id: "badge-crownmini", name: "Prince Crest", slot: "badge", style: "silver", price: 220, active: true, iconName: "Crown" },
];

const EFFECTS: Cosmetic[] = [
  { id: "effect-halo-solar", name: "Solar Halo", slot: "effect", style: "gold", price: 600, active: true },
  { id: "effect-halo-angelic", name: "Angelic Ring", slot: "effect", style: "silver", price: 650, active: true },
  { id: "effect-halo-cyber", name: "Cyber Orbit", slot: "effect", style: "cyan", price: 500, active: true },
  { id: "effect-halo-fire", name: "Ring of Fire", slot: "effect", style: "amber", price: 550, active: true },
  { id: "effect-halo-cryo", name: "Cryo Ring", slot: "effect", style: "cyan", price: 500, active: true },
  { id: "effect-halo-neon", name: "Neon Halo", slot: "effect", style: "rose", price: 500, active: true },
  { id: "effect-halo-void", name: "Void Vortex", slot: "effect", style: "violet", price: 700, active: true },
  { id: "effect-halo-prism", name: "Prism Ring", slot: "effect", style: "cyan", price: 600, active: true },
  { id: "effect-halo-starlight", name: "Starlight Orbit", slot: "effect", style: "silver", price: 550, active: true },
  { id: "effect-halo-crown", name: "Crown Halo", slot: "effect", style: "gold", price: 750, active: true },
  { id: "effect-aura-gold", name: "Golden Radiance", slot: "effect", style: "gold", price: 650, active: true },
  { id: "effect-aura-cyber", name: "Cyber Pulse", slot: "effect", style: "cyan", price: 550, active: true },
  { id: "effect-aura-fury", name: "Crimson Fury", slot: "effect", style: "ruby", price: 600, active: true },
  { id: "effect-aura-emerald", name: "Emerald Glow", slot: "effect", style: "emerald", price: 550, active: true },
  { id: "effect-aura-phantom", name: "Phantom Mist", slot: "effect", style: "violet", price: 650, active: true },
  { id: "effect-aura-cosmic", name: "Cosmic Shimmer", slot: "effect", style: "violet", price: 700, active: true },
  { id: "effect-aura-starlight", name: "Starlight Beacon", slot: "effect", style: "silver", price: 600, active: true },
  { id: "effect-aura-supernova", name: "Supernova Burst", slot: "effect", style: "gold", price: 800, active: true },
  { id: "effect-aura-hyperdrive", name: "Hyperdrive Glow", slot: "effect", style: "cyan", price: 650, active: true },
  { id: "effect-aura-shadow", name: "Shadow Veil", slot: "effect", style: "obsidian", price: 750, active: true },
  { id: "effect-part-sparkle", name: "Sparkle Dust", slot: "effect", style: "gold", price: 450, active: true },
  { id: "effect-part-electric", name: "Electric Arcs", slot: "effect", style: "cyan", price: 500, active: true },
  { id: "effect-part-embers", name: "Rising Embers", slot: "effect", style: "amber", price: 500, active: true },
  { id: "effect-part-runes", name: "Floating Runes", slot: "effect", style: "violet", price: 600, active: true },
  { id: "effect-part-petals", name: "Falling Petals", slot: "effect", style: "rose", price: 450, active: true },
  { id: "effect-part-glitch", name: "Glitch Wave", slot: "effect", style: "cyan", price: 550, active: true },
  { id: "effect-part-frost", name: "Frost Shards", slot: "effect", style: "silver", price: 450, active: true },
  { id: "effect-part-bubbles", name: "Bubble Stream", slot: "effect", style: "cyan", price: 400, active: true },
  { id: "effect-part-goldrain", name: "Golden Rain", slot: "effect", style: "gold", price: 700, active: true },
  { id: "effect-part-quantum", name: "Quantum Echo", slot: "effect", style: "violet", price: 650, active: true },
];

const TITLES: Cosmetic[] = [
  { id: "title-grandmaster", name: "The Grandmaster", slot: "title", style: "gold", price: 500, active: true },
  { id: "title-prodigy", name: "Quiz Prodigy", slot: "title", style: "cyan", price: 350, active: true },
  { id: "title-undefeated", name: "The Undefeated", slot: "title", style: "ruby", price: 600, active: true },
  { id: "title-brainiac", name: "Brainiac", slot: "title", style: "violet", price: 300, active: true },
  { id: "title-legend", name: "Campus Legend", slot: "title", style: "gold", price: 450, active: true },
  { id: "title-speed", name: "Speed Demon", slot: "title", style: "amber", price: 350, active: true },
  { id: "title-scholar", name: "The Scholar", slot: "title", style: "silver", price: 250, active: true },
  { id: "title-galaxy", name: "Galaxy Brain", slot: "title", style: "violet", price: 500, active: true },
  { id: "title-ironwill", name: "Iron Will", slot: "title", style: "silver", price: 300, active: true },
  { id: "title-tactician", name: "Master Tactician", slot: "title", style: "cyan", price: 400, active: true },
  { id: "title-nightowl", name: "Night Owl", slot: "title", style: "obsidian", price: 250, active: true },
  { id: "title-lightning", name: "Lightning Strike", slot: "title", style: "amber", price: 350, active: true },
  { id: "title-sovereign", name: "Sovereign Mind", slot: "title", style: "gold", price: 550, active: true },
  { id: "title-oracle", name: "The Oracle", slot: "title", style: "violet", price: 450, active: true },
  { id: "title-perfectionist", name: "Perfectionist", slot: "title", style: "emerald", price: 400, active: true },
  { id: "title-executioner", name: "The Executioner", slot: "title", style: "ruby", price: 500, active: true },
  { id: "title-unstoppable", name: "Unstoppable", slot: "title", style: "amber", price: 450, active: true },
  { id: "title-strategist", name: "Master Strategist", slot: "title", style: "cyan", price: 400, active: true },
  { id: "title-alchemist", name: "The Alchemist", slot: "title", style: "emerald", price: 350, active: true },
  { id: "title-immortal", name: "Immortal", slot: "title", style: "gold", price: 800, active: true },
];

const CARD_THEMES: Cosmetic[] = [
  { id: "card-goldy", name: "Noir & Gold Luxe", slot: "card", style: "card-gold", price: 800, active: true },
  { id: "card-cyber", name: "Cyberpunk Matrix", slot: "card", style: "card-cyber", price: 750, active: true },
  { id: "card-dragon", name: "Dragon Inferno", slot: "card", style: "card-dragon", price: 850, active: true },
  { id: "card-celestial", name: "Celestial Void", slot: "card", style: "card-celestial", price: 900, active: true },
  { id: "card-emerald", name: "Jade Sovereign", slot: "card", style: "card-emerald", price: 750, active: true },
  { id: "card-glacial", name: "Glacial Frost", slot: "card", style: "card-glacial", price: 700, active: true },
  { id: "card-solar", name: "Solar Aurora", slot: "card", style: "card-solar", price: 800, active: true },
  { id: "card-obsidian", name: "Obsidian Stealth", slot: "card", style: "card-obsidian", price: 750, active: true },
  { id: "card-synthwave", name: "Synthwave Dusk", slot: "card", style: "card-synthwave", price: 700, active: true },
  { id: "card-amethyst", name: "Royal Amethyst", slot: "card", style: "card-amethyst", price: 800, active: true },
];

export const DEFAULT_COSMETICS: Cosmetic[] = [...FRAMES, ...BADGES, ...EFFECTS, ...TITLES, ...CARD_THEMES];

export const DEFAULT_ECONOMY: EconomySettings = { enabled: false, cosmetics: DEFAULT_COSMETICS, packs: [] };

export function validPositive(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value <= 10000000;
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
  const mergedCosmetics = DEFAULT_COSMETICS.map(base => {
    const custom = rawCosmetics.find(c => c && c.id === base.id);
    if (custom && validPositive(custom.price)) {
      return { ...base, price: custom.price, active: typeof custom.active === "boolean" ? custom.active : base.active };
    }
    return base;
  });

  return { enabled: d.enabled === true, cosmetics: mergedCosmetics, packs: validPacks };
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
