import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { signOut } from "firebase/auth";
import { AppShell } from "@/components/game/AppShell";
import { FullLoader } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { RingListener } from "@/components/game/RingListener";

export const Route = createFileRoute("/_player")({
  component: PlayerLayout,
});

function PlayerLayout() {
  const { user, profile, loading, fb, error, isAdmin, settings } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (error) return <div className="text-destructive p-6 text-center">Couldn't connect to the game server: {error}</div>;
  if (loading || !user) return <FullLoader />;
  if (!profile)
    return (
      <div className="mx-auto max-w-sm p-8 text-center">
        <ShieldAlert className="text-warning mx-auto mb-3 size-8" />
        <p className="mb-4">We couldn't load your player profile. Firestore may not be set up yet.</p>
        <Button variant="outline" onClick={() => fb && signOut(fb.auth)}>Sign out</Button>
      </div>
    );
  if (profile.status === "suspended" || profile.status === "rejected")
    return (
      <div className="mx-auto max-w-sm p-8 text-center">
        <ShieldAlert className="text-destructive mx-auto mb-3 size-8" />
        <p className="mb-4">Your account is {profile.status}. Contact an admin for help.</p>
        <Button variant="outline" onClick={() => fb && signOut(fb.auth)}>Sign out</Button>
      </div>
    );
  if (!isAdmin && !settings.payment.freeRegistration && (profile.paymentStatus === "pending" || profile.paymentStatus === "rejected"))
    return (
      <div className="mx-auto max-w-sm p-8 text-center">
        <ShieldAlert className="text-warning mx-auto mb-3 size-8" />
        {profile.paymentStatus === "pending" ? (
          <p className="mb-4">We're checking your ₦{(profile.paymentAmount ?? settings.payment.fee).toLocaleString()} registration payment. You'll get in once an admin confirms it.</p>
        ) : (
          <p className="mb-4">We couldn't confirm your ₦{(profile.paymentAmount ?? settings.payment.fee).toLocaleString()} payment. Contact an admin for help.</p>
        )}
        <Button variant="outline" onClick={() => fb && signOut(fb.auth)}>Sign out</Button>
      </div>
    );

  return (
    <AppShell>
      <Outlet />
      <RingListener />
    </AppShell>
  );
}
