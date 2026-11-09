import { describe, expect, it } from "vitest";
import { isAdminEmail } from "@/lib/app-context";
describe("admin email", () => {
  it("danilo@gmail.com is admin", () => expect(isAdminEmail("Danilo@gmail.com")).toBe(true));
  it("other emails are not admin", () => expect(isAdminEmail("someone@gmail.com")).toBe(false));
});
