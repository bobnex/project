import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { Check, Inbox, Loader2, Swords, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/game/Avatar";
import { Empty, Section } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { createRoom } from "@/lib/engine";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/friends")({
  head: () => pageMeta("Friends", "Add friends by username and challenge them to private battles."),
  component: Friends,
});

interface Req { id: string; from: string; fromName: string; to: string; toName: string; status: string }
interface Friend { id: string; uids: string[]; names: Record<string, string> }

function Friends() {
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Req[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    const a = onSnapshot(query(collection(fb.db, "friendRequests"), where("to", "==", user.uid)), (s) =>
      setIncoming(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Req, "id">) })).filter((r) => r.status === "pending")), () => {});
    const b = onSnapshot(query(collection(fb.db, "friendships"), where("uids", "array-contains", user.uid)), (s) =>
      setFriends(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friend, "id">) }))), () => {});
    return () => { a(); b(); };
  }, [fb, user]);

  if (!fb || !user || !profile) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const lower = name.trim().toLowerCase();
    if (!lower) return;
    setBusy("send");
    try {
      const u = await getDoc(doc(fb!.db, "usernames", lower));
      if (!u.exists()) throw new Error("No player with that username.");
      const to = u.data().uid as string;
      if (to === user!.uid) throw new Error("That's you!");
      if (friends.some((f) => f.uids.includes(to))) throw new Error("You're already friends.");
      await setDoc(doc(fb!.db, "friendRequests", `${user!.uid}_${to}`), {
        from: user!.uid, fromName: profile!.username, to, toName: name.trim(), status: "pending", createdAt: Date.now(),
      });
      await addDoc(collection(fb!.db, "users", to, "notifications"), {
        type: "friend", fromName: profile!.username, text: `${profile!.username} sent you a friend request`, read: false, createdAt: Date.now(),
      });
      toast.success("Friend request sent");
      setName("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function accept(r: Req) {
    const pair = [r.from, r.to].sort();
    await setDoc(doc(fb!.db, "friendships", pair.join("_")), {
      uids: pair, names: { [r.from]: r.fromName, [r.to]: profile!.username }, createdAt: Date.now(),
    });
    await updateDoc(doc(fb!.db, "friendRequests", r.id), { status: "accepted" });
    toast.success(`You and ${r.fromName} are now friends`);
  }

  async function challenge(f: Friend) {
    const other = f.uids.find((u) => u !== user!.uid)!;
    setBusy(f.id);
    try {
      const room = await createRoom(fb!.db, user!.uid, profile!.username, "classic", "all");
      await addDoc(collection(fb!.db, "users", other, "notifications"), {
        type: "challenge", fromName: profile!.username, code: room.code, matchId: room.id,
        text: `${profile!.username} challenged you to a 1v1 battle`, read: false, createdAt: Date.now(),
      });
      navigate({ to: "/match/$matchId", params: { matchId: room.id } });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={send} className="surface-card flex gap-2 p-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add friend by username" className="h-11 rounded-xl" />
        <Button type="submit" disabled={busy === "send"} className="h-11">
          {busy === "send" ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
        </Button>
      </form>

      {incoming.length > 0 && (
        <Section title="Friend requests" icon={Inbox}>
          {incoming.map((r) => (
            <div key={r.id} className="surface-card flex items-center gap-3 p-3">
              <PlayerAvatar name={r.fromName} size={36} />
              <span className="flex-1 font-semibold">{r.fromName}</span>
              <Button size="icon" variant="outline" aria-label="Decline" onClick={() => updateDoc(doc(fb.db, "friendRequests", r.id), { status: "declined" })}><X /></Button>
              <Button size="icon" aria-label="Accept" onClick={() => accept(r)}><Check /></Button>
            </div>
          ))}
        </Section>
      )}

      <Section title={`Friends (${friends.length})`} icon={Users}>
        {friends.length === 0 ? (
          <Empty icon={Users} title="No friends yet" text="Add classmates by username, then challenge them to a private battle." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {friends.map((f) => {
              const other = f.uids.find((u) => u !== user.uid)!;
              const n = f.names?.[other] ?? "Player";
              return (
                <div key={f.id} className="surface-card flex items-center gap-3 p-3">
                  <PlayerAvatar name={n} size={38} />
                  <span className="flex-1 truncate font-semibold">{n}</span>
                  <Button size="icon" variant="ghost" aria-label="Remove friend" onClick={() => confirm(`Remove ${n}?`) && deleteDoc(doc(fb.db, "friendships", f.id))}><UserMinus /></Button>
                  <Button size="sm" variant="hero" disabled={busy === f.id} onClick={() => challenge(f)}>
                    {busy === f.id ? <Loader2 className="animate-spin" /> : <Swords />} Challenge
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
