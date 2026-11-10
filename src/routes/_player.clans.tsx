import { createFileRoute } from "@tanstack/react-router";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Building2, Crown, Loader2, Search, ShieldCheck, Swords, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import {
  canCreateClan,
  cleanClanTag,
  createClanRecord,
  DEFAULT_CLAN_CONFIG,
  getClanFeeById,
  getClanRoleLabel,
  normalizeClanConfig,
  requestClanJoin,
  clanCapacityForLevel,
  clanProgress,
  type Clan,
  type ClanConfig,
  type ClanMember,
  type ClanDraft,
} from "@/lib/clans";

export const Route = createFileRoute("/_player/clans")({
  component: ClansPage,
});

function ClansPage() {
  const { fb, user, profile } = useApp();
  const [config, setConfig] = useState<ClanConfig>(DEFAULT_CLAN_CONFIG);
  const [clans, setClans] = useState<Clan[]>([]);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ClanDraft>({
    name: "",
    tag: "",
    description: "",
    motto: "",
    emblem: "shield",
    banner: "purple",
    feeId: "free",
  });

  useEffect(() => {
    if (!fb) return;
    const settingsUnsub = onSnapshot(doc(fb.db, "settings", "clans"), (snap) => {
      setConfig(normalizeClanConfig(snap.exists() ? (snap.data() as Partial<ClanConfig>) : DEFAULT_CLAN_CONFIG));
    }, () => setConfig(DEFAULT_CLAN_CONFIG));

    const clansQuery = query(collection(fb.db, "clans"), orderBy("createdAt", "desc"), limit(25));
    const clansUnsub = onSnapshot(clansQuery, (snap) => {
      setClans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Clan, "id">) })));
      setLoading(false);
    });

    return () => {
      settingsUnsub();
      clansUnsub();
    };
  }, [fb]);

  useEffect(() => {
    if (!fb || !user) return;
    const q = query(collection(fb.db, "clanMembers"), where("uid", "==", user.uid), limit(20));
    const unsub = onSnapshot(q, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClanMember, "id">) }));
      if (rows.length === 0) {
        setMembers([]);
        setMyClan(null);
        return;
      }
      setMembers(rows);
      const clanId = rows[0]?.clanId;
      if (!clanId) {
        setMyClan(null);
        return;
      }
      const clanSnap = await getDoc(doc(fb.db, "clans", clanId));
      if (clanSnap.exists()) setMyClan({ id: clanSnap.id, ...(clanSnap.data() as Omit<Clan, "id">) });
      else setMyClan(null);
    });
    return () => unsub();
  }, [fb, user]);

  const discoverClans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return clans;
    return clans.filter((clan) =>
      clan.name.toLowerCase().includes(needle) || clan.tag.toLowerCase().includes(needle) || clan.motto.toLowerCase().includes(needle),
    );
  }, [clans, search]);

  const isEligible = canCreateClan(profile, config);
  const fee = getClanFeeById(config, form.feeId);

  const handleCreate = async () => {
    if (!fb || !user || !profile) return;
    setSubmitting(true);
    try {
      const created = await createClanRecord(fb.db, user.uid, form, config, profile);
      setMyClan(created);
      setForm({
        name: "",
        tag: "",
        description: "",
        motto: "",
        emblem: "shield",
        banner: "purple",
        feeId: "free",
      });
      setMembers([{ id: `${created.id}_${user.uid}`, clanId: created.id, uid: user.uid, role: "leader", joinedAt: Date.now(), contribution: 0, status: "active" }]);
    } catch (error) {
      window.alert((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (clanId: string) => {
    if (!fb || !user) return;
    try {
      await requestClanJoin(fb.db, clanId, user.uid);
      window.alert("Join request sent.");
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="space-y-6">
      <div className="hero-card relative overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-primary mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
              <ShieldCheck className="size-4" /> Juvora Clans
            </div>
            <h1 className="font-display text-3xl font-black">Clan Command</h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm">
              Build your squad, earn clan XP, complete missions, and compete for the top spot in the Juvora ladder.
            </p>
          </div>
          <div className="surface-card border-primary/20 p-3 text-sm">
            <div className="text-muted-foreground">Min creation level</div>
            <div className="font-display text-2xl font-black">{config.minCreationLevel}</div>
          </div>
        </div>
      </div>

      {myClan ? (
        <div className="space-y-6">
          <div className="surface-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-2xl font-black text-primary">
                  {myClan.tag.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black">{myClan.name}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {myClan.tag}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{myClan.motto}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">
                <Crown className="size-4" /> Level {myClan.level}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="surface-card p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">Clan XP</div>
                <div className="mt-1 text-xl font-black">{myClan.xp}</div>
              </div>
              <div className="surface-card p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">Capacity</div>
                <div className="mt-1 text-xl font-black">{myClan.capacity}</div>
              </div>
              <div className="surface-card p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">Battles</div>
                <div className="mt-1 text-xl font-black">{myClan.statistics.battles}</div>
              </div>
              <div className="surface-card p-3">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">Wins</div>
                <div className="mt-1 text-xl font-black">{myClan.statistics.wins}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Clan progress</span>
                <span>{clanProgress(myClan.level, myClan.xp).progress.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${clanProgress(myClan.level, myClan.xp).progress}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="surface-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h3 className="text-lg font-bold">Clan roster</h3>
              </div>
              <div className="space-y-2">
                {members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No members loaded yet.</div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-3">
                      <div>
                        <div className="font-semibold">{member.uid.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{getClanRoleLabel(member.role)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold">{member.contribution}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Contribution</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="size-4 text-accent" />
                <h3 className="text-lg font-bold">Clan profile</h3>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{myClan.description}</p>
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Emblem</div>
                  <div className="mt-1 font-semibold">{myClan.emblem}</div>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Banner</div>
                  <div className="mt-1 font-semibold">{myClan.banner}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Swords className="size-4 text-primary" />
              <h2 className="text-xl font-black">Create your clan</h2>
            </div>

            {!isEligible ? (
              <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning">
                You need to be level {config.minCreationLevel} or higher and not already in a clan to create one.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="clan-name">Clan name</Label>
                    <Input id="clan-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Storm Riders" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clan-tag">Clan tag</Label>
                    <Input id="clan-tag" value={form.tag} onChange={(event) => setForm({ ...form, tag: cleanClanTag(event.target.value) })} placeholder="SR" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clan-fee">Creation price</Label>
                    <select id="clan-fee" value={form.feeId} onChange={(event) => setForm({ ...form, feeId: event.target.value })} className="border-input bg-background text-foreground focus-visible:border-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                      {config.creationFees.map((fee) => (
                        <option key={fee.id} value={fee.id}>{fee.label} · {fee.coins} coins</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="clan-description">Description</Label>
                    <Input id="clan-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Competitive, disciplined, and focused on learning." />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="clan-motto">Motto</Label>
                    <Input id="clan-motto" value={form.motto} onChange={(event) => setForm({ ...form, motto: event.target.value })} placeholder="Rise together." />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emblem">Emblem</Label>
                    <Input id="emblem" value={form.emblem} onChange={(event) => setForm({ ...form, emblem: event.target.value })} placeholder="shield" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="banner">Banner</Label>
                    <Input id="banner" value={form.banner} onChange={(event) => setForm({ ...form, banner: event.target.value })} placeholder="purple" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/35 p-3 text-sm">
                  <div className="text-muted-foreground">Selected creation option</div>
                  <div className="mt-1 flex items-center justify-between font-semibold">
                    <span>{fee.label}</span>
                    <span>{fee.coins} coins</span>
                  </div>
                </div>

                <Button onClick={handleCreate} disabled={submitting || !isEligible} className="w-full">
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
                  {submitting ? "Creating clan..." : "Create clan"}
                </Button>
              </div>
            )}
          </div>

          <div className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Search className="size-4 text-accent" />
              <h2 className="text-xl font-black">Discover clans</h2>
            </div>

            <Input placeholder="Search clans by name or tag" value={search} onChange={(event) => setSearch(event.target.value)} />

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading clans...
                </div>
              ) : discoverClans.length === 0 ? (
                <div className="text-sm text-muted-foreground">No public clans match your search yet.</div>
              ) : (
                discoverClans.map((clan) => (
                  <div key={clan.id} className="rounded-2xl border border-border bg-card/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{clan.name}</span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            {clan.tag}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{clan.motto}</div>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Lv {clan.level}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{clan.capacity} members</span>
                      <span>{clan.statistics.wins} wins</span>
                    </div>
                    <Button variant="outline" className="mt-3 w-full" onClick={() => handleJoin(clan.id)}>
                      Request join
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
