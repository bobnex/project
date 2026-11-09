import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, type Firestore } from "firebase/firestore";
import { voicePeers } from "./voice-rules";

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
type Peer = { sid: string; pc: RTCPeerConnection; audio: HTMLAudioElement; off: (() => void)[]; timer: ReturnType<typeof setTimeout> };

/** Only opted-in, current match participants form a mesh. Each join has fresh signaling IDs. */
export class VoiceSession {
  private sid = crypto.randomUUID();
  private stopped = false;
  private stream: MediaStream | null = null;
  private peers = new Map<string, Peer>();
  private off: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private published = false;
  private muted = false;
  private playerIds: string[];
  private members: { uid: string; sid: string; at: number }[] = [];

  constructor(private db: Firestore, private matchId: string, private uid: string, playerIds: string[],
    private update: (connected: number, total: number) => void,
    private fail: (message: string) => void,
    private playbackBlocked: () => void) { this.playerIds = playerIds; }

  private memberRef() { return doc(this.db, "matches", this.matchId, "rtc", `member_${this.uid}_${this.sid}`); }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") throw new Error("Voice isn't supported in this browser.");
    const local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    if (this.stopped) { local.getTracks().forEach((t) => t.stop()); return; }
    this.stream = local;
    local.getAudioTracks().forEach((t) => { t.onended = () => this.fail("Microphone disconnected. Rejoin voice."); });
    this.published = true;
    await this.publish();
    if (this.stopped) { await deleteDoc(this.memberRef()).catch(() => {}); return; }
    this.off = onSnapshot(collection(this.db, "matches", this.matchId, "rtc"), (snapshot) => {
      this.members = snapshot.docs.filter((d) => d.data().kind === "member").map((d) => d.data() as { uid: string; sid: string; at: number });
      this.sync();
    }, () => this.fail("Voice access failed. Check the room's Firebase permissions."));
    this.heartbeat = setInterval(() => { void this.publish().catch(() => this.fail("Voice connection lost. Rejoin voice.")); this.sync(); }, 10_000);
  }
  private publish() { return setDoc(this.memberRef(), { kind: "member", uid: this.uid, sid: this.sid, at: Date.now() }); }
  setPlayers(ids: string[]) { this.playerIds = ids; if (!ids.includes(this.uid)) this.stop(); else this.sync(); }
  setMuted(muted: boolean) { this.muted = muted; this.stream?.getAudioTracks().forEach((t) => { t.enabled = !muted; }); }
  async resumeAudio() { await Promise.all([...this.peers.values()].map((p) => p.audio.play())); }
  private report() { this.update([...this.peers.values()].filter((p) => p.pc.connectionState === "connected").length, this.peers.size); }
  private sync() {
    if (this.stopped || !this.stream) return;
    const active = voicePeers(this.uid, this.playerIds, this.members, Date.now());
    for (const [uid, peer] of this.peers) if (!active.some((m) => m.uid === uid && m.sid === peer.sid)) this.remove(uid);
    for (const member of active) if (!this.peers.has(member.uid)) void this.connect(member).catch(() => { if (!this.stopped) this.fail("Couldn't connect voice. Rejoin to retry."); });
    this.report();
  }
  private async connect(member: { uid: string; sid: string }) {
    const local = this.stream;
    if (!local || this.stopped) return;
    const caller = this.uid < member.uid;
    const pair = caller ? [this.sid, member.sid] : [member.sid, this.sid];
    const ref = doc(this.db, "matches", this.matchId, "rtc", `pair_${pair.join("_")}`);
    const pc = new RTCPeerConnection(ICE);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    document.body.appendChild(audio);
    const peer: Peer = { sid: member.sid, pc, audio, off: [], timer: setTimeout(() => {
      if (pc.connectionState !== "connected" && !this.stopped) this.fail("Voice timed out. Rejoin or try another network.");
    }, 30_000) };
    this.peers.set(member.uid, peer);
    const current = () => !this.stopped && this.peers.get(member.uid) === peer;
    const fail = () => { if (current()) this.fail("Voice connection lost. Rejoin to retry."); };
    local.getTracks().forEach((track) => { track.enabled = !this.muted; pc.addTrack(track, local); });
    pc.ontrack = (e) => { audio.srcObject = e.streams[0] ?? new MediaStream([e.track]); void audio.play().catch(() => { if (current()) this.playbackBlocked(); }); };
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === "connected") { clearTimeout(peer.timer); clearTimeout(disconnectTimer); }
      if (pc.connectionState === "failed") fail();
      if (pc.connectionState === "disconnected") disconnectTimer = setTimeout(() => { if (pc.connectionState === "disconnected") fail(); }, 8_000);
      this.report();
    };
    peer.off.push(() => clearTimeout(disconnectTimer));
    pc.onicecandidate = (e) => { if (e.candidate && current()) void addDoc(collection(ref, caller ? "callerCandidates" : "calleeCandidates"), e.candidate.toJSON()).catch(fail); };
    const pending: RTCIceCandidateInit[] = [];
    const flush = async () => { while (pending.length && current() && pc.remoteDescription) { const candidate = pending.shift(); if (candidate) await pc.addIceCandidate(candidate); } };
    peer.off.push(onSnapshot(collection(ref, caller ? "calleeCandidates" : "callerCandidates"), (s) => {
      s.docChanges().filter((c) => c.type === "added").forEach((c) => pending.push(c.doc.data() as RTCIceCandidateInit));
      void flush().catch(fail);
    }, fail));
    let handling = false;
    peer.off.push(onSnapshot(ref, (s) => {
      const data = s.data();
      if (!current() || handling || pc.remoteDescription || !(caller ? data?.answer : data?.offer)) return;
      handling = true;
      void (async () => {
        await pc.setRemoteDescription(caller ? data?.answer : data?.offer);
        if (!current()) return;
        await flush();
        if (!caller) {
          const answer = await pc.createAnswer();
          if (!current()) return;
          await pc.setLocalDescription(answer);
          if (current()) await setDoc(ref, { answer: { type: answer.type, sdp: answer.sdp ?? "" } }, { merge: true });
        }
      })().catch(fail);
    }, fail));
    if (caller) {
      const offer = await pc.createOffer();
      if (!current()) return;
      await pc.setLocalDescription(offer);
      if (current()) await setDoc(ref, { kind: "pair", offer: { type: offer.type, sdp: offer.sdp ?? "" } }, { merge: true });
    }
  }
  private remove(uid: string) {
    const peer = this.peers.get(uid);
    if (!peer) return;
    this.peers.delete(uid);
    clearTimeout(peer.timer);
    peer.off.forEach((off) => off());
    peer.pc.onconnectionstatechange = null;
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.close();
    peer.audio.pause(); peer.audio.srcObject = null; peer.audio.remove();
  }
  stop() {
    this.stopped = true;
    this.off?.(); this.off = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const uid of this.peers.keys()) this.remove(uid);
    this.stream?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    this.stream = null;
    if (this.published) void deleteDoc(this.memberRef()).catch(() => {});
  }
}