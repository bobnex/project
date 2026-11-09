import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Brain, Mic, Palette, Smartphone, Swords, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, BrandName } from "@/components/game/Brand";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Favoje Battle CBT — Academic battles in real time" },
      { name: "description", content: "Challenge classmates to live CBT battles: 1v1 duels, 50 Players Rush, rankings and themes." },
      { property: "og:title", content: "Favoje Battle CBT" },
      { property: "og:description", content: "Live academic battles for students. Duel 1v1 or survive the 50 Players Rush." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

const FEATURES = [
  { icon: Swords, title: "Classic 1v1", text: "Duel a real opponent. Fast answers score more." },
  { icon: Zap, title: "50 Players Rush", text: "Two wrong answers and you're out. Last one standing wins." },
  { icon: Palette, title: "15 themes", text: "Each one in dark and light." },
  { icon: Mic, title: "Voice chat", text: "Classic, Tag Team and Rush rooms." },
];

function Splash() {
  const { user, loading, error } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [loading, user, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pt-14 pb-10">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <span className="bg-primary/30 animate-pulse-ring absolute inset-0 rounded-3xl" />
          <BrandMark size={84} className="animate-float relative rounded-3xl" />
        </div>
        <BrandName className="text-4xl" />
        <p className="text-muted-foreground mt-3 text-base">
          Think fast. Answer right. Climb the campus rankings.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="surface-card p-4">
            <f.icon className="text-primary mb-2 size-5" />
            <div className="text-sm font-bold">{f.title}</div>
            <div className="text-muted-foreground mt-1 text-xs leading-relaxed">{f.text}</div>
          </div>
        ))}
      </div>

      <div className="text-muted-foreground mt-6 flex items-start gap-3 text-xs">
        <Smartphone className="mt-0.5 size-4 shrink-0" />
        <span>Tip: open your browser menu and tap “Add to Home Screen” to use Favoje Battle like an app.</span>
      </div>

      {error && <p className="text-destructive mt-4 text-sm">Couldn't connect: {error}</p>}

      <div className="mt-auto space-y-3 pt-10">
        <Button asChild variant="hero" size="xl" className="w-full">
          <Link to="/signup">
            <Brain /> Create account
          </Link>
        </Button>
        <Button asChild variant="glass" size="xl" className="w-full">
          <Link to="/login">
            <Users /> I already have an account
          </Link>
        </Button>
        <p className="text-muted-foreground pt-2 text-center text-xs">
          By continuing you agree to play fair and respect other students.
        </p>
      </div>
    </div>
  );
}
