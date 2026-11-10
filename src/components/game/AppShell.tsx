import { Link, useLocation } from "@tanstack/react-router";
import { Award, Bell, ClipboardList, Coins, House, Settings, ShieldCheck, Swords, Trophy, UserRound, Users, HelpCircle, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useApp } from "@/lib/app-context";
import { settlePending } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { BrandMark, BrandName } from "./Brand";
import { PlayerAvatar } from "./Avatar";
import { CosmeticAvatar } from "./CosmeticPreview";
import { useCosmetics } from "@/lib/cosmetics-store";

export const NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/battle", label: "Battle", icon: Swords },
  { to: "/cbt", label: "CBT", icon: ClipboardList },
  { to: "/tournaments", label: "Cups", icon: Award },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/help", label: "Help", icon: HelpCircle },
] as const;

const TITLES: Record<string, string> = {
  "/home": "Home",
  "/battle": "Battle Arena",
  "/tournaments": "Tournaments",
  "/cbt": "CBT Practice",
  "/courses": "Course Directory",
  "/rankings": "Rankings",
  "/friends": "Friends",
  "/profile": "Profile",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/admin": "Admin Centre",
  "/help": "Help",
  "/shop": "Cosmetics Shop",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, fb, user } = useApp();
  const { wallet } = useCosmetics();
  const { pathname } = useLocation();
  const inMatch = pathname.startsWith("/match") || /^\/cbt\/.+/.test(pathname);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!fb || !user) return;
    return onSnapshot(
      query(collection(fb.db, "users", user.uid, "notifications"), where("read", "==", false)),
      (s) => setUnread(s.size),
      () => {},
    );
  }, [fb, user]);

  // Settle results of battles the player left early (e.g. eliminated in Rush) once they finish.
  useEffect(() => {
    if (!fb || !user || inMatch) return;
    void settlePending(fb.db, user.uid);
  }, [fb, user, pathname, inMatch]);

  const title = TITLES[pathname] ?? (pathname.startsWith("/tournaments") ? "Tournament" : pathname.startsWith("/cbt") ? "CBT Exam" : "Battle");

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop rail */}
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 lg:flex">
        <Link to="/home" className="mb-8 flex items-center gap-3 px-2">
          <BrandMark size={38} />
          <BrandName className="text-lg" />
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <RailLink key={n.to} to={n.to} label={n.label} icon={n.icon} active={pathname.startsWith(n.to)} />
          ))}
          <RailLink to="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} />
          {isAdmin && <RailLink to="/admin" label="Admin" icon={ShieldCheck} active={pathname === "/admin"} />}
        </nav>
        {profile && (
          <Link to="/profile" className="surface-card mt-auto flex items-center gap-3 p-3">
            <CosmeticAvatar name={profile.username} wallet={wallet} size={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{profile.username}</div>
              <div className="text-muted-foreground text-xs">Level {profile.level} · {profile.rating} SR</div>
            </div>
          </Link>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!inMatch && (
          <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4">
            <Link to="/home" className="lg:hidden">
              <BrandMark size={32} />
            </Link>
            <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
            {profile && (
              <Link to="/shop" aria-label="Juvora coin shop" className="bg-muted flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
                <Coins className="text-warning size-4" />
                <span className="tabular">{wallet.balance}</span>
              </Link>
            )}
            <Link to="/notifications" aria-label="Notifications" className="hover:bg-muted relative grid size-9 place-items-center rounded-full">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </Link>
            {isAdmin && (
              <Link to="/admin" aria-label="Admin" className="hover:bg-muted grid size-9 place-items-center rounded-full lg:hidden">
                <ShieldCheck className="size-5" />
              </Link>
            )}
            <Link to="/settings" aria-label="Settings" className="hover:bg-muted grid size-9 place-items-center rounded-full lg:hidden">
              <Settings className="size-5" />
            </Link>
          </header>
        )}

        <main key={pathname} className={cn("animate-page mx-auto w-full max-w-5xl flex-1 px-4 py-5", !inMatch && "pb-36 lg:pb-8")}>
          {children}
        </main>

        {!inMatch && (
          <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t lg:hidden">
            <div className="mx-auto grid max-w-xl grid-cols-5 px-1 pt-2">
              {NAV.map((n) => {
                const active = pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link key={n.to} to={n.to} className="pressable flex flex-col items-center gap-1 py-1">
                    <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground")}>
                      <Icon className="size-5" />
                    </span>
                    <span className={cn("text-[11px] font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

type AppPath = (typeof NAV)[number]["to"] | "/settings" | "/admin";

function RailLink({ to, label, icon: Icon, active }: { to: AppPath; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
