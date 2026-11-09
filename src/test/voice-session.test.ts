import { afterEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase/firestore";

const store = vi.hoisted(() => ({ setDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn().mockResolvedValue(undefined), listeners: [] as { ref: string; fn: (s: unknown) => void }[] }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
  collection: (_db: unknown, ...parts: string[]) => parts.join("/"),
  setDoc: store.setDoc, deleteDoc: store.deleteDoc,
  addDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: (ref: string, fn: (s: unknown) => void) => { store.listeners.push({ ref, fn }); return vi.fn(); },
}));
import { VoiceSession } from "@/lib/voice-session";

const tracks: { stop: ReturnType<typeof vi.fn>; enabled: boolean; onended: unknown }[] = [];
const pcs: FakePC[] = [];
class FakePC {
  connectionState = "new";
  remoteDescription: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack = null; onicecandidate = null;
  addTrack = vi.fn(); close = vi.fn();
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "test" });
  createAnswer = vi.fn().mockResolvedValue({ type: "answer", sdp: "answer" });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn(async (d) => { this.remoteDescription = d; });
  constructor() { pcs.push(this); }
}
function setup(getUserMedia?: () => Promise<unknown>) {
  const track = { stop: vi.fn(), enabled: true, onended: null as unknown };
  tracks.push(track);
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: getUserMedia ?? vi.fn().mockResolvedValue(stream) } });
  vi.stubGlobal("RTCPeerConnection", FakePC);
  vi.stubGlobal("crypto", { randomUUID: () => `session-${tracks.length}` });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  return { track, stream };
}
const db = {} as Firestore;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); store.listeners.length = 0; pcs.length = 0; tracks.length = 0; vi.clearAllMocks(); });
describe("voice session recovery", () => {
  it("releases microphone access resolved after leaving", async () => {
    let resolve: ((s: unknown) => void) | undefined;
    const { track, stream } = setup(() => new Promise((r) => { resolve = r; }));
    const session = new VoiceSession(db, "m", "a", ["a"], vi.fn(), vi.fn(), vi.fn());
    const joining = session.start(); session.stop(); resolve?.(stream); await joining;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(store.setDoc).not.toHaveBeenCalled();
  });
  it("queues ICE until the remote description and releases every peer on leave", async () => {
    const { track } = setup();
    const session = new VoiceSession(db, "m", "a", ["a", "b", "c", "d"], vi.fn(), vi.fn(), vi.fn());
    await session.start();
    store.listeners[0]?.fn({ docs: ["b", "c", "d"].map((uid) => ({ data: () => ({ kind: "member", uid, sid: uid, at: Date.now() }) })) });
    await new Promise((r) => setTimeout(r, 0));
    expect(pcs).toHaveLength(3);
    const candidates = store.listeners.find((l) => l.ref.includes("calleeCandidates"));
    candidates?.fn({ docChanges: () => [{ type: "added", doc: { data: () => ({ candidate: "test" }) } }] });
    expect(pcs[0]?.addIceCandidate).not.toHaveBeenCalled();
    const pair = store.listeners.find((l) => l.ref.includes("pair_") && !l.ref.includes("Candidates"));
    pair?.fn({ data: () => ({ answer: { type: "answer", sdp: "test" } }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(pcs[0]?.addIceCandidate).toHaveBeenCalledWith({ candidate: "test" });
    session.setMuted(true); expect(track.enabled).toBe(false);
    session.setMuted(false); expect(track.enabled).toBe(true);
    session.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    for (const pc of pcs) expect(pc.close).toHaveBeenCalledOnce();
    expect(document.querySelectorAll("audio")).toHaveLength(0);
    expect(store.deleteDoc).toHaveBeenCalled();
  });
});