import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, authError } from "@/components/game/AuthLayout";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Favoje Battle" },
      { name: "description", content: "Log in to Favoje Battle and jump back into the arena." },
      { property: "og:title", content: "Log in — Favoje Battle" },
      { property: "og:description", content: "Jump back into the arena." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { fb } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fb) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(fb.auth, email.trim(), password);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(authError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue your battles.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="pw">Password</Label>
            <Link to="/forgot-password" className="text-primary text-sm font-semibold">Forgot?</Link>
          </div>
          <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || !fb}>
          {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Log in
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        New here? <Link to="/signup" className="text-primary font-semibold">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
