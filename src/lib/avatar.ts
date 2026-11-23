import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";

export type AvatarRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export const RARITY_COLORS: Record<AvatarRarity, { text: string; bg: string; border: string; glow: string }> = {
  common: { text: "text-zinc-400", bg: "bg-zinc-800/80", border: "border-zinc-600", glow: "shadow-zinc-500/20" },
  uncommon: { text: "text-emerald-400", bg: "bg-emerald-950/70", border: "border-emerald-500", glow: "shadow-emerald-500/30" },
  rare: { text: "text-cyan-400", bg: "bg-cyan-950/70", border: "border-cyan-500", glow: "shadow-cyan-500/30" },
  epic: { text: "text-purple-400", bg: "bg-purple-950/70", border: "border-purple-500", glow: "shadow-purple-500/40" },
  legendary: { text: "text-amber-400", bg: "bg-amber-950/70", border: "border-amber-500", glow: "shadow-amber-500/50" },
  mythic: { text: "text-rose-400", bg: "bg-rose-950/80", border: "border-rose-500", glow: "shadow-rose-500/60" },
};

export interface AvatarCustomization {
  // Body & Face
  gender: "masculine" | "feminine" | "neutral";
  skinTone: string; // Hex color
  eyeColor: string; // Hex color
  faceShape: "sharp" | "oval" | "square";
  
  // Hair
  hairStyleId: string;
  hairColor: string; // Hex color
  facialHairId?: string;

  // Wardrobe & Gear
  outfitId: string; // Torso & legs styling
  shoesId: string;  // Footwear
  headwearId?: string; // Cap, crown, helm, cyber visor
  backBlingId?: string; // Cape, wings, quiver, energy reactor
  
  // Style & Dynamics
  poseId: string; // idle | victory | combat | levitate | dance
  vfxAuraId?: string; // none | sparks | golden_glow | void_mist | fire_ember
  updatedAt: number;
}

export interface AvatarCatalogItem {
  id: string;
  category: "hair" | "outfit" | "shoes" | "headwear" | "backBling" | "pose" | "vfx";
  name: string;
  rarity: AvatarRarity;
  priceCoins: number;
  unlockedByDefault?: boolean;
  modelMesh: string; // Procedural 3D mesh generator key
  colors?: string[]; // Allowed accent colors
  iconUrl?: string;
  description: string;
}

export const DEFAULT_SKIN_TONES = [
  "#fcd5b4", // Fair
  "#f1c27d", // Peach Warm
  "#e0ac69", // Golden Bronze
  "#c68642", // Warm Ochre
  "#8d5524", // Rich Caramel
  "#513217", // Deep Espresso
  "#1f2937", // Obsidian Noir (Fantasy)
  "#6366f1", // Cyber Indigo (Mythic)
];

export const DEFAULT_HAIR_COLORS = [
  "#111827", // Jet Black
  "#4b2e18", // Dark Espresso
  "#854d0e", // Honey Blonde
  "#b91c1c", // Crimson Red
  "#9333ea", // Neon Purple
  "#06b6d4", // Cyan Frost
  "#e2e8f0", // Platinum Silver
  "#eab308", // Cyber Gold
];

export const DEFAULT_AVATAR_CONFIG: AvatarCustomization = {
  gender: "masculine",
  skinTone: "#c68642",
  eyeColor: "#06b6d4",
  faceShape: "sharp",
  hairStyleId: "hair_fade",
  hairColor: "#111827",
  outfitId: "outfit_rookie",
  shoesId: "shoes_sneakers",
  headwearId: undefined,
  backBlingId: undefined,
  poseId: "pose_idle",
  vfxAuraId: undefined,
  updatedAt: Date.now(),
};

export const AVATAR_CATALOG: AvatarCatalogItem[] = [
  // Hairstyles
  { id: "hair_fade", category: "hair", name: "Sharp High Fade", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "fade", description: "Clean tapered look for combat focus." },
  { id: "hair_locs", category: "hair", name: "High Bun Locs", rarity: "rare", priceCoins: 150, modelMesh: "locs", description: "Braided warrior bun with gold clasps." },
  { id: "hair_cyber_spikes", category: "hair", name: "Cyber Spikes", rarity: "epic", priceCoins: 300, modelMesh: "spikes", description: "Gravity-defying neon-tipped spikes." },
  { id: "hair_sleek_pony", category: "hair", name: "Valkyrie Ponytail", rarity: "uncommon", priceCoins: 100, modelMesh: "ponytail", description: "High swept athletic battle ponytail." },
  { id: "hair_afro_crown", category: "hair", name: "Afro Apex", rarity: "epic", priceCoins: 350, modelMesh: "afro", description: "Crisp sculptured afro with sharp temple lines." },
  { id: "hair_divine_mane", category: "hair", name: "Celestial Flow", rarity: "mythic", priceCoins: 1200, modelMesh: "celestial_flow", description: "Glowing animated hair woven from star remnants." },

  // Outfits
  { id: "outfit_rookie", category: "outfit", name: "Juvora Recruit", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "cadet", description: "Standard tactical combat suit." },
  { id: "outfit_stealth_ninja", category: "outfit", name: "Shadow Operative", rarity: "rare", priceCoins: 280, modelMesh: "stealth", description: "Kevlar tactical coat with gold trims." },
  { id: "outfit_cyber_armor", category: "outfit", name: "Neo-Titan Exosuit", rarity: "epic", priceCoins: 600, modelMesh: "cyber_exosuit", description: "Full reinforced plating with pulsing core." },
  { id: "outfit_luxury_suit", category: "outfit", name: "Midnight Monarch", rarity: "legendary", priceCoins: 950, modelMesh: "luxury_tux", description: "Velvet tailored trench with gilded lapels." },
  { id: "outfit_void_lord", category: "outfit", name: "Abyssal Sovereign", rarity: "mythic", priceCoins: 2000, modelMesh: "void_armor", description: "Floating dark matter armor radiating dark violet embers." },

  // Shoes
  { id: "shoes_sneakers", category: "shoes", name: "Volt Runners", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "runners", description: "Lightweight agile sprint sneakers." },
  { id: "shoes_boots", category: "shoes", name: "Vanguard Stompers", rarity: "uncommon", priceCoins: 120, modelMesh: "tactical_boots", description: "Heavy combat boots built for battle." },
  { id: "shoes_hover_kicks", category: "shoes", name: "Aero Gravity Kicks", rarity: "epic", priceCoins: 450, modelMesh: "hover_kicks", description: "Footwear with levitation thrusters." },

  // Headwear & Accessories
  { id: "head_cyber_visor", category: "headwear", name: "Holo Target Visor", rarity: "rare", priceCoins: 220, modelMesh: "holo_visor", description: "Augmented HUD with glowing reticle." },
  { id: "head_gold_crown", category: "headwear", name: "Imperial Crown", rarity: "legendary", priceCoins: 800, modelMesh: "crown", description: "Ancient solid gold crown encrusted with rubies." },
  { id: "head_oni_mask", category: "headwear", name: "Oni Spirit Mask", rarity: "epic", priceCoins: 500, modelMesh: "oni_mask", description: "Traditional demonic battle mask." },

  // Back Bling
  { id: "back_cyber_wings", category: "backBling", name: "Plasma Wings", rarity: "legendary", priceCoins: 1100, modelMesh: "plasma_wings", description: "Deployable energy wings with trail FX." },
  { id: "back_katana", category: "backBling", name: "Twin Muramasa", rarity: "epic", priceCoins: 480, modelMesh: "twin_blades", description: "Sheathed duel-master blades." },

  // Poses / Emotes
  { id: "pose_idle", category: "pose", name: "Battle Ready", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "pose_ready", description: "Focused fighter stance." },
  { id: "pose_victory", category: "pose", name: "Champion's Salute", rarity: "rare", priceCoins: 180, modelMesh: "pose_salute", description: "Triumphant raised fist with posture." },
  { id: "pose_levitate", category: "pose", name: "Zero-G Transcendence", rarity: "legendary", priceCoins: 750, modelMesh: "pose_levitate", description: "Floats effortlessly above ground." },

  // Visual Effects
  { id: "vfx_gold_sparks", category: "vfx", name: "Gilded Nova", rarity: "epic", priceCoins: 400, modelMesh: "vfx_sparks", description: "Bursting golden sparks surrounding the avatar." },
  { id: "vfx_void_aura", category: "vfx", name: "Dark Matter Vortex", rarity: "mythic", priceCoins: 1500, modelMesh: "vfx_void", description: "Dark cosmic swirl with floating nebulae." },
];

/**
 * Fetch avatar customization for any user
 */
export async function getPlayerAvatar(db: Firestore, uid: string): Promise<AvatarCustomization> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "profile", "avatar"));
    if (snap.exists()) {
      return { ...DEFAULT_AVATAR_CONFIG, ...(snap.data() as Partial<AvatarCustomization>) };
    }
  } catch (err) {
    console.warn("Avatar fetch fallback:", err);
  }
  return DEFAULT_AVATAR_CONFIG;
}

/**
 * Persist avatar changes securely in Firestore
 */
export async function savePlayerAvatar(db: Firestore, uid: string, config: AvatarCustomization): Promise<void> {
  const ref = doc(db, "users", uid, "profile", "avatar");
  await setDoc(ref, {
    ...config,
    updatedAt: Date.now(),
  }, { merge: true });
}
