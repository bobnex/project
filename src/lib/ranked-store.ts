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

  // Firestore throws "Unsupported field value: undefined" if any object property is undefined.
  // Strip all undefined properties before calling setDoc.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(clean)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  // Preserve backward compatibility with legacy .season field
  if (typeof clean.seasonNumber === "number" && clean.seasonNumber > 0) {
    payload.season = clean.seasonNumber;
  }

  await setDoc(doc(db, "settings", "ranked"), payload);
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
