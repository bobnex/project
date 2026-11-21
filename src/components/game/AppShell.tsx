import { Link, useLocation } from "@tanstack/react-router";
import {
  Award,
  Bell,
  ClipboardList,
  Coins,
  HelpCircle,
  House,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { useApp } from "@/lib/app-context";
import { settlePending } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { BrandMark, BrandName } from "./Brand";
import { CosmeticAvatar } from "./CosmeticPreview";
import { useCosmetics } from "@/lib/cosmetics-store";
import { ClanWarInviteListener } from "./ClanWarInviteListener";

export const NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/battle", label: "Battle", icon: Swords },
  { to: "/clans", label: "Clans", icon: Shield },
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
  "/speed-demon": "Speed Demon",
  "/clans": "Clans & War Arena",
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
  "/clan-war": "Clan War Waiting Room",
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
      (snapshot) => setUnread(snapshot.size),
      () => {},
    );
  }, [fb, user]);

  useEffect(() => {
    if (!fb || !user || inMatch) return;
    void settlePending(fb.db, user.uid);
  }, [fb, user, pathname, inMatch]);

  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/tournaments")
      ? "Tournament"
      : pathname.startsWith("/cbt")
        ? "CBT Exam"
        : pathname.startsWith("/clan-war")
          ? "Clan War Waiting Room"
          : "Battle");

  return (
    <div className="min-h-screen lg:flex">
      <ClanWarInviteListener />

      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 lg:flex">
        <Link to="/home" className="mb-8 flex items-center gap-3 px-2">
          <BrandMark size={38} />
          <BrandName className="text-lg" />
        </Link>

        <nav className="flex flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => (
            <RailLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.to)}
            />
          ))}
          <RailLink to="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} />
          {isAdmin && (
            <RailLink to="/admin" label="Admin" icon={ShieldCheck} active={pathname === "/admin"} />
          )}
        </nav>

        {profile && (
          <Link to="/profile" className="surface-card mt-auto flex items-center gap-3 p-3">
            <CosmeticAvatar name={profile.username} wallet={wallet} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{profile.username}</div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span>Lvl {profile.level}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <Coins className="size-3" />
                  {profile.coins ?? 0}
                </span>
              </div>
            </div>
          </Link>
        )}
      </aside>

      <div className="flex flex-1 flex-col pb-20 lg:pb-0">
        <header className="glass sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Link to="/home" className="flex items-center gap-2">
              <BrandMark size={30} />
              <BrandName className="text-base" />
            </Link>
          </div>

          <h1 className="hidden text-lg font-extrabold lg:block">{title}</h1>

          <div className="flex items-center gap-2">
            <Link
              to="/shop"
              className="surface-card flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:border-amber-400/40"
            >
              <Coins className="size-3.5" />
              <span>{profile?.coins ?? 0}</span>
            </Link>

            <Link
              to="/notifications"
              className="relative grid size-10 place-items-center rounded-xl border border-border bg-card/60 transition-colors hover:border-primary/50"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-black text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <nav className="glass fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t py-2 lg:hidden">
        {NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors",
                active ? "text-primary font-bold" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RailLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof House;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
