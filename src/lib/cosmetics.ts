export type CosmeticSlot = "frame" | "badge" | "effect";
export interface Cosmetic { id: string; name: string; slot: CosmeticSlot; style: string; price: number; active: boolean }
export interface CoinPack { id: string; name: string; coins: number; amount: number; active: boolean }
export interface EconomySettings { enabled: boolean; cosmetics: Cosmetic[]; packs: CoinPack[] }
export interface CosmeticWallet { balance: number; owned: string[]; equipped: Partial<Record<CosmeticSlot, string>> }
export interface TopupRequest { id: string; uid: string; username: string; packId: string; packName: string; coins: number; amount: number; sender: string; reference: string; status: "pending" | "approved" | "rejected"; createdAt: number; reviewedBy?: string; reviewedAt?: number }
export const EMPTY_WALLET: CosmeticWallet = { balance: 0, owned: [], equipped: {} };
export const DEFAULT_COSMETICS: Cosmetic[] = [
  { id: "sovereign", name: "Sovereign", slot: "frame", style: "gold", price: 500, active: true },
  { id: "ion", name: "Ion Circuit", slot: "frame", style: "cyan", price: 350, active: true },
  { id: "rose", name: "Rose Quartz", slot: "frame", style: "rose", price: 300, active: true },
  { id: "crown", name: "Royal Mind", slot: "badge", style: "gold", price: 250, active: true },
  { id: "bolt", name: "Quick Thinker", slot: "badge", style: "cyan", price: 200, active: true },
  { id: "halo", name: "Solar Halo", slot: "effect", style: "gold", price: 600, active: true },
];
export const DEFAULT_ECONOMY: EconomySettings = { enabled: false, cosmetics: DEFAULT_COSMETICS, packs: [] };
export function validPositive(value: number) { return Number.isSafeInteger(value) && value > 0 && value <= 10000000; }
export function normalizeEconomy(raw: unknown): EconomySettings {
  if (!raw || typeof raw !== "object") return DEFAULT_ECONOMY;
  const d = raw as Partial<EconomySettings>;
  return { enabled: d.enabled === true, cosmetics: Array.isArray(d.cosmetics) ? d.cosmetics.filter(c => c && DEFAULT_COSMETICS.some(x => x.id === c.id && x.slot === c.slot && x.style === c.style) && validPositive(c.price)) : DEFAULT_COSMETICS, packs: Array.isArray(d.packs) ? d.packs.filter(p => p && typeof p.id === "string" && /^[a-z0-9_-]{1,60}$/.test(p.id) && typeof p.name === "string" && p.name.trim() && validPositive(p.coins) && validPositive(p.amount)) : [] };
}
export function purchaseWallet(wallet: CosmeticWallet, item: Cosmetic): CosmeticWallet {
  if (!item.active || !validPositive(item.price)) throw new Error("This cosmetic is not available.");
  if (wallet.owned.includes(item.id)) throw new Error("You already own this cosmetic.");
  if (!Number.isSafeInteger(wallet.balance) || wallet.balance < item.price) throw new Error("You need more Juvora coins.");
  return { ...wallet, balance: wallet.balance - item.price, owned: [...wallet.owned, item.id] };
}
export function creditWallet(wallet: CosmeticWallet, request: Pick<TopupRequest, "status" | "coins">): CosmeticWallet {
  if (request.status !== "pending") throw new Error("This transfer has already been reviewed.");
  if (!validPositive(request.coins) || !Number.isSafeInteger(wallet.balance) || wallet.balance < 0 || !Number.isSafeInteger(wallet.balance + request.coins)) throw new Error("Invalid coin amount.");
  return { ...wallet, balance: wallet.balance + request.coins };
}
export function equipWallet(wallet: CosmeticWallet, slot: CosmeticSlot, item?: Cosmetic): CosmeticWallet {
  if (item && (item.slot !== slot || !wallet.owned.includes(item.id))) throw new Error("You can only equip a cosmetic you own in its matching slot.");
  const equipped = { ...wallet.equipped };
  if (item) equipped[slot] = item.id; else delete equipped[slot];
  return { ...wallet, equipped };
}