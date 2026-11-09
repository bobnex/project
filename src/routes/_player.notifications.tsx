import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { Bell, CheckCheck, Swords, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { joinMatch } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/notifications")({
  head: () => pageMeta("Notifications", "Battle challenges, friend requests and updates."),
  component: Notifications,
});

interface N { id: string; type: string; text: string; read: boolean; createdAt: number; matchId?: string }

function Notifications() {
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    if (!fb || !user) return;
    return onSnapshot(query(collection(fb.db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"), limit(50)), (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<N, "id">) }))), () => {});
  }, [fb, user]);

  if (!fb || !user || !profile) return null;

  async function markAll() {
    const b = writeBatch(fb!.db);
    items.filter((i) => !i.read).forEach((i) => b.update(doc(fb!.db, "users", user!.uid, "notifications", i.id), { read: true }));
    await b.commit();
  }

  async function accept(n: N) {
    await updateDoc(doc(fb!.db, "users", user!.uid, "notifications", n.id), { read: true });
    try {
      await joinMatch(fb!.db, n.matchId!, user!.uid, profile!.username);
      navigate({ to: "/match/$matchId", params: { matchId: n.matchId! } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {items.some((i) => !i.read) && (
        <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={markAll}><CheckCheck /> Mark all read</Button></div>
      )}
      {items.length === 0 ? (
        <Empty icon={Bell} title="All caught up" text="Challenges and friend requests will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = n.type === "challenge" ? Swords : n.type === "friend" ? UserPlus : Bell;
            return (
              <div key={n.id} className={cn("surface-card flex items-center gap-3 p-3", !n.read && "border-primary/40")}>
                <div className={cn("grid size-10 place-items-center rounded-xl", n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}><Icon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{n.text}</div>
                  <div className="text-muted-foreground text-xs">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {n.type === "challenge" && n.matchId && !n.read && <Button size="sm" variant="hero" onClick={() => accept(n)}>Accept</Button>}
                {n.type === "friend" && !n.read && <Button size="sm" variant="outline" onClick={() => { updateDoc(doc(fb.db, "users", user.uid, "notifications", n.id), { read: true }); navigate({ to: "/friends" }); }}>View</Button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
