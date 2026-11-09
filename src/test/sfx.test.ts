import { beforeEach, describe, expect, it } from "vitest";
import { isSfxOn, setSfxGloballyEnabled, setSfxOn } from "@/lib/sfx";

beforeEach(() => {
  localStorage.clear();
  setSfxGloballyEnabled(true);
  setSfxOn(true);
});

describe("sfx gating", () => {
  it("player can turn sounds off", () => {
    setSfxOn(false);
    expect(isSfxOn()).toBe(false);
  });

  it("admin master switch mutes sounds even when the player toggle is on", () => {
    setSfxGloballyEnabled(false);
    expect(isSfxOn()).toBe(false);
  });

  it("admin re-enabling restores the player's own choice", () => {
    setSfxGloballyEnabled(false);
    setSfxGloballyEnabled(true);
    expect(isSfxOn()).toBe(true);
  });

  it("a muted player stays muted after the admin re-enables sound", () => {
    setSfxOn(false);
    setSfxGloballyEnabled(false);
    setSfxGloballyEnabled(true);
    expect(isSfxOn()).toBe(false);
  });
});
