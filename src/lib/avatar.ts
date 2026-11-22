export interface AvatarConfiguration {
  skinTone: string;
  hairstyle: string;
  face: string;
  outfit: string;
  shoes: string;
  accessory: string;
  pose: "idle" | "hero" | "victory" | "focus";
  effect: "none" | "aurora" | "spark" | "holo";
  rotation: number;
  zoom: number;
  updatedAt?: number;
}

export const DEFAULT_AVATAR: AvatarConfiguration = {
  skinTone: "#8d5a3e",
  hairstyle: "Crown",
  face: "Balanced",
  outfit: "Midnight",
  shoes: "Apex",
  accessory: "Nova",
  pose: "idle",
  effect: "none",
  rotation: 0,
  zoom: 1,
};
