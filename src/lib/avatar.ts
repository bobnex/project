import { useEffect, useState } from "react";
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
  gender: "masculine" | "feminine" | "neutral";
  skinTone: string; // Hex color
  eyeColor: string; // Hex color
  faceShape: "sharp" | "oval" | "square";
  
  hairStyleId: string;
  hairColor: string; // Hex color
  facialHairId?: string;

  outfitId: string; // Torso & legs styling
  shoesId: string;  // Footwear
  headwearId?: string; // Cap, crown, helm, cyber visor
  backBlingId?: string; // Cape, wings, quiver, energy reactor
  
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
  modelMesh: string;
  colors?: string[];
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
  "#1f2937", // Obsidian Noir
  "#6366f1", // Cyber Indigo
];

export const DEFAULT_HAIR_COLORS = [
  "#18181b", // Jet Black
  "#451a03", // Dark Brunette
  "#78350f", // Chestnut
  "#f59e0b", // Gold Blonde
  "#e11d48", // Crimson Red
  "#06b6d4", // Neon Cyan
  "#8b5cf6", // Ultraviolet
  "#f43f5e", // Sakura Pink
];

export const DEFAULT_AVATAR_CONFIG: AvatarCustomization = {
  gender: "neutral",
  skinTone: DEFAULT_SKIN_TONES[1] ?? "#f1c27d",
  eyeColor: "#06b6d4",
  faceShape: "sharp",
  hairStyleId: "hair_fade",
  hairColor: DEFAULT_HAIR_COLORS[0] ?? "#18181b",
  outfitId: "outfit_combat_suit",
  shoesId: "shoes_sneakers",
  headwearId: "none",
  backBlingId: "none",
  poseId: "idle",
  vfxAuraId: "none",
  updatedAt: Date.now(),
};

export const AVATAR_CATALOG: AvatarCatalogItem[] = [
  // Outfits
  { id: "outfit_combat_suit", category: "outfit", name: "Striker Tech Suit", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "outfit_basic", description: "Standard tactical combat gear for competitive arena battles." },
  { id: "outfit_stealth_ninja", category: "outfit", name: "Shadow Shinobi", rarity: "rare", priceCoins: 350, modelMesh: "outfit_ninja", description: "Sleek aerodynamic stealth weave engineered for swift reflexes." },
  { id: "outfit_cyber_armor", category: "outfit", name: "Cyber Aegis Exo-Suit", rarity: "epic", priceCoins: 750, modelMesh: "outfit_cyber", description: "Heavy cybernetic exoskeleton reinforced with pulsating neon circuits." },
  { id: "outfit_luxury_suit", category: "outfit", name: "High Roller Tuxedo", rarity: "legendary", priceCoins: 1200, modelMesh: "outfit_luxury", description: "Bespoke gold-trimmed formal attire fit for champion royalty." },
  { id: "outfit_void_lord", category: "outfit", name: "Nether Void Reaver", rarity: "mythic", priceCoins: 2500, modelMesh: "outfit_void", description: "Forged in the dark matter abyss. Radiates reality-bending energy." },

  // Hairstyles
  { id: "hair_fade", category: "hair", name: "Clean Razor Fade", rarity: "common", priceCoins: 0, unlockedByDefault: true, modelMesh: "hair_fade", description: "Sharp, timeless precision cut." },
  { id: "hair_cyber_spikes", category: "hair", name: "Cyber Punk Spikes", rarity: "uncommon", priceCoins: 150, modelMesh: "hair_spikes", description: "Electrified neon spiked hair." },
  { id: "hair_afro_crown", category: "hair", name: "Imperial Afro", rarity: "rare", priceCoins: 300, modelMesh: "hair_afro", description: "Voluminous, majestic silhouette." },
  { id: "hair_locs", category: "hair", name: "Battle Dreadlocks", rarity: "rare", priceCoins: 300, modelMesh: "hair_locs", description: "Tied back combat dreads with gold rings." },

  // Headwear
  { id: "head_cyber_visor", category: "headwear", name: "HUD Targeting Visor", rarity: "rare", priceCoins: 250, modelMesh: "head_visor", description: "Holographic real-time telemetry optic display." },
  { id: "head_golden_crown", category: "headwear", name: "Grand Monarch Crown", rarity: "legendary", priceCoins: 1000, modelMesh: "head_crown", description: "Pure 24k solid gold crown adorned with radiant diamonds." },

  // Back Bling
  { id: "back_cyber_wings", category: "backBling", name: "Photon Glider Wings", rarity: "epic", priceCoins: 600, modelMesh: "back_wings", description: "Hard-light holographic jet wings deployed during victory." },

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

// In-memory cache to guarantee 0 ms delay on lobby re-renders
const avatarCache = new Map<string, AvatarCustomization>();

/**
 * Reactive React hook to fetch and cache any player's 3D avatar
 */
export function usePlayerAvatar(db: Firestore | undefined, uid: string | undefined): AvatarCustomization {
  const [avatar, setAvatar] = useState<AvatarCustomization>(() => {
    if (uid && avatarCache.has(uid)) return avatarCache.get(uid)!;
    return DEFAULT_AVATAR_CONFIG;
  });

  useEffect(() => {
    if (!db || !uid) return;
    if (avatarCache.has(uid)) {
      setAvatar(avatarCache.get(uid)!);
      return;
    }
    let cancelled = false;
    getPlayerAvatar(db, uid).then((res) => {
      if (!cancelled) {
        avatarCache.set(uid, res);
        setAvatar(res);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, uid]);

  return avatar;
}
