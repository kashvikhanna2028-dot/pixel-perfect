import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, CalendarClock, Check,
  ChevronDown, CircleHelp, Clock3, Dumbbell, ExternalLink, Gift, History, KeyRound,
  Layers3, LogOut, Moon, MoreHorizontal, Plus, Radar, Settings2, Sparkles, Sun,
  Tag, TimerReset, Trash2, TrendingDown, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  dateTimeFieldToIso, formatCountdown, isUnused, isoToDateTimeFields, nextResetAt, type ResetType, type Tracker, type TrackerCategory,
  type TrackerDraft, unusedValue, urgencyFor,
} from "@/lib/expiry-radar";
import editorialStillLife from "@/assets/expiry-radar-still-life.jpg";

const categories: { value: TrackerCategory; label: string; Icon: typeof Layers3 }[] = [
  { value: "llm_credits", label: "AI credits", Icon: Sparkles },
  { value: "api_quota", label: "API quota", Icon: KeyRound },
  { value: "free_minutes", label: "Free minutes", Icon: Clock3 },
  { value: "gym_pass", label: "Gym pass", Icon: Dumbbell },
  { value: "coupon", label: "Coupon", Icon: Tag },
  { value: "free_trial", label: "Free trial", Icon: TimerReset },
  { value: "other", label: "Other", Icon: Layers3 },
];

const categoryLabel = (category: string) => categories.find((entry) => entry.value === category)?.label ?? "Other";
const unitLabel = (unit: string) => unit === "$" ? "value" : unit;
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function displayDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function currentTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 ${inverse ? "text-primary-foreground" : "text-foreground"}`}>
    <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Radar className="size-5" strokeWidth={1.8} /></span>
    <span className="font-display text-lg font-semibold">Expiry Radar</span>
  </span>;
}

export function LandingPage() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) setSession(Boolean(data.session)); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => setSession(Boolean(authSession)));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  return <main className="min-h-screen bg-background">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
      <Brand />
      <nav className="flex items-center gap-3">
        <Link to={session ? "/dashboard" : "/auth"} className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex">{session ? "Open dashboard" : "Log in"}</Link>
        <Button asChild size="sm"><Link to={session ? "/dashboard" : "/auth"}>{session ? "My trackers" : "Get started"}<ArrowRight /></Link></Button>
      </nav>
    </header>

    <section className="mx-auto max-w-7xl px-5 md:px-10">
      <div className="radar-hero relative isolate min-h-[480px] overflow-hidden rounded-lg bg-foreground md:min-h-[540px]">
        <img className="absolute inset-0 -z-20 size-full object-cover object-center" src={editorialStillLife} alt="A timer, calendar, gym pass, and coupon arranged on a dark desk" width={1536} height={1024} fetchPriority="high" />
        <div className="landing-hero-shade absolute inset-0 -z-10" />
        <div className="flex min-h-[480px] max-w-2xl flex-col justify-center px-7 py-12 md:min-h-[540px] md:px-14">
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><span className="size-1.5 rounded-full bg-primary" /> Keep what you already have</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.03] tracking-tight text-foreground sm:text-6xl">Use it before<br />you lose it.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground md:text-lg">One quiet place for the credits, passes, trials and perks that won’t wait around.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to={session ? "/dashboard" : "/auth"}>{session ? "Go to your radar" : "Create your free account"}<ArrowRight /></Link></Button>
            {!session && <Button asChild size="lg" variant="outline"><Link to="/auth">Log in</Link></Button>}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">A clear view of what’s next. No more “I meant to use that.”</p>
        </div>
        <div className="absolute bottom-5 right-6 hidden items-center gap-2 rounded-md border border-border/70 bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur md:flex"><Clock3 className="size-3.5 text-primary" /> Time is the one thing you can’t roll over.</div>
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-0 px-5 pb-16 pt-10 sm:grid-cols-3 md:px-10 md:pt-14">
      <Feature Icon={CalendarClock} number="01" title="Everything has a date" detail="Keep monthly credits, daily limits, expiring passes, and one-time offers together." />
      <Feature Icon={TrendingDown} number="02" title="Know what’s at risk" detail="See what’s running out soon and the value still sitting unused." />
      <Feature Icon={BarChart3} number="03" title="Make every bit count" detail="Log usage as it happens, and see your history when you need it." />
    </section>
    <footer className="mx-auto flex max-w-7xl items-center justify-between border-t border-border px-5 py-5 text-xs text-muted-foreground md:px-10"><Brand /><span>Make the most of what you have.</span></footer>
  </main>;
}

function Feature({ Icon, number, title, detail }: { Icon: typeof Clock3; number: string; title: string; detail: string }) {
  return <article className="border-t border-border py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-6">
    <div className="flex items-center justify-between"><span className="text-xs tabular-nums text-muted-foreground">{number}</span><Icon className="size-4 text-primary" strokeWidth={1.8} /></div>
    <h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{detail}</p>
  </article>;
}

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const emailSchema = z.string().trim().email().max(255);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive && data.session) void navigate({ to: "/dashboard" }); });
    return () => { alive = false; };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success || password.length < 8 || password.length > 128 || (mode === "signup" && !displayName.trim())) {
      setMessage("Add a valid email, a password with at least 8 characters, and your name to create an account."); return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: displayName.trim().slice(0, 80) } },
        });
        if (error) throw error;
        if (!data.session) { setMessage("Check your inbox for a confirmation link, then come back to log in."); return; }
        await navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password });
        if (error) throw error;
        await navigate({ to: "/dashboard" });
      }
    } catch (error) { setMessage(friendlyAuthError(error)); }
    finally { setBusy(false); }
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setBusy(true); setMessage("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) await navigate({ to: "/dashboard" });
    } catch (error) { setMessage(friendlyAuthError(error)); setBusy(false); }
  }

  return <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_0.88fr]">
    <aside className="relative hidden min-h-screen overflow-hidden bg-foreground lg:block">
      <img src={editorialStillLife} alt="Calendar and timer beside a gym pass and coupon" width={1536} height={1024} className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-background/45" />
      <div className="absolute inset-x-0 top-0 p-10"><Brand /></div>
      <div className="absolute inset-x-0 bottom-0 p-10 text-primary-foreground"><p className="max-w-md text-4xl font-semibold leading-tight">“I’ll use it later” has a way of turning into never.</p><p className="mt-4 text-sm text-primary-foreground/75">Let your radar remember for you.</p></div>
    </aside>
    <section className="flex min-h-screen flex-col justify-between px-6 py-7 sm:px-12 lg:px-16">
      <header className="flex items-center justify-between"><Link to="/" aria-label="Expiry Radar home"><span className="lg:hidden"><Brand /></span></Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link></header>
      <div className="mx-auto w-full max-w-md py-10 radar-enter">
        <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground"><Radar className="size-5" /></span>
        <p className="mt-7 text-sm font-medium text-primary">Your next reset starts here</p>
        <h1 className="mt-2 text-3xl font-semibold">{mode === "signup" ? "Make room for more." : "Welcome back."}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "signup" ? "Create an account and keep every allowance in view." : "Sign in to pick up right where you left off."}</p>
        <div className="mt-7 grid grid-cols-2 gap-1 border-b border-border text-sm">
          <button type="button" onClick={() => { setMode("signup"); setMessage(""); }} className={`border-b-2 pb-3 font-medium ${mode === "signup" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>Create account</button>
          <button type="button" onClick={() => { setMode("login"); setMessage(""); }} className={`border-b-2 pb-3 font-medium ${mode === "login" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>Log in</button>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && <div className="space-y-2"><Label htmlFor="displayName">Your name</Label><Input id="displayName" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required /></div>}
          <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></div>
          {message && <p role="status" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2.5 text-sm text-foreground">{message}</p>}
          <Button className="w-full" type="submit" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create your account" : "Log in"}<ArrowRight /></Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void socialSignIn("google")}>Google</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void socialSignIn("lovable")}>Lovable</Button>
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">By continuing, you agree to use your account for your own personal trackers.</p>
      </div>
      <p className="text-center text-xs text-muted-foreground">Keep what matters. Use what you have.</p>
    </section>
  </main>;
}

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Please try again in a moment.";
  if (message.toLowerCase().includes("invalid login credentials")) return "That email and password don’t match. Check them and try again.";
  if (message.toLowerCase().includes("already registered")) return "An account with that email already exists. Try logging in instead.";
  if (message.toLowerCase().includes("password")) return "Please choose a password with at least 8 characters.";
  if (message.toLowerCase().includes("rate limit")) return "Too many attempts just now. Give it a moment, then try again.";
  return "We couldn’t complete that just now. Please check your details and try again.";
}

export function ProtectedLayout() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ email: string; displayName: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [profile, setProfile] = useState<{ display_name: string; timezone: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("expiry-radar-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    let alive = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !alive) return;
      const { data: profileData } = await supabase.from("profiles").select("display_name, timezone").eq("user_id", data.user.id).maybeSingle();
      if (alive) {
        setAuth({ email: data.user.email ?? "", displayName: profileData?.display_name || data.user.email?.split("@")[0] || "" });
        setProfile(profileData ?? { display_name: "", timezone: currentTimeZone() });
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setAuth(null); void router.navigate({ to: "/auth", replace: true }); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("expiry-radar-theme", theme);
  }, [theme]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("You’re signed out.");
    await router.navigate({ to: "/auth", replace: true });
  }

  const navItems = [
    { to: "/dashboard" as const, label: "My radar", Icon: Radar },
    { to: "/history" as const, label: "Usage history", Icon: History },
    { to: "/settings" as const, label: "Settings", Icon: Settings2 },
  ];
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-surface px-5 py-6 lg:flex">
      <Link to="/dashboard" className="mb-10"><Brand /></Link>
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
      <nav className="space-y-1">{navItems.map(({ to, label, Icon }) => <Link key={to} to={to} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent text-accent-foreground" }}><Icon className="size-4" />{label}</Link>)}</nav>
      <div className="mt-auto rounded-lg border border-border bg-surface-raised p-4"><p className="flex items-center gap-2 text-xs font-medium"><CircleHelp className="size-4 text-primary" />Make it count.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Every reset is a fresh chance to use what you have.</p></div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-8">
        <div className="lg:hidden"><Link to="/dashboard"><Brand /></Link></div>
        <p className="hidden text-sm text-muted-foreground lg:block">A little more use from what’s already yours.</p>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:block">{auth?.displayName || auth?.email || "Loading account…"}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}><LogOut /> <span className="hidden sm:inline">Log out</span></Button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">{navItems.map(({ to, label, Icon }) => <Link key={to} to={to} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent text-accent-foreground" }}><Icon className="size-4" />{label}</Link>)}</nav>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9"><Outlet /></main>
    </div>
  </div>;
}

export function DashboardPage() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState("all");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [logging, setLogging] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  const reload = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUserId(userData.user.id);
    const { data, error } = await supabase.from("trackers").select("*").eq("user_id", userData.user.id).order("next_reset_at", { ascending: true, nullsFirst: false });
    if (error) toast.error("Your trackers couldn’t be loaded.");
    else setTrackers((data ?? []) as Tracker[]);
    setBusy(false);
  };

  useEffect(() => { void reload(); const interval = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(interval); }, []);

  useEffect(() => {
    if (!userId || trackers.length === 0) return;
    const nowIso = new Date().toISOString();
    const passed = trackers.filter((tracker) => tracker.reset_type !== "one_time" && tracker.next_reset_at && tracker.next_reset_at <= nowIso);
    if (passed.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const tracker of passed) {
        const next = nextResetAt(tracker.reset_type, tracker.reset_day, tracker.reset_time, tracker.timezone, new Date());
        if (!next) continue;
        const { error } = await supabase.from("trackers").update({ used_amount: 0, next_reset_at: next.toISOString() })
          .eq("id", tracker.id).eq("user_id", userId).lte("next_reset_at", nowIso);
        if (error) toast.error(`A reset for ${tracker.name} couldn’t be saved.`);
      }
      if (!cancelled) await reload();
    })();
    return () => { cancelled = true; };
  }, [trackers, userId]);

  const active = trackers.filter((item) => !(item.reset_type === "one_time" && item.expires_at && new Date(item.expires_at) <= now));
  const expired = trackers.filter((item) => item.reset_type === "one_time" && item.expires_at && new Date(item.expires_at) <= now);
  const atRisk = active.filter((item) => item.next_reset_at && new Date(item.next_reset_at).getTime() - now.getTime() <= 7 * 86_400_000 && isUnused(item));
  const riskValue = atRisk.reduce((sum, item) => sum + unusedValue(item), 0);
  const filtered = active.filter((item) => filter === "all" || item.category === filter)
    .filter((item) => !atRiskOnly || atRisk.includes(item))
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => new Date(a.next_reset_at ?? a.expires_at ?? "9999-12-31").getTime() - new Date(b.next_reset_at ?? b.expires_at ?? "9999-12-31").getTime() || unusedValue(b) - unusedValue(a));

  async function logUsage(tracker: Tracker, amountValue: number) {
    if (!userId || !Number.isFinite(amountValue) || amountValue <= 0 || amountValue > tracker.total_amount - tracker.used_amount) {
      toast.error("Enter an amount that fits within the remaining allowance."); return;
    }
    const updatedUsed = tracker.used_amount + amountValue;
    const { error: updateError } = await supabase.from("trackers").update({ used_amount: updatedUsed }).eq("id", tracker.id).eq("user_id", userId);
    if (updateError) { toast.error("Usage couldn’t be updated. Please try again."); return; }
    const { error: logError } = await supabase.from("usage_logs").insert({ tracker_id: tracker.id, user_id: userId, amount: amountValue });
    if (logError) {
      await supabase.from("trackers").update({ used_amount: tracker.used_amount }).eq("id", tracker.id).eq("user_id", userId);
      toast.error("Your usage history couldn’t be saved. Please try again."); return;
    }
    toast.success(`${numberFormat.format(amountValue)} ${unitLabel(tracker.unit)} logged.`);
    setLogging(null); setAmount("1"); await reload();
  }

  async function deleteTracker(tracker: Tracker) {
    if (!userId || !window.confirm(`Delete “${tracker.name}” and its usage history?`)) return;
    const { error } = await supabase.from("trackers").delete().eq("id", tracker.id).eq("user_id", userId);
    if (error) toast.error("That tracker couldn’t be deleted.");
    else { toast.success("Tracker deleted."); await reload(); }
  }

  return <div className="space-y-8 radar-enter">
    <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><span className="size-1.5 rounded-full bg-success" /> Your account, at a glance</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A little time left.</h1><p className="mt-2 text-sm text-muted-foreground">Make the most of what’s about to reset.</p></div>
      <Button onClick={() => void navigate({ to: "/tracker-new" })}><Plus /> Add a tracker</Button>
    </section>
    <section aria-label="At risk summary" className="relative grid gap-5 overflow-hidden rounded-lg border border-border bg-surface px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7">
      <div><p className="text-sm font-medium">{atRisk.length === 1 ? "1 thing expires" : `${atRisk.length} things expire`} within 7 days</p><p className="mt-1 text-sm text-muted-foreground">There’s about <strong className="font-semibold text-foreground">{currencyFormat.format(riskValue)}</strong> still to use.</p></div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="grid size-9 place-items-center rounded-full bg-warning/20 text-warning-foreground"><Bell className="size-4" /></span>Make it count</div>
    </section>

    <section>
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-semibold">Your allowances</h2><p className="mt-1 text-sm text-muted-foreground">{active.length} active {active.length === 1 ? "tracker" : "trackers"}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Search trackers" placeholder="Find a tracker" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-40" />
          <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-xs text-muted-foreground"><input type="checkbox" className="accent-primary" checked={atRiskOnly} onChange={(event) => setAtRiskOnly(event.target.checked)} />At risk</label>
          <select aria-label="Filter by category" className="h-9 max-w-40 rounded-md border border-input bg-background px-3 text-xs" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </div>
      </div>
      {busy ? <div className="grid gap-3 md:grid-cols-2"><div className="h-48 animate-pulse rounded-lg bg-muted" /><div className="h-48 animate-pulse rounded-lg bg-muted" /></div> : filtered.length === 0 ? <EmptyTrackers hasTrackers={active.length > 0} onAdd={() => void navigate({ to: "/tracker-new" })} /> :
        <div className="grid gap-3 xl:grid-cols-2">{filtered.map((tracker) => <TrackerCard key={tracker.id} tracker={tracker} now={now} logging={logging === tracker.id} amount={amount} onAmount={setAmount} onLog={() => void logUsage(tracker, 1)} onCustomLog={() => void logUsage(tracker, Number(amount))} onOpenLog={() => { setLogging(logging === tracker.id ? null : tracker.id); setAmount("1"); }} onEdit={() => void navigate({ to: "/tracker-edit/$id", params: { id: tracker.id } })} onDelete={() => void deleteTracker(tracker)} />)}</div>}
    </section>

    {expired.length > 0 && <section><div className="mb-4"><h2 className="text-xl font-semibold">Expired</h2><p className="mt-1 text-sm text-muted-foreground">One-time offers that have passed their date.</p></div><div className="grid gap-3 xl:grid-cols-2">{expired.map((tracker) => <TrackerCard key={tracker.id} tracker={tracker} now={now} expired logging={false} amount={amount} onAmount={setAmount} onLog={() => {}} onCustomLog={() => {}} onOpenLog={() => {}} onEdit={() => void navigate({ to: "/tracker-edit/$id", params: { id: tracker.id } })} onDelete={() => void deleteTracker(tracker)} />)}</div></section>}
  </div>;
}

function EmptyTrackers({ hasTrackers, onAdd }: { hasTrackers: boolean; onAdd: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
    <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><Radar className="size-6" /></span>
    <h3 className="mt-4 text-lg font-semibold">{hasTrackers ? "Nothing matches that view." : "Your radar is clear."}</h3>
    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{hasTrackers ? "Try a different category or search." : "Add the credits, passes, and trials you want to keep an eye on."}</p>
    {!hasTrackers && <Button className="mt-5" onClick={onAdd}><Plus /> Add your first tracker</Button>}
  </div>;
}

function TrackerCard({ tracker, now, expired = false, logging, amount, onAmount, onLog, onCustomLog, onOpenLog, onEdit, onDelete }: {
  tracker: Tracker; now: Date; expired?: boolean; logging: boolean; amount: string; onAmount: (value: string) => void;
  onLog: () => void; onCustomLog: () => void; onOpenLog: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const category = categories.find((item) => item.value === tracker.category) ?? { value: "other" as const, label: "Other", Icon: Layers3 };
  const Icon = category.Icon;
  const remaining = Math.max(0, tracker.total_amount - tracker.used_amount);
  const percent = Math.min(100, tracker.total_amount === 0 ? 0 : tracker.used_amount / tracker.total_amount * 100);
  const deadlineValue = tracker.reset_type === "one_time" ? tracker.expires_at : tracker.next_reset_at;
  const deadline = deadlineValue ? new Date(deadlineValue) : null;
  const tone = expired ? "urgent" : deadline ? urgencyFor(deadline, now, isUnused(tracker) && remaining >= tracker.total_amount / 2) : "calm";
  const toneClasses = tone === "urgent" ? "text-urgency" : tone === "warning" ? "text-warning-foreground" : "text-success";
  const usedPercent = Math.round(percent);
  const nudge = tracker.used_amount >= tracker.total_amount ? "Fully used — nothing left to waste." : expired ? `${numberFormat.format(remaining)} ${unitLabel(tracker.unit)} went unused.` : deadline && (deadline.getTime() - now.getTime()) < 48 * 3_600_000 ? `You’ve used ${usedPercent}%. Nearly up — put the rest to use.` : deadline && (deadline.getTime() - now.getTime()) < 7 * 86_400_000 ? `You’ve used ${usedPercent}%. A few days left — make time to use it.` : `You’ve used ${usedPercent}%. There’s time to make the most of it.`;
  const menu = [{ label: "Edit tracker", Icon: ExternalLink, action: onEdit }, { label: "Delete tracker", Icon: Trash2, action: onDelete }];
  return <article className="rounded-lg border border-border bg-surface-raised p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Icon className="size-5" /></span><div className="min-w-0"><h3 className="truncate font-semibold">{tracker.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel(tracker.category)} · {tracker.reset_type === "one_time" ? "One-time" : `${tracker.reset_type[0]?.toUpperCase()}${tracker.reset_type.slice(1)} reset`}</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><span className={`hidden rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold sm:inline-flex ${toneClasses}`}>{tracker.used_amount >= tracker.total_amount ? "Fully used" : expired ? "Expired" : tone === "urgent" ? "Urgent" : tone === "warning" ? "Soon" : "On track"}</span>{menu.map(({ label, Icon: MenuIcon, action }) => <Button key={label} type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={action}><MenuIcon className="size-4" /></Button>)}</div>
    </div>
    <div className="mt-5 flex items-baseline justify-between gap-3"><div><p className="text-xs text-muted-foreground">Remaining</p><p className="mt-1 text-2xl font-semibold tabular-nums">{numberFormat.format(remaining)} <span className="text-sm font-normal text-muted-foreground">{unitLabel(tracker.unit)}</span></p></div><div className={`text-right ${toneClasses}`}><p className="text-xs text-muted-foreground">{expired ? "Expired" : tracker.reset_type === "one_time" ? "Expires in" : "Resets in"}</p><p className="mt-1 text-sm font-semibold tabular-nums">{deadline ? formatCountdown(deadline, now) : "—"}</p></div></div>
    <Progress value={percent} className="mt-4 h-1.5" aria-label={`${numberFormat.format(percent)} percent used`} />
    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{numberFormat.format(Math.min(tracker.used_amount, tracker.total_amount))} used of {numberFormat.format(tracker.total_amount)}</span>{deadline && <span>{displayDate(deadline, tracker.timezone)}</span>}</div>
    {tracker.cost_value !== null && isUnused(tracker) && <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5" />{currencyFormat.format(unusedValue(tracker))} in unused value</p>}
    <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${toneClasses}`}><span className="size-1.5 rounded-full bg-current" />{nudge}</p>
    {!expired && isUnused(tracker) && <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">{!logging ? <><Button type="button" size="sm" onClick={onLog}><Plus /> +1</Button><Button type="button" variant="outline" size="sm" onClick={onOpenLog}>Log usage</Button></> : <form className="flex w-full items-center gap-2" onSubmit={(event) => { event.preventDefault(); onCustomLog(); }}><Label htmlFor={`amount-${tracker.id}`} className="sr-only">Amount</Label><Input id={`amount-${tracker.id}`} type="number" inputMode="decimal" min="0.01" max={remaining} step="any" value={amount} onChange={(event) => onAmount(event.target.value)} className="h-8 w-28" autoFocus /><span className="truncate text-xs text-muted-foreground">{unitLabel(tracker.unit)}</span><Button type="submit" size="sm">Log</Button><Button type="button" variant="ghost" size="icon" aria-label="Cancel usage entry" onClick={onOpenLog}><X /></Button></form>}</div>}
  </article>;
}

const presetValues: Record<string, Pick<TrackerDraft, "category" | "unit" | "total_amount" | "used_amount" | "reset_type" | "reset_day" | "cost_value">> = {
  "Claude Pro": { category: "llm_credits", unit: "messages", total_amount: 100, used_amount: 0, reset_type: "weekly", reset_day: 1, cost_value: 20 },
  "ChatGPT Plus": { category: "llm_credits", unit: "messages", total_amount: 80, used_amount: 0, reset_type: "weekly", reset_day: 1, cost_value: 20 },
  "Gemini Advanced": { category: "llm_credits", unit: "prompts", total_amount: 100, used_amount: 0, reset_type: "daily", reset_day: null, cost_value: 20 },
  Cursor: { category: "llm_credits", unit: "requests", total_amount: 500, used_amount: 0, reset_type: "monthly", reset_day: 1, cost_value: 20 },
  "GitHub Copilot": { category: "llm_credits", unit: "requests", total_amount: 300, used_amount: 0, reset_type: "monthly", reset_day: 1, cost_value: 10 },
  "Gym membership": { category: "gym_pass", unit: "visits", total_amount: 12, used_amount: 0, reset_type: "monthly", reset_day: 1, cost_value: 45 },
  "Generic coupon": { category: "coupon", unit: "$", total_amount: 1, used_amount: 0, reset_type: "one_time", reset_day: null, cost_value: null },
};

const trackerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["llm_credits", "api_quota", "free_minutes", "gym_pass", "coupon", "free_trial", "other"]),
  unit: z.string().trim().min(1).max(32),
  total_amount: z.coerce.number().positive().finite(),
  used_amount: z.coerce.number().min(0).finite(),
  reset_type: z.enum(["one_time", "daily", "weekly", "monthly"]),
  reset_day: z.number().nullable(),
  expires_at: z.string().nullable(),
  reset_time: z.string(),
  timezone: z.string().min(1).max(80),
  cost_value: z.number().nonnegative().nullable(),
  notes: z.string().max(1000),
}).refine((value) => value.used_amount <= value.total_amount, { path: ["used_amount"], message: "Used amount can’t be greater than the total." })
  .refine((value) => value.reset_type !== "one_time" || Boolean(value.expires_at), { path: ["expires_at"], message: "Choose an expiry date." })
  .refine((value) => { try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }); return true; } catch { return false; } }, { path: ["timezone"], message: "Enter a valid IANA time zone." });

export function TrackerEditorPage({ trackerId }: { trackerId?: string }) {
  const navigate = useNavigate();
  const isEdit = Boolean(trackerId);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("");
  const [form, setForm] = useState({
    name: "", category: "other" as TrackerCategory, unit: "credits", total_amount: "100", used_amount: "0",
    reset_type: "monthly" as ResetType, reset_day: "1", expires_at: "", reset_time: "09:00", timezone: currentTimeZone(), cost_value: "", notes: "",
  });

  useEffect(() => {
    if (!trackerId) return;
    let alive = true;
    void supabase.from("trackers").select("*").eq("id", trackerId).maybeSingle().then(({ data, error: loadError }) => {
      if (!alive) return;
      if (loadError || !data) { toast.error("That tracker could not be found."); void navigate({ to: "/dashboard" }); return; }
      const dateFields = data.expires_at ? isoToDateTimeFields(data.expires_at, data.timezone) : { date: "", time: data.reset_time.slice(0, 5) };
      setForm({ name: data.name, category: data.category as TrackerCategory, unit: data.unit, total_amount: String(data.total_amount), used_amount: String(data.used_amount), reset_type: data.reset_type as ResetType, reset_day: data.reset_day === null ? "" : String(data.reset_day), expires_at: dateFields.date, reset_time: dateFields.time, timezone: data.timezone, cost_value: data.cost_value === null ? "" : String(data.cost_value), notes: data.notes });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [trackerId, navigate]);

  useEffect(() => {
    if (trackerId) return;
    let alive = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", data.user.id).maybeSingle();
      if (alive && profile?.timezone) setForm((old) => ({ ...old, timezone: profile.timezone }));
    });
    return () => { alive = false; };
  }, [trackerId]);

  function applyPreset(name: string) {
    setPreset(name);
    const value = presetValues[name];
    if (!value) { setForm((old) => ({ ...old, name })); return; }
    const expires = value.reset_type === "one_time" ? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) : "";
    setForm((old) => ({ ...old, name, category: value.category, unit: value.unit, total_amount: String(value.total_amount), used_amount: String(value.used_amount), reset_type: value.reset_type, reset_day: value.reset_day === null ? "" : String(value.reset_day), cost_value: value.cost_value === null ? "" : String(value.cost_value), expires_at: expires }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    let expiresAt: string | null = null;
    try { expiresAt = dateTimeFieldToIso(form.expires_at, form.reset_time, form.timezone); }
    catch { expiresAt = null; }
    const raw = { name: form.name, category: form.category, unit: form.unit, total_amount: form.total_amount, used_amount: form.used_amount, reset_type: form.reset_type, reset_day: form.reset_day === "" ? null : Number(form.reset_day), expires_at: expiresAt, reset_time: form.reset_time, timezone: form.timezone, cost_value: form.cost_value === "" ? null : Number(form.cost_value), notes: form.notes };
    const parsed = trackerSchema.safeParse(raw);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your entries and try again."); return; }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError("Please log in again to save this tracker."); return; }
    const next = parsed.data.reset_type === "one_time" ? null : nextResetAt(parsed.data.reset_type, parsed.data.reset_day, parsed.data.reset_time, parsed.data.timezone, new Date());
    const payload = { ...parsed.data, next_reset_at: parsed.data.reset_type === "one_time" ? parsed.data.expires_at : next?.toISOString() ?? null };
    setBusy(true);
    const result = trackerId
      ? await supabase.from("trackers").update(payload).eq("id", trackerId).eq("user_id", authData.user.id)
      : await supabase.from("trackers").insert({ ...payload, user_id: authData.user.id });
    setBusy(false);
    if (result.error) { toast.error("The tracker couldn’t be saved. Check your entries and try again."); return; }
    toast.success(trackerId ? "Tracker updated." : "Tracker added.");
    await navigate({ to: "/dashboard" });
  }

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  return <div className="mx-auto max-w-3xl radar-enter">
    <div className="mb-7"><Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← My radar</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{isEdit ? "Keep it current" : "Add to your radar"}</p><h1 className="mt-2 text-3xl font-semibold">{isEdit ? "Edit tracker" : "Add a tracker"}</h1><p className="mt-2 text-sm text-muted-foreground">Put in the details, and we’ll keep the countdown for you.</p></div>
    <form onSubmit={save} className="space-y-6">
      {!isEdit && <div className="rounded-lg border border-border bg-surface p-5"><Label htmlFor="preset">Start with a preset</Label><select id="preset" value={preset} onChange={(event) => applyPreset(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose a service or start from scratch</option>{Object.keys(presetValues).map((name) => <option key={name}>{name}</option>)}</select></div>}
      <div className="grid gap-5 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="name">Name</Label><Input id="name" maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Claude Pro" required /></div>
        <div className="space-y-2"><Label htmlFor="category">Category</Label><select id="category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as TrackerCategory })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="unit">Unit</Label><Input id="unit" maxLength={32} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="credits, minutes, visits…" required /></div>
        <div className="space-y-2"><Label htmlFor="total">Total amount</Label><Input id="total" type="number" min="0.01" step="any" value={form.total_amount} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="used">Already used</Label><Input id="used" type="number" min="0" step="any" value={form.used_amount} onChange={(event) => setForm({ ...form, used_amount: event.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="reset">Reset schedule</Label><select id="reset" value={form.reset_type} onChange={(event) => setForm({ ...form, reset_type: event.target.value as ResetType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="one_time">One-time expiry</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        {form.reset_type === "weekly" && <div className="space-y-2"><Label htmlFor="reset-day">Reset weekday</Label><select id="reset-day" value={form.reset_day} onChange={(event) => setForm({ ...form, reset_day: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, i) => <option key={label} value={i}>{label}</option>)}</select></div>}
        {form.reset_type === "monthly" && <div className="space-y-2"><Label htmlFor="reset-day">Reset day of month</Label><Input id="reset-day" type="number" min="1" max="31" value={form.reset_day} onChange={(event) => setForm({ ...form, reset_day: event.target.value })} required /></div>}
        {form.reset_type !== "one_time" && <div className="space-y-2"><Label htmlFor="reset-time">Reset time</Label><Input id="reset-time" type="time" value={form.reset_time} onChange={(event) => setForm({ ...form, reset_time: event.target.value })} required /></div>}
        {form.reset_type === "one_time" && <div className="space-y-2"><Label htmlFor="expires">Expiry date</Label><Input id="expires" type="date" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} required /></div>}
        <div className="space-y-2"><Label htmlFor="timezone">Time zone</Label><Input id="timezone" value={form.timezone} maxLength={80} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="America/New_York" required /></div>
        <div className="space-y-2"><Label htmlFor="value">Total value (optional)</Label><Input id="value" type="number" min="0" step="any" value={form.cost_value} onChange={(event) => setForm({ ...form, cost_value: event.target.value })} placeholder="$" /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes (optional)</Label><textarea id="notes" maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Anything you want to remember…" /></div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => void navigate({ to: "/dashboard" })}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Add tracker"}<Check /></Button></div>
    </form>
  </div>;
}

export function HistoryPage() {
  const [rows, setRows] = useState<{ id: string; amount: number; logged_at: string; tracker_id: string; trackers: { name: string } | null }[]>([]);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      const { data, error } = await supabase.from("usage_logs").select("id, amount, logged_at, tracker_id, trackers(name)").eq("user_id", auth.user.id).order("logged_at", { ascending: false }).limit(250);
      if (!alive) return;
      if (error) toast.error("Usage history couldn’t be loaded.");
      setRows((data ?? []) as typeof rows); setBusy(false);
    });
    return () => { alive = false; };
  }, []);
  return <section className="radar-enter">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The things you’ve used</p><h1 className="mt-3 text-3xl font-semibold">Usage history</h1><p className="mt-2 text-sm text-muted-foreground">A running record of what you’ve put to good use.</p>
    <div className="mt-7 overflow-hidden rounded-lg border border-border bg-surface-raised">
      {busy ? <div className="h-48 animate-pulse bg-muted" /> : rows.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-accent text-accent-foreground"><History className="size-5" /></span><h2 className="mt-4 font-semibold">No usage logged yet</h2><p className="mt-2 text-sm text-muted-foreground">When you log a use from a tracker, it will show up here.</p><Button asChild variant="outline" className="mt-5"><Link to="/dashboard">View your trackers<ArrowRight /></Link></Button></div> : <div className="divide-y divide-border">{rows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><ArrowUpRight className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{row.trackers?.name ?? "Tracker"}</p><p className="mt-1 text-xs text-muted-foreground">Usage logged</p></div></div><span className="text-sm font-semibold tabular-nums">−{numberFormat.format(row.amount)}</span><time className="col-span-2 text-xs text-muted-foreground sm:col-span-1">{displayDate(new Date(row.logged_at), currentTimeZone())}</time></div>)}</div>}
    </div>
    {rows.length === 250 && <p className="mt-3 text-xs text-muted-foreground">Showing the latest 250 entries.</p>}
  </section>;
}

export function SettingsPage() {
  const [profile, setProfile] = useState({ display_name: "", timezone: currentTimeZone() });
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const timeZones = useMemo(() => Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [currentTimeZone(), "UTC"], []);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profileData } = await supabase.from("profiles").select("display_name, timezone").eq("user_id", data.user.id).maybeSingle();
      if (!alive) return;
      setUserId(data.user.id);
      const nextProfile = { display_name: profileData?.display_name ?? data.user.email?.split("@")[0] ?? "", timezone: profileData?.timezone ?? currentTimeZone() };
      setProfile(nextProfile); setDisplayName(nextProfile.display_name); setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const name = displayName.trim();
    if (!name || name.length > 80) { toast.error("Add a name between 1 and 80 characters."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name, timezone: profile.timezone, updated_at: new Date().toISOString() }).eq("user_id", userId);
    setSaving(false);
    if (error) toast.error("Your settings couldn’t be saved."); else { setProfile({ ...profile, display_name: name }); toast.success("Settings saved."); }
  }

  async function loadDemo() {
    if (!userId) return;
    const tz = profile.timezone;
    const recurring = (resetType: ResetType, resetDay: number | null, time: string) => nextResetAt(resetType, resetDay, time, tz, new Date())?.toISOString() ?? null;
    const samples: Omit<Tracker, "id" | "created_at">[] = [
      { user_id: userId, name: "Claude Pro", category: "llm_credits", unit: "messages", total_amount: 100, used_amount: 28, reset_type: "weekly", reset_day: 1, expires_at: null, reset_time: "09:00:00", timezone: tz, cost_value: 20, notes: "Try it before the weekly reset.", next_reset_at: recurring("weekly", 1, "09:00") },
      { user_id: userId, name: "ChatGPT Plus", category: "llm_credits", unit: "messages", total_amount: 80, used_amount: 12, reset_type: "weekly", reset_day: 4, expires_at: null, reset_time: "09:00:00", timezone: tz, cost_value: 20, notes: "", next_reset_at: recurring("weekly", 4, "09:00") },
      { user_id: userId, name: "Gemini Advanced", category: "llm_credits", unit: "prompts", total_amount: 100, used_amount: 61, reset_type: "daily", reset_day: null, expires_at: null, reset_time: "21:00:00", timezone: tz, cost_value: 20, notes: "", next_reset_at: recurring("daily", null, "21:00") },
      { user_id: userId, name: "Cursor requests", category: "api_quota", unit: "requests", total_amount: 500, used_amount: 200, reset_type: "monthly", reset_day: 1, expires_at: null, reset_time: "00:00:00", timezone: tz, cost_value: 20, notes: "", next_reset_at: recurring("monthly", 1, "00:00") },
      { user_id: userId, name: "Gym membership", category: "gym_pass", unit: "visits", total_amount: 12, used_amount: 4, reset_type: "monthly", reset_day: 1, expires_at: null, reset_time: "00:00:00", timezone: tz, cost_value: 45, notes: "", next_reset_at: recurring("monthly", 1, "00:00") },
      { user_id: userId, name: "Weekend coupon", category: "coupon", unit: "$", total_amount: 30, used_amount: 0, reset_type: "one_time", reset_day: null, expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), reset_time: "23:59:00", timezone: tz, cost_value: 30, notes: "Use before it expires.", next_reset_at: new Date(Date.now() + 3 * 86_400_000).toISOString() },
    ];
    const { error } = await supabase.from("trackers").insert(samples);
    if (error) toast.error("Demo trackers couldn’t be added."); else toast.success("Six demo trackers added.");
  }

  async function deleteAll() {
    if (!userId || !window.confirm("Delete all your trackers and usage history? Your account and profile will stay.")) return;
    const { error } = await supabase.from("trackers").delete().eq("user_id", userId);
    if (error) toast.error("Your data couldn’t be deleted.");
    else { await supabase.from("usage_logs").delete().eq("user_id", userId); toast.success("All trackers and usage history deleted."); }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  return <section className="mx-auto max-w-3xl radar-enter"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Your account</p><h1 className="mt-3 text-3xl font-semibold">Settings</h1><p className="mt-2 text-sm text-muted-foreground">A few details that make your radar feel like yours.</p>
    <form onSubmit={(event) => void saveProfile(event)} className="mt-7 rounded-lg border border-border bg-surface-raised p-5 sm:p-6"><h2 className="text-lg font-semibold">Profile</h2><p className="mt-1 text-sm text-muted-foreground">Personal details and the time zone used for new trackers.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="setting-name">Display name</Label><Input id="setting-name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="default-timezone">Default time zone</Label><select id="default-timezone" value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value={profile.timezone}>{profile.timezone}</option>{timeZones.filter((zone) => zone !== profile.timezone).map((zone) => <option key={zone}>{zone}</option>)}</select></div></div><div className="mt-5 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}<Check /></Button></div></form>
    <div className="mt-5 rounded-lg border border-border bg-surface-raised p-5 sm:p-6"><h2 className="text-lg font-semibold">Try a filled-in radar</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Add six realistic sample trackers so you can see how different reset schedules look. Samples are added alongside anything already here.</p><Button variant="outline" className="mt-4" onClick={() => void loadDemo()}><Sparkles /> Load demo data</Button></div>
    <div className="mt-5 rounded-lg border border-destructive/40 bg-surface-raised p-5 sm:p-6"><h2 className="text-lg font-semibold">Delete your tracker data</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Remove every tracker and usage entry. Your account and profile will stay.</p><Button variant="destructive" className="mt-4" onClick={() => void deleteAll()}><Trash2 /> Delete all my data</Button></div>
  </section>;
}