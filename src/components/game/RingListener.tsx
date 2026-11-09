import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { addDoc, collection, onSnapshot, query, where, type Firestore } from "firebase/firestore";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { createRoom, joinRoomByCode } from "@/lib/engine";
import { coursePickLabel, formatCoursePick, parseCoursePick } from "@/lib/course-pick";

const RING_TTL = 60_000;

/** Creates a private 1v1 room and rings every online player to join it. Returns the match id. */
export async function ringEveryone(db: Firestore, uid: string, name: string, subject: string | string[]) {
  const room = await createRoom(db, uid, name, "classic", subject);
  const wire = formatCoursePick(parseCoursePick(subject));
  await addDoc(collection(db, "rings"), { from: uid, fromName: name, code: room.code, matchId: room.id, subject: wire, createdAt: Date.now() });
  return room.id;
}

/** Shows incoming "ring" invites to every signed-in player with the app open. */
export function RingListener() {
  const { fb, user, profile, settings } = useApp();
  const navigate = useNavigate();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!fb || !user || !profile || !settings.ringEnabled || profile.status !== "approved") return;
    const since = Date.now() - RING_TTL;
    return onSnapshot(query(collection(fb.db, "rings"), where("createdAt", ">", since)), (s) => {
      s.docChanges().forEach((c) => {
        if (c.type !== "added" || seen.current.has(c.doc.id)) return;
        seen.current.add(c.doc.id);
        const r = c.doc.data();
        if (r.from === user.uid || Date.now() - r.createdAt > RING_TTL) return;
        toast(`${r.fromName} is looking for an opponent`, {
          description: `1v1 battle · ${coursePickLabel(parseCoursePick(r.subject), "all courses")}`,
          duration: 20_000,
          action: {
            label: "Accept",
            onClick: () => {
              joinRoomByCode(fb.db, user.uid, profile.username, r.code)
                .then((id) => navigate({ to: "/match/$matchId", params: { matchId: id } }))
                .catch(() => toast.error("Someone else already took this battle."));
            },
          },
          cancel: { label: "Decline", onClick: () => {} },
        });
      });
    }, () => {});
  }, [fb, user, profile?.status, profile?.username, settings.ringEnabled, navigate]);

  return null;
}
