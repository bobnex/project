import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
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
  { to: "/clans", label: "Clans", icon: Users },
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
  "/clans": "Clans",
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
