import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "./Brand";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <Link to="/" className="text-muted-foreground hover:bg-muted grid size-10 place-items-center rounded-full" aria-label="Back">
        <ArrowLeft className="size-5" />
      </Link>
      <div className="mt-8 mb-8">
        <BrandMark size={52} className="mb-5" />
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/email-already-in-use": "That email already has an account.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "That email doesn't look right.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
    "auth/operation-not-allowed": "Email sign-in isn't switched on in Firebase yet.",
    "auth/unauthorized-domain": "This website address isn't allowed in Firebase yet.",
    "auth/network-request-failed": "Network problem. Check your connection.",
  };
  return map[code] ?? (e as Error)?.message ?? "Something went wrong.";
}
