import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Activity,
  Check,
  Flame,
  Inbox,
  Loader2,
  Search,
  Swords,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/game/Avatar";
import { Empty, Section, Stat } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { createRoom } from "@/lib/engine";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/_player/friends")({
  head: () =>
    pageMeta(
      "Friends",
      "Find players, view their stats and send friend requests.",
    ),
  component: Friends,
});

interface Req {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  status: string;
}

interface Friend {
  id: string;
  uids: string[];
  names: Record<string, string>;
}

interface PlayerProfile {
  id: string;
  username: string;
  usernameLower?: string;
  level?: number;
  xp?: number;
  rating?: number;
  rp?: number;
  battles?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  streak?: number;
  bestStreak?: number;
  createdAt?: number;
}

function Friends() {
  const { fb, user, profile } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Req[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<PlayerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    if (!fb || !user) return;

    const requests = onSnapshot(
      query(
        collection(fb.db, "friendRequests"),
        where("to", "==", user.uid),
      ),
      (snapshot) => {
        setIncoming(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...(item.data() as Omit<Req, "id">),
            }))
            .filter((request) => request.status === "pending"),
        );
      },
      () => {},
    );

    const friendships = onSnapshot(
      query(
        collection(fb.db, "friendships"),
        where("uids", "array-contains", user.uid),
      ),
      (snapshot) => {
        setFriends(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Friend, "id">),
          })),
        );
      },
      () => {},
    );

    return () => {
      requests();
      friendships();
    };
  }, [fb, user]);

  useEffect(() => {
    if (!fb || !user) return;

    const term = name.trim().toLowerCase();
    setSelected(null);

    if (!term) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const snapshot = await getDocs(
          query(collection(fb.db, "users"), limit(100)),
        );

        if (cancelled) return;

        const matches = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...(item.data() as Omit<PlayerProfile, "id">),
          }))
          .filter((player) => {
            if (player.id === user.uid) return false;

            const username = String(player.username ?? "").toLowerCase();
            const usernameLower = String(
              player.usernameLower ?? "",
            ).toLowerCase();

            return (
              username.includes(term) ||
              usernameLower.includes(term)
            );
          })
          .slice(0, 8);

        setSuggestions(matches);
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fb, user, name]);

  const selectedStatus = useMemo(() => {
    if (!selected || !user) return "none";

    if (friends.some((friend) => friend.uids.includes(selected.id))) {
      return "friend";
    }

    if (
      incoming.some(
        (request) =>
          request.from === selected.id &&
          request.status === "pending",
      )
    ) {
      return "incoming";
    }

    return "none";
  }, [friends, incoming, selected, user]);

  if (!fb || !user || !profile) return null;

  async function selectPlayer(player: PlayerProfile) {
    setName(player.username);
    setSuggestions([]);
    setSearching(false);

    try {
      const snapshot = await getDoc(doc(fb.db, "users", player.id));

      if (!snapshot.exists()) {
        toast.error("This player profile could not be found.");
        return;
      }

      setSelected({
        id: snapshot.id,
        ...(snapshot.data() as Omit<PlayerProfile, "id">),
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function sendRequest() {
    if (!selected) return;

    setBusy("send");

    try {
      if (selected.id === user.uid) {
        throw new Error("That's you!");
      }

      if (friends.some((friend) => friend.uids.includes(selected.id))) {
        throw new Error("You're already friends.");
      }

      const requestId = `${user.uid}_${selected.id}`;

      await setDoc(doc(fb.db, "friendRequests", requestId), {
        from: user.uid,
        fromName: profile.username,
        to: selected.id,
        toName: selected.username,
        status: "pending",
        createdAt: Date.now(),
      });

      await addDoc(
        collection(fb.db, "users", selected.id, "notifications"),
        {
          type: "friend",
          fromName: profile.username,
          text: `${profile.username} sent you a friend request`,
          read: false,
          createdAt: Date.now(),
        },
      );

      toast.success("Friend request sent");
      setName("");
      setSelected(null);
      setSuggestions([]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function accept(request: Req) {
    const pair = [request.from, request.to].sort();

    await setDoc(doc(fb.db, "friendships", pair.join("_")), {
      uids: pair,
      names: {
        [request.from]: request.fromName,
        [request.to]: profile.username,
      },
      createdAt: Date.now(),
    });

    await updateDoc(
      doc(fb.db, "friendRequests", request.id),
      { status: "accepted" },
    );

    toast.success(`You and ${request.fromName} are now friends`);
  }

  async function challenge(friend: Friend) {
    const other = friend.uids.find((uid) => uid !== user.uid);

    if (!other) return;

    setBusy(friend.id);

    try {
      const room = await createRoom(
        fb.db,
        user.uid,
        profile.username,
        "classic",
        "all",
      );

      await addDoc(
        collection(fb.db, "users", other, "notifications"),
        {
          type: "challenge",
          fromName: profile.username,
          code: room.code,
          matchId: room.id,
          text: `${profile.username} challenged you to a 1v1 battle`,
          read: false,
          createdAt: Date.now(),
        },
      );

      navigate({
        to: "/match/$matchId",
        params: { matchId: room.id },
      });
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(null);
    }
  }

  const battles = selected?.battles ?? 0;
  const wins = selected?.wins ?? 0;
  const winRate =
    battles > 0 ? Math.round((wins / battles) * 100) : 0;

  return (
    <div className="space-y-6">
      <Section title="Find players" icon={Search}>
        <div className="surface-card relative p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Search for a player"
              className="h-11 pl-9"
              autoComplete="off"
            />
          </div>

          {name.trim() && !selected && (
            <div className="absolute z-20 mt-2 w-[calc(100%-2rem)] overflow-hidden rounded-xl border bg-card shadow-xl">
              {searching ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching players…
                </div>
              ) : suggestions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No players found.
                </div>
              ) : (
                suggestions.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player)}
                    className="hover:bg-muted flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0"
                  >
                    <PlayerAvatar name={player.username} size={38} />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {player.username}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Level {player.level ?? 1} ·{" "}
                        {player.rating ?? 1000} rating
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="surface-card space-y-4 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <PlayerAvatar name={selected.username} size={64} />

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-bold">
                  {selected.username}
                </h3>
                <p className="text-muted-foreground text-sm">
                  Level {selected.level ?? 1} · Rating{" "}
                  {selected.rating ?? 1000}
                </p>
              </div>

              {selectedStatus === "friend" ? (
                <Button variant="outline" disabled>
                  <Check /> Friends
                </Button>
              ) : selectedStatus === "incoming" ? (
                <Button variant="outline" disabled>
                  <Inbox /> Request received
                </Button>
              ) : (
                <Button
                  variant="hero"
                  disabled={busy === "send"}
                  onClick={sendRequest}
                >
                  {busy === "send" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <UserPlus />
                  )}
                  Send friend request
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Battles"
                value={battles}
                icon={Swords}
              />
              <Stat
                label="Wins"
                value={wins}
                icon={Trophy}
                tone="success"
              />
              <Stat
                label="Losses"
                value={selected.losses ?? 0}
                icon={X}
                tone="destructive"
              />
              <Stat
                label="Draws"
                value={selected.draws ?? 0}
                icon={Users}
                tone="warning"
              />
              <Stat
                label="Win rate"
                value={`${winRate}%`}
                icon={Activity}
                tone="accent"
              />
              <Stat
                label="Streak"
                value={selected.streak ?? 0}
                icon={Flame}
                tone="warning"
              />
              <Stat
                label="XP"
                value={selected.xp ?? 0}
                icon={Activity}
              />
              <Stat
                label="Best streak"
                value={selected.bestStreak ?? 0}
                icon={Trophy}
                tone="accent"
              />
            </div>
          </div>
        )}
      </Section>

      {incoming.length > 0 && (
        <Section title="Friend requests" icon={Inbox}>
          {incoming.map((request) => (
            <div
              key={request.id}
              className="surface-card flex items-center gap-3 p-3"
            >
              <PlayerAvatar
                name={request.fromName}
                size={36}
              />

              <span className="flex-1 font-semibold">
                {request.fromName}
              </span>

              <Button
                size="icon"
                variant="outline"
                aria-label="Decline"
                onClick={() =>
                  updateDoc(
                    doc(
                      fb.db,
                      "friendRequests",
                      request.id,
                    ),
                    { status: "declined" },
                  )
                }
              >
                <X />
              </Button>

              <Button
                size="icon"
                aria-label="Accept"
                onClick={() => accept(request)}
              >
                <Check />
              </Button>
            </div>
          ))}
        </Section>
      )}

      <Section
        title={`Friends (${friends.length})`}
        icon={Users}
      >
        {friends.length === 0 ? (
          <Empty
            icon={Users}
            title="No friends yet"
            text="Find a player, send a friend request, then challenge them to a private battle."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {friends.map((friend) => {
              const other = friend.uids.find(
                (uid) => uid !== user.uid,
              );

              if (!other) return null;

              const friendName =
                friend.names?.[other] ?? "Player";

              return (
                <div
                  key={friend.id}
                  className="surface-card flex items-center gap-3 p-3"
                >
                  <PlayerAvatar
                    name={friendName}
                    size={38}
                  />

                  <span className="flex-1 truncate font-semibold">
                    {friendName}
                  </span>

                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove friend"
                    onClick={() =>
                      confirm(`Remove ${friendName}?`) &&
                      deleteDoc(
                        doc(
                          fb.db,
                          "friendships",
                          friend.id,
                        ),
                      )
                    }
                  >
                    <UserMinus />
                  </Button>

                  <Button
                    size="sm"
                    variant="hero"
                    disabled={busy === friend.id}
                    onClick={() => challenge(friend)}
                  >
                    {busy === friend.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Swords />
                    )}
                    Challenge
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
