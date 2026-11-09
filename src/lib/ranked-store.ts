import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { DEFAULT_RANKED, rankedConfig, type RankedConfig } from "./ranked";

/** Admin-tunable ranked settings live at settings/ranked; missing fields fall back to defaults. */
let cached: { at: number; cfg: RankedConfig } | null = null;
const TTL = 5 * 60 * 1000;

export async function getRankedConfig(db: Firestore, fresh = false): Promise<RankedConfig> {
  if (!fresh && cached && Date.now() - cached.at < TTL) return cached.cfg;
  try {
    const s = await getDoc(doc(db, "settings", "ranked"));
    const cfg = rankedConfig(s.exists() ? (s.data() as Partial<RankedConfig>) : null);
    cached = { at: Date.now(), cfg };
    return cfg;
  } catch {
    return cached?.cfg ?? DEFAULT_RANKED;
  }
}

export async function saveRankedConfig(db: Firestore, cfg: RankedConfig) {
  const clean = rankedConfig(cfg);
  await setDoc(doc(db, "settings", "ranked"), clean);
  cached = { at: Date.now(), cfg: clean };
}

export function useRankedConfig(db: Firestore | undefined): RankedConfig {
  const [cfg, setCfg] = useState<RankedConfig>(cached?.cfg ?? DEFAULT_RANKED);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    getRankedConfig(db).then((c) => alive && setCfg(c));
    return () => { alive = false; };
  }, [db]);
  return cfg;
}
