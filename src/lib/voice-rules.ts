import type { Mode, Status } from "./game-rules";

export const VOICE_PRESENCE_MS = 45_000;
export function voiceAvailable(_mode: Mode, status: Status): boolean {
  return status === "waiting" || status === "countdown" || status === "active";
}
export function voicePeers(uid: string, playerIds: string[], members: { uid: string; sid: string; at: number }[], now: number) {
  return members.filter((m) => m.uid !== uid && playerIds.includes(m.uid) && m.at > now - VOICE_PRESENCE_MS);
}
export function clampVoicePosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return { x: Math.max(8, Math.min(x, viewportWidth - width - 8)), y: Math.max(8, Math.min(y, viewportHeight - height - 8)) };
}