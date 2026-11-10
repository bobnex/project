import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, setDoc, where, type Firestore } from "firebase/firestore";
import { useApp } from "./app-context";
import { creditWallet, DEFAULT_ECONOMY, EMPTY_WALLET, equipWallet, normalizeEconomy, purchaseWallet, type CosmeticSlot, type CosmeticWallet, type EconomySettings, type TopupRequest } from "./cosmetics";

export function useCosmetics() {
  const { fb, user } = useApp();
  const [settings, setSettings] = useState(DEFAULT_ECONOMY);
  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(false); setWallet(EMPTY_WALLET); setRequests([]); setError("");
    if (!fb || !user) return;
    let settingsReady = false, walletReady = false;
    const fail = () => { setError("The coin shop is unavailable. Ask an admin to check the shop access settings."); setReady(false); };
    const a = onSnapshot(doc(fb.db, "settings", "economy"), s => { setSettings(normalizeEconomy(s.data())); settingsReady = true; setReady(walletReady); }, fail);
    const b = onSnapshot(doc(fb.db, "cosmetic_wallets", user.uid), s => { setWallet(s.exists() ? s.data() as CosmeticWallet : EMPTY_WALLET); walletReady = true; setReady(settingsReady); }, fail);
    const c = onSnapshot(query(collection(fb.db, "coin_requests"), where("uid", "==", user.uid)), s => setRequests(s.docs.map(d => ({ ...d.data(), id: d.id }) as TopupRequest).sort((a,b) => b.createdAt - a.createdAt)), fail);
    return () => { a(); b(); c(); };
  }, [fb, user]);
  return { settings, wallet, requests, ready, error };
}

export async function submitTopup(db: Firestore, uid: string, username: string, packId: string, sender: string, reference: string) {
  if (!sender.trim() || !reference.trim() || sender.length > 100 || reference.length > 100) throw new Error("Enter the sender name and transfer reference (up to 100 characters each).");
  const normalized = reference.trim().toLowerCase();
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const id = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,"0")).join("");
  await runTransaction(db, async tx => {
    const config = await tx.get(doc(db, "settings", "economy"));
    const settings = normalizeEconomy(config.data());
    const pack = settings.packs.find(p => p.id === packId && p.active);
    if (!settings.enabled || !pack) throw new Error("This coin pack is not available.");
    const request = doc(db, "coin_requests", id);
    if ((await tx.get(request)).exists()) throw new Error("This transfer reference was already submitted.");
    tx.set(request, { uid, username, packId, packName: pack.name, coins: pack.coins, amount: pack.amount, sender: sender.trim(), reference: normalized, status: "pending", createdAt: Date.now() });
  });
}

export async function reviewTopup(db: Firestore, adminUid: string, id: string, approve: boolean) {
  await runTransaction(db, async tx => {
    const ref = doc(db, "coin_requests", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Transfer not found.");
    const request = snap.data() as TopupRequest;
    if (request.status !== "pending") throw new Error("This transfer has already been reviewed.");
    if (approve) {
      const walletRef = doc(db, "cosmetic_wallets", request.uid);
      const wallet = await tx.get(walletRef);
      tx.set(walletRef, creditWallet(wallet.exists() ? wallet.data() as CosmeticWallet : EMPTY_WALLET, request));
    }
    tx.update(ref, { status: approve ? "approved" : "rejected", reviewedBy: adminUid, reviewedAt: Date.now() });
  });
}

export async function buyCosmetic(db: Firestore, uid: string, id: string) {
  await runTransaction(db, async tx => {
    const settings = normalizeEconomy((await tx.get(doc(db, "settings", "economy"))).data());
    const item = settings.cosmetics.find(c => c.id === id);
    if (!settings.enabled || !item) throw new Error("This cosmetic is not available.");
    const ref = doc(db, "cosmetic_wallets", uid);
    const snap = await tx.get(ref);
    const wallet = snap.exists() ? snap.data() as CosmeticWallet : EMPTY_WALLET;
    tx.set(ref, purchaseWallet(wallet, item));
    tx.set(doc(db, "cosmetic_wallets", uid, "purchases", id), { itemId: id, price: item.price, createdAt: Date.now() });
  });
}

export async function equipCosmetic(db: Firestore, uid: string, slot: CosmeticSlot, id?: string) {
  await runTransaction(db, async tx => {
    const settings = normalizeEconomy((await tx.get(doc(db, "settings", "economy"))).data());
    const item = id ? settings.cosmetics.find(c => c.id === id) : undefined;
    if (id && !item) throw new Error("Cosmetic not found.");
    const ref = doc(db, "cosmetic_wallets", uid);
    const snap = await tx.get(ref);
    const wallet = snap.exists() ? snap.data() as CosmeticWallet : EMPTY_WALLET;
    tx.set(ref, equipWallet(wallet, slot, item));
  });
}

export async function saveEconomy(db: Firestore, settings: EconomySettings) {
  const cosmetics = Object.fromEntries(settings.cosmetics.map(c => [c.id, c]));
  const packs = Object.fromEntries(settings.packs.map(p => [p.id, p]));
  // Maps mirror the arrays for efficient price/slot checks in Firestore rules.
  await setDoc(doc(db, "settings", "economy"), { ...settings, catalog: cosmetics, coinPacks: packs });
}