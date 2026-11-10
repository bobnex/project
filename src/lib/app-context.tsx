import { createContext, useContext, useEffect, useState, type Context, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getFirebase, type FB } from "./firebase";
import type { RankedState } from "./ranked";
import { DEFAULT_PAYMENT, normalizePayment, normalizeSponsors, type PaymentDetails, type Sponsor } from "./payment";
import { applyTheme, normalizeCustomThemes, readLocalTheme, type Appearance, type Theme } from "./themes";
import { setSfxGloballyEnabled } from "./sfx";
import type { ClanRole } from "./clans";

export interface Profile extends RankedState {
  username: string;
  email: string;
  status: "approved" | "pending" | "rejected" | "suspended";
  level: number;
  xp: number;
  rating: number;
  coins: number;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  theme?: string;
  mode?: Appearance;
  clanId?: string | null;
  clanRole?: ClanRole | null;
  fullName?: string;
  school?: string;
  bio?: string;
  createdAt: number;
  paymentStatus?: "pending" | "confirmed" | "rejected";
  paymentSender?: string;
  paymentRef?: string;
  paymentAmount?: number;
  emailVerified?: boolean;
}
