// Registration fee paid by bank transfer, confirmed manually by an admin.
// The live values are admin-editable and stored on settings/app; these are the fallbacks.

export interface PaymentDetails {
  fee: number;
  bank: string;
  accountNumber: string;
  accountName: string;
  note: string;
  freeRegistration: boolean;
}

export const DEFAULT_PAYMENT: PaymentDetails = {
  fee: 500,
  bank: "Opay",
  accountNumber: "8107528980",
  accountName: "Balogun Daniel Ofuje",
  note: "An admin confirms your transfer before you can start playing.",
  freeRegistration: false,
};

/** @deprecated read settings.payment.fee instead */
export const REGISTRATION_FEE = DEFAULT_PAYMENT.fee;
/** @deprecated read settings.payment instead */
export const PAYMENT_BANK = { bank: DEFAULT_PAYMENT.bank, accountNumber: DEFAULT_PAYMENT.accountNumber, accountName: DEFAULT_PAYMENT.accountName };

export type PaymentStatus = "pending" | "confirmed" | "rejected";

/** Merges stored (possibly partial or blank) payment details onto the defaults. */
export function normalizePayment(raw: Partial<PaymentDetails> | null | undefined): PaymentDetails {
  const r = raw ?? {};
  const text = (v: unknown, d: string) => (typeof v === "string" && v.trim() ? v.trim() : d);
  const fee = Number(r.fee);
  return {
    fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_PAYMENT.fee,
    bank: text(r.bank, DEFAULT_PAYMENT.bank),
    accountNumber: text(r.accountNumber, DEFAULT_PAYMENT.accountNumber).replace(/\s+/g, ""),
    accountName: text(r.accountName, DEFAULT_PAYMENT.accountName),
    note: typeof r.note === "string" ? r.note.trim() : DEFAULT_PAYMENT.note,
    freeRegistration: Boolean(r.freeRegistration),
  };
}

/* ---------------- Battle sponsors ---------------- */

export interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  logoUrl: string;
  website: string;
  active: boolean;
}

export function newSponsor(): Sponsor {
  return { id: crypto.randomUUID(), name: "", tagline: "", logoUrl: "", website: "", active: true };
}

/** Cleans stored sponsors: drops nameless entries and unsafe links. */
export function normalizeSponsors(raw: unknown): Sponsor[] {
  if (!Array.isArray(raw)) return [];
  const url = (v: unknown) => (typeof v === "string" && /^https:\/\//i.test(v.trim()) ? v.trim() : "");
  return raw
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      id: String(s.id || s.name),
      name: s.name.trim(),
      tagline: typeof s.tagline === "string" ? s.tagline.trim() : "",
      logoUrl: url(s.logoUrl),
      website: url(s.website),
      active: s.active !== false,
    }));
}

export function activeSponsors(list: Sponsor[]): Sponsor[] {
  return list.filter((s) => s.active);
}

/** Rotation: shows one active sponsor at a time, cycling through the list. */
export function pickSponsor(list: Sponsor[], tick: number): Sponsor | null {
  const active = activeSponsors(list);
  if (!active.length) return null;
  const i = ((Math.floor(tick) % active.length) + active.length) % active.length;
  return active[i];
}
