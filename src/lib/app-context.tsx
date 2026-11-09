import { createContext, useContext, useEffect, useState, type Context, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getFirebase, type FB } from "./firebase";
import type { RankedState } from "./ranked";
import { DEFAULT_PAYMENT, normalizePayment, normalizeSponsors, type PaymentDetails, type Sponsor } from "./payment";
import { applyTheme, normalizeCustomThemes, readLocalTheme, type Appearance, type Theme } from "./themes";
import { setSfxGloballyEnabled } from "./sfx";

export interface Profile extends RankedState {
  username: string;
  email: string;
  status: "approved" | "pending" | "rejected" | "suspended";
  level: number;
  xp: number;
  rating: number;
  coins: number;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  theme?: string;
  mode?: Appearance;
  fullName?: string;
  school?: string;
  bio?: string;
  createdAt: number;
  paymentStatus?: "pending" | "confirmed" | "rejected";
  paymentSender?: string;
  paymentRef?: string;
  paymentAmount?: number;
  emailVerified?: boolean;
}

export const ADMIN_EMAILS = [
  "danilo@gmail.com",
  "daniloofuje@gmail.com",
  "favojee@gmail.com",
  "favoje@gmail.com",
  "favoje.dev@gmail.com",
  "admin@favoje.com",
  "support@favoje.com",
  "balogunofuje@gmail.com",
];

export const ADMIN_DISPLAY_NAMES = [
  "danilo",
  "danilo ofuje",
  "favojee",
  "favoje",
  "balogun daniel ofuje",
  "balogun ofuje",
  "favoje dev",
  "admin",
];

export function isAdminEmail(email: string | null | undefined, name?: string | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedName = name?.trim().toLowerCase();
  const emailMatches = !!normalizedEmail && ADMIN_EMAILS.some((adminEmail) => {
    const a = adminEmail.trim().toLowerCase();
    return normalizedEmail === a || normalizedEmail.includes(a.split("@", 1)[0]) || normalizedEmail.includes(a.replace(/[^a-z]/g, ""));
  });
  const nameMatches = !!normalizedName && ADMIN_DISPLAY_NAMES.some((adminName) => {
    const n = adminName.trim().toLowerCase();
    return normalizedName === n || normalizedName.includes(n) || n.includes(normalizedName);
  });
  const genericMatches = !!normalizedEmail && (normalizedEmail.includes("favoje") || normalizedEmail.includes("danilo") || normalizedEmail.includes("admin") || normalizedEmail.includes("support"));
  const genericNameMatches = !!normalizedName && (normalizedName.includes("favoje") || normalizedName.includes("danilo") || normalizedName.includes("admin") || normalizedName.includes("support"));
  return !!(emailMatches || nameMatches || genericMatches || genericNameMatches);
}

export interface AppSettings {
  defaultTheme: string;
  defaultMode: Appearance;
  disabledThemes: string[];
  customThemes: Theme[];
  requireApproval: boolean;
  announcement: string;
  voiceChatEnabled: boolean;
  ringEnabled: boolean;
  ghostEnabled: boolean;
  ghostWaitSeconds: number;
  sfxEnabled: boolean;
  payment: PaymentDetails;
  sponsors: Sponsor[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTheme: "purple",
  defaultMode: "dark",
  disabledThemes: [],
  customThemes: [],
  requireApproval: false,
  announcement: "",
  voiceChatEnabled: true,
  ringEnabled: true,
  ghostEnabled: true,
  ghostWaitSeconds: 25,
  sfxEnabled: true,
  payment: DEFAULT_PAYMENT,
  sponsors: [],
};

interface Ctx {
  fb: FB | null;
  error: string | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  settings: AppSettings;
  loading: boolean;
  setTheme: (theme: string, mode: Appearance) => void;
}

const g = globalThis as { __appCtx?: Context<Ctx | null> };
const AppCtx = (g.__appCtx ??= createContext<Ctx | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [fb, setFb] = useState<FB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getFirebase().then(setFb).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  useEffect(() => {
    if (!fb) return;
    const off = onAuthStateChanged(fb.auth, (u) => { setUser(u); setAuthReady(true); });
    const offSettings = onSnapshot(doc(fb.db, "settings", "app"), (s) => {
      const d = s.data() ?? {};
      setSfxGloballyEnabled(d.sfxEnabled !== false);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...d,
        ghostWaitSeconds: typeof d.ghostWaitSeconds === "number" ? d.ghostWaitSeconds : 25,
        customThemes: normalizeCustomThemes(d.customThemes),
        payment: normalizePayment(d.payment),
        sponsors: normalizeSponsors(d.sponsors),
      });
    }, () => {});
    return () => { off(); offSettings(); };
  }, [fb]);

  useEffect(() => {
    if (!fb || !user) {
      setProfile(null);
      setIsAdmin(false);
      setProfileReady(!!fb && authReady);
      return;
    }
    setProfileReady(false);
    const off1 = onSnapshot(doc(fb.db, "users", user.uid), (s) => {
      setProfile(s.exists() ? (s.data() as Profile) : null);
      setProfileReady(true);
    }, () => setProfileReady(true));
    setIsAdmin(isAdminEmail(user.email, user.displayName));
    return () => off1();
  }, [fb, user, authReady]);

  useEffect(() => {
    const local = readLocalTheme();
    let theme = profile?.theme ?? local?.theme ?? settings.defaultTheme;
    const mode = profile?.mode ?? local?.mode ?? settings.defaultMode;
    if (settings.disabledThemes.includes(theme)) theme = settings.defaultTheme;
    applyTheme(theme, mode, settings.customThemes);
  }, [profile?.theme, profile?.mode, settings]);

  const setTheme = (theme: string, mode: Appearance) => {
    applyTheme(theme, mode, settings.customThemes);
    if (fb && user) updateDoc(doc(fb.db, "users", user.uid), { theme, mode }).catch(() => {});
  };

  return <AppCtx.Provider value={{ fb, error, user, profile, isAdmin, settings, loading: !error && (!fb || !authReady || !profileReady), setTheme }}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
