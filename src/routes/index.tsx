import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Crown, Mic, Palette, Smartphone, Swords, Trophy, Zap } from "lucide-react";
import { BrandMark } from "@/components/game/Brand";
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

function Splash() {
  const { user, loading, error } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [loading, user, navigate]);

  return (
    <div className="bg-luxe-bg text-luxe-ink relative min-h-screen overflow-hidden">
      <div className="bg-luxe-gold/10 pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8 pb-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark size={30} className="rounded-lg" />
            <span className="text-luxe-dim text-[10px] font-semibold tracking-[0.35em] uppercase">Favoje</span>
          </div>
          <Link to="/login" className="text-luxe-gold text-xs font-semibold tracking-widest uppercase">
            Sign in
          </Link>
        </header>

        <section className="mt-12">
          <p className="text-luxe-gold text-[10px] font-semibold tracking-[0.4em] uppercase">The academic arena</p>
          <h1 className="font-luxe mt-4 text-[3.4rem] leading-[0.95] font-medium">
            Where sharp minds
            <span className="luxe-gold-text block italic">collide.</span>
          </h1>
          <p className="text-luxe-dim mt-5 max-w-[19rem] text-sm leading-relaxed">
            Live CBT battles against real classmates. Think fast, answer right, and claim your place at the top.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-2 gap-3">
          <div className="luxe-tile col-span-2 flex items-center justify-between rounded-2xl p-5">
            <div>
              <Swords className="text-luxe-gold size-5" />
              <div className="font-luxe lining-nums mt-3 text-2xl font-semibold">Classic 1v1</div>
              <div className="text-luxe-dim mt-1 text-xs">Duel a real opponent. Speed scores more.</div>
            </div>
            <Crown className="text-luxe-gold/25 size-16" strokeWidth={1} />
          </div>
          <div className="luxe-tile row-span-2 flex flex-col justify-between rounded-2xl p-5">
            <Zap className="text-luxe-gold size-5" />
            <div>
              <div className="luxe-gold-text font-luxe lining-nums text-5xl font-semibold">50</div>
              <div className="font-luxe text-xl font-semibold">Players Rush</div>
              <div className="text-luxe-dim mt-1 text-xs">Two wrong and you're out.</div>
            </div>
          </div>
          <div className="luxe-tile rounded-2xl p-4">
            <Palette className="text-luxe-gold size-4" />
            <div className="mt-2 text-sm font-semibold">15 themes</div>
            <div className="text-luxe-dim text-[11px]">Dark &amp; light</div>
          </div>
          <div className="luxe-tile rounded-2xl p-4">
            <Mic className="text-luxe-gold size-4" />
            <div className="mt-2 text-sm font-semibold">Voice chat</div>
            <div className="text-luxe-dim text-[11px]">Talk while you battle</div>
          </div>
          <div className="luxe-tile col-span-2 flex items-center gap-3 rounded-2xl p-4">
            <Trophy className="text-luxe-gold size-5 shrink-0" />
            <div className="text-luxe-dim text-xs">Ranked tiers, tournaments and campus leaderboards.</div>
          </div>
        </section>

        {error && <p className="text-destructive mt-4 text-sm">Couldn't connect: {error}</p>}

        <div className="mt-auto space-y-3 pt-10">
          <Link
            to="/signup"
            className="luxe-gold-fill text-luxe-on-gold flex h-14 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-wide"
          >
            Create account <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/login"
            className="border-luxe-line text-luxe-ink flex h-14 w-full items-center justify-center rounded-full border text-sm font-semibold"
          >
            I already have an account
          </Link>
          <div className="text-luxe-dim flex items-start gap-2 pt-3 text-[11px]">
            <Smartphone className="mt-0.5 size-3.5 shrink-0" />
            <span>Tap “Add to Home Screen” in your browser menu to use Favoje Battle like an app.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
