import { useEffect, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, runTransaction, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { KeyRound, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

export function PersonalInfoForm() {
  const { fb, user, profile } = useApp();
  const [f, setF] = useState({ username: "", fullName: "", school: "", bio: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile) setF({ username: profile.username ?? "", fullName: profile.fullName ?? "", school: profile.school ?? "", bio: profile.bio ?? "" });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fb || !user || !profile) return;
    const username = f.username.trim();
    if (!USERNAME.test(username)) return toast.error("Username: 3–20 letters, numbers or underscores.");
    if (f.bio.length > 160) return toast.error("Bio must be 160 characters or less.");
    setBusy(true);
    try {
      const info = { fullName: f.fullName.trim().slice(0, 60), school: f.school.trim().slice(0, 80), bio: f.bio.trim() };
      const oldLower = profile.username.toLowerCase();
      const newLower = username.toLowerCase();
      if (username !== profile.username) {
        await runTransaction(fb.db, async (tx) => {
          if (newLower !== oldLower) {
            const taken = await tx.get(doc(fb.db, "usernames", newLower));
            if (taken.exists() && taken.data().uid !== user.uid) throw new Error("That username is taken.");
            tx.set(doc(fb.db, "usernames", newLower), { uid: user.uid });
            tx.delete(doc(fb.db, "usernames", oldLower));
          }
          tx.update(doc(fb.db, "users", user.uid), { username, ...info });
        });
      } else {
        await updateDoc(doc(fb.db, "users", user.uid), info);
      }
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="surface-card space-y-3 p-4">
      <div className="space-y-1.5"><Label htmlFor="pi-user">Username</Label><Input id="pi-user" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="pi-name">Full name</Label><Input id="pi-name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="pi-school">School</Label><Input id="pi-school" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="pi-bio">Bio</Label><Textarea id="pi-bio" maxLength={160} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
      <div className="text-muted-foreground text-sm">Email: {profile?.email}</div>
      <Button type="submit" disabled={busy}><Save /> {busy ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const { user } = useApp();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (f.next.length < 6) return toast.error("New password must be at least 6 characters.");
    if (f.next !== f.confirm) return toast.error("New passwords don't match.");
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, f.current));
      await updatePassword(user, f.next);
      setF({ current: "", next: "", confirm: "" });
      toast.success("Password changed.");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      toast.error(code.includes("wrong-password") || code.includes("invalid-credential") ? "Current password is incorrect." : "Could not change password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="surface-card space-y-3 p-4">
      <div className="space-y-1.5"><Label htmlFor="pw-cur">Current password</Label><Input id="pw-cur" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="pw-conf">Confirm new password</Label><Input id="pw-conf" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
      <Button type="submit" disabled={busy || !f.current}><KeyRound /> {busy ? "Updating…" : "Change password"}</Button>
    </form>
  );
}
