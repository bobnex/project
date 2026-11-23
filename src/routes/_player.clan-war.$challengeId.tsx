import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_player/clan-war/$challengeId")({
  head: () => ({
    meta: [
      { title: "Redirecting — Juvora" },
      { name: "description", content: "Clans have retired. Welcome to Juvora Avatar Studio." },
    ],
  }),
  component: ClanWarDecommissionedPage,
});

export function ClanWarDecommissionedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate({ to: "/clans" });
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
      <div className="size-16 rounded-3xl bg-purple-950/80 border border-purple-500/40 grid place-items-center shadow-glow">
        <Sparkles className="size-8 text-purple-400" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-bold font-display text-foreground">
          Welcome to Avatar Studio
        </h2>
        <p className="text-sm text-muted-foreground">
          Clan matches have completed their season and transitioned into the Juvora 3D Avatar Studio ecosystem. Redirecting you to character customization...
        </p>
      </div>

      <Button
        onClick={() => navigate({ to: "/clans" })}
        className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
      >
        Go to Avatar Studio <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
