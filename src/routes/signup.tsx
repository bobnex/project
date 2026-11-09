import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, authError } from "@/components/game/AuthLayout";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Favoje Battle" },
      { name: "description", content: "Create your Favoje Battle account and start battling classmates." },
      { property: "og:title", content: "Create account — Favoje Battle" },
      { property: "og:description", content: "Start battling classmates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

function Signup() {
  const { fb, settings } = useApp();
  const navigate = useNavigate();
  const [f, setF] = useState({ username: "", email: "", password: "", confirm: "", sender: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fb) return;
    const username = f.username.trim();
    const lower = username.toLowerCase();
    if (!USERNAME.test(username)) return toast.error("Username: 3–20 letters, numbers or underscores.");
    if (f.password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (f.password !== f.confirm) return toast.error("Passwords don't match.");
    if (!f.sender.trim()) return toast.error("Enter the name on the account you paid from.");
    setBusy(true);
    try {
      const taken = await getDoc(doc(fb.db, "usernames", lower)).catch(() => null);
      if (taken?.exists()) throw new Error("That username is taken.");
      const cred = await createUserWithEmailAndPassword(fb.auth, f.email.trim(), f.password);
      const uid = cred.user.uid;
      try {
        await runTransaction(fb.db, async (tx) => {
          const u = await tx.get(doc(fb.db, "usernames", lower));
          if (u.exists()) throw new Error("That username is taken.");
          tx.set(doc(fb.db, "usernames", lower), { uid });
          tx.set(doc(fb.db, "users", uid), {
            username,
            usernameLower: lower,
            email: f.email.trim(),
            status: settings.requireApproval ? "pending" : "approved",
            paymentStatus: "pending",
            paymentSender: f.sender.trim(),
            paymentRef: f.ref.trim(),
            paymentAmount: settings.payment.fee,
            level: 1,
            xp: 0,
            rating: 1000,
            coins: 100,
            battles: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            createdAt: Date.now(),
          });
        });
      } catch (err) {
        await deleteUser(cred.user).catch(() => {});
        throw err;
      }
      sendEmailVerification(cred.user, { url: window.location.origin + "/home" }).catch(() => {});
      toast.success("Account created! An admin will confirm your payment shortly.");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(authError(err));
    } finally {
      setBusy(false);
    }
  }

  const copy = () => navigator.clipboard?.writeText(settings.payment.accountNumber).then(() => toast.success("Account number copied"));

  return (
    <AuthLayout title="Join the arena" subtitle="Pick a username your rivals will remember.">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-muted space-y-2 rounded-xl p-4 text-sm">
          <div className="font-bold">Step 1: Pay ₦{settings.payment.fee.toLocaleString()} registration fee</div>
          <div>Bank: <span className="font-semibold">{settings.payment.bank}</span></div>
          <div className="flex items-center gap-2">
            Account number: <span className="font-mono font-semibold">{settings.payment.accountNumber}</span>
            <Button type="button" size="icon" variant="ghost" className="size-7" onClick={copy} aria-label="Copy account number"><Copy className="size-3.5" /></Button>
          </div>
          <div>Account name: <span className="font-semibold">{settings.payment.accountName}</span></div>
          {settings.payment.note && <p className="text-muted-foreground text-xs">{settings.payment.note}</p>}
        </div>
        <Field id="sender" label="Name on the account you paid from" value={f.sender} onChange={set("sender")} />
        <Field id="ref" label="Transaction reference (optional)" value={f.ref} onChange={set("ref")} optional />
        <div className="pt-2 font-bold text-sm">Step 2: Create your account</div>
        <Field id="username" label="Username" value={f.username} onChange={set("username")} autoComplete="username" />
        <Field id="email" label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        <Field id="password" label="Password" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" />
        <Field id="confirm" label="Confirm password" type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" />
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || !fb}>
          {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} I've paid — create account
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already playing? <Link to="/login" className="text-primary font-semibold">Log in</Link>
      </p>
    </AuthLayout>
  );
}

function Field(props: { id: string; label: string; type?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; autoComplete?: string; optional?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input id={props.id} type={props.type ?? "text"} required value={props.value} onChange={props.onChange} autoComplete={props.autoComplete} className="h-12 rounded-xl" />
    </div>
  );
}
