import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { Check, KeyRound, Volume2, VolumeX, LogOut, Mail, Moon, Palette, Sun, UserRound } from "lucide-react";
import { ChangePasswordForm, PersonalInfoForm } from "@/components/game/account-forms";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/game/ui";
import { useApp } from "@/lib/app-context";
import { THEMES, readLocalTheme, type Appearance } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/meta";
import { useEffect, useState } from "react";
import { isSfxOn, play, setSfxOn } from "@/lib/sfx";

export const Route = createFileRoute("/_player/settings")({
  head: () => pageMeta("Settings", "Choose your theme, appearance and account options."),
  component: SettingsPage,
});

function SettingsPage() {
  const { fb, profile, settings, setTheme } = useApp();
  const [cur, setCur] = useState({ theme: "purple", mode: "dark" as Appearance });
  useEffect(() => {
    const l = readLocalTheme();
    setCur({ theme: profile?.theme ?? l?.theme ?? settings.defaultTheme, mode: profile?.mode ?? l?.mode ?? settings.defaultMode });
  }, [profile?.theme, profile?.mode, settings]);

  const pick = (theme: string, mode: Appearance) => {
    setCur({ theme, mode });
    setTheme(theme, mode);
  };
  const [sfx, setSfx] = useState(true);
  useEffect(() => setSfx(isSfxOn()), []);
  const available = THEMES.filter((t) => !settings.disabledThemes.includes(t.id));

  return (
    <div className="space-y-6">
      <Section title="Appearance" icon={cur.mode === "dark" ? Moon : Sun}>
        <div className="surface-card grid grid-cols-2 gap-2 p-2">
          {(["dark", "light"] as const).map((m) => (
            <button key={m} onClick={() => pick(cur.theme, m)} className={cn("pressable flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold", cur.mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {m === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />} {m === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </Section>

      {settings.sfxEnabled ? (
        <Section title="Sound effects" icon={sfx ? Volume2 : VolumeX}>
          <div className="surface-card grid grid-cols-2 gap-2 p-2">
            {[true, false].map((on) => (
              <button key={String(on)} onClick={() => { setSfxOn(on); setSfx(on); if (on) play("correct"); }} className={cn("pressable flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold", sfx === on ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {on ? "On" : "Off"}
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Sound effects" icon={VolumeX}>
          <div className="surface-card text-muted-foreground flex items-center gap-2 p-4 text-sm">
            <VolumeX className="size-4 shrink-0" /> Sound effects have been turned off by an admin.
          </div>
        </Section>
      )}

      <Section title="Theme" icon={Palette}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {available.map((t) => (
            <button
              key={t.id}
              data-theme={t.id}
              data-mode={cur.mode}
              onClick={() => pick(t.id, cur.mode)}
              className={cn("pressable bg-background text-foreground relative overflow-hidden rounded-2xl border p-3 text-left", cur.theme === t.id && "ring-primary ring-2")}
              style={{ background: "var(--gradient-hero)" }}
            >
              <div className="mb-3 flex gap-1.5">
                <span className="bg-primary size-5 rounded-full" />
                <span className="bg-accent size-5 rounded-full" />
                <span className="bg-muted size-5 rounded-full border" />
              </div>
              <div className="bg-gradient-primary mb-2 h-6 rounded-lg" />
              <div className="text-sm font-bold">{t.name}</div>
              <div className="text-muted-foreground text-xs">{t.blurb}</div>
              {cur.theme === t.id && <Check className="bg-primary text-primary-foreground absolute top-2 right-2 size-5 rounded-full p-0.5" />}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Personal info" icon={UserRound}>
        <PersonalInfoForm />
      </Section>

      <Section title="Change password" icon={KeyRound}>
        <ChangePasswordForm />
      </Section>

      <Section title="Account" icon={Mail}>
        <div className="surface-card space-y-3 p-4">
          <Button variant="destructive" onClick={() => fb && signOut(fb.auth)}><LogOut /> Sign out</Button>
        </div>
      </Section>
    </div>
  );
}
