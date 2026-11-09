import { describe, expect, it } from "vitest";
import { clampVoicePosition, voiceAvailable, voicePeers } from "@/lib/voice-rules";

describe("voice across game modes", () => {
  it.each(["classic", "duo", "rush"] as const)("enables %s voice in the lobby and battle", (mode) => {
    expect(voiceAvailable(mode, "waiting")).toBe(true);
    expect(voiceAvailable(mode, "countdown")).toBe(true);
    expect(voiceAvailable(mode, "active")).toBe(true);
    expect(voiceAvailable(mode, "completed")).toBe(false);
    expect(voiceAvailable(mode, "cancelled")).toBe(false);
  });
  it("connects all 49 other opted-in players in a 50-player Rush", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `u${i}`);
    expect(voicePeers("u0", ids, ids.map((uid) => ({ uid, sid: uid, at: 100_000 })), 100_000)).toHaveLength(49);
  });
  it("does not connect outsiders, self, or expired voice sessions", () => {
    expect(voicePeers("me", ["me", "friend", "old"], [
      { uid: "me", sid: "1", at: 100_000 },
      { uid: "friend", sid: "2", at: 100_000 },
      { uid: "stranger", sid: "3", at: 100_000 },
      { uid: "old", sid: "4", at: 0 },
    ], 100_000).map((m) => m.uid)).toEqual(["friend"]);
  });
  it("keeps movable controls inside the screen", () => {
    expect(clampVoicePosition(-100, 900, 200, 60, 360, 800)).toEqual({ x: 8, y: 732 });
    expect(clampVoicePosition(999, -50, 200, 60, 360, 800)).toEqual({ x: 152, y: 8 });
  });
});