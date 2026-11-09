import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Loader2, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, authError } from "@/components/game/AuthLayout";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Favoje Battle" },
      { name: "description", content: "Get a link to reset your Favoje Battle password." },
      { property: "og:title", content: "Reset password — Favoje Battle" },
      { property: "og:description", content: "Get a password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const { fb } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fb) return;
    setBusy(true);
    try {
      await sendPasswordResetEmail(fb.auth, email.trim());
      setSent(true);
    } catch (err) {
      toast.error(authError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a link to choose a new password.">
      {sent ? (
        <div className="surface-card flex items-center gap-3 p-4">
          <MailCheck className="text-success size-6" />
          <p className="text-sm">Check your inbox (and spam folder) for the reset link.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
          </div>
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || !fb}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
