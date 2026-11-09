import { describe, expect, it } from "vitest";
import { activeSponsors, normalizePayment, normalizeSponsors } from "@/lib/payment";

describe("payment details", () => {
  it("falls back to the ₦1000 Opay account when nothing is saved", () => {
    const p = normalizePayment(null);
    expect(p.fee).toBe(1000);
    expect(p.bank).toBe("Opay");
    expect(p.accountNumber).toBe("8107528980");
  });
  it("uses the admin's saved details", () => {
    const p = normalizePayment({ fee: 1500, bank: "GTBank", accountNumber: "0123 456 789", accountName: "Favoje Ltd" });
    expect(p).toMatchObject({ fee: 1500, bank: "GTBank", accountNumber: "0123456789", accountName: "Favoje Ltd" });
  });
  it("ignores a negative fee or blank bank", () => {
    const p = normalizePayment({ fee: -5, bank: "  " });
    expect(p.fee).toBe(1000);
    expect(p.bank).toBe("Opay");
  });
});

describe("sponsors", () => {
  it("drops nameless sponsors and non-https links", () => {
    const s = normalizeSponsors([{ name: "" }, { id: "a", name: "Acme", website: "javascript:alert(1)", logoUrl: "https://x.com/l.png" }]);
    expect(s).toHaveLength(1);
    expect(s[0].website).toBe("");
    expect(s[0].logoUrl).toBe("https://x.com/l.png");
  });
  it("only shows active sponsors", () => {
    const s = normalizeSponsors([{ id: "a", name: "A" }, { id: "b", name: "B", active: false }]);
    expect(activeSponsors(s).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("sponsor rotation", () => {
  const mk = (name: string, active = true) => ({ id: name, name, tagline: "", logoUrl: "", website: "", active });
  it("shows one active sponsor at a time, cycling and skipping switched-off ones", async () => {
    const { pickSponsor } = await import("@/lib/payment");
    const list = [mk("A"), mk("B", false), mk("C")];
    expect(pickSponsor(list, 0)?.name).toBe("A");
    expect(pickSponsor(list, 1)?.name).toBe("C");
    expect(pickSponsor(list, 2)?.name).toBe("A");
  });
  it("shows nothing when no sponsor is active", async () => {
    const { pickSponsor } = await import("@/lib/payment");
    expect(pickSponsor([mk("A", false)], 0)).toBeNull();
  });
});
