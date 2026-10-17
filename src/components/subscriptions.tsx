import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, Cloud, CreditCard, Download, Dumbbell, ExternalLink, Gamepad2, GraduationCap, Music, Newspaper, Pencil, Play, Plus, ShoppingBag, Star, Trash2, Tv, Wallet, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionQueryOptions } from '@/lib/subscriptions-query';
import { advanceDate, currencies, currencyTotals, cycles, dateAfter, dayDistance, label, localToday, money, monthKey, monthlyCost, periodProgress, presets, renewalTimeline, renewalUrgency, subscriptionCategories, subscriptionSchema, subscriptionsCsv, userShare, type Subscription, type SubscriptionDraft } from '@/lib/subscriptions';

const categoryIcons = { streaming: Tv, music: Music, shopping: ShoppingBag, software: CreditCard, cloud_storage: Cloud, news: Newspaper, gaming: Gamepad2, fitness: Dumbbell, education: GraduationCap, other: Wallet };
const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const chartColors = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--primary)','var(--success)','var(--warning)','var(--urgency)','var(--muted-foreground)'];
function Totals({ totals }: { totals: Record<string,number> }) { return <>{Object.entries(totals).length ? Object.entries(totals).map(([currency, amount]) => <span key={currency} className="block">{money(amount, currency)}</span>) : '—'}</>; }
function useSubscriptionRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['subscriptions'] });
}

export function SubscriptionOverview({ trackersAtRisk }: { trackersAtRisk: number }) {
  const query = useQuery(subscriptionQueryOptions);
  const data = query.data;
  const today = localToday(data?.profile.timezone ?? 'UTC');
  const upcoming = data?.subscriptions.filter(s => s.status === 'active' && dayDistance(today, s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date) <= 7) ?? [];
  return <section className="border-y border-border py-5"><h2 className="text-lg font-semibold">Overview</h2><div className="mt-3 grid gap-4 sm:grid-cols-2"><Link to="/dashboard" className="flex items-center gap-3 text-sm"><CalendarDays className="size-5 text-warning"/><span><strong className="text-xl">{trackersAtRisk}</strong> trackers at risk</span></Link><Link to="/subscriptions" className="flex items-center gap-3 text-sm"><CreditCard className="size-5 text-primary"/><span>{query.isError ? 'Renewals unavailable' : query.isPending ? 'Loading renewals…' : <><strong className="text-xl">{upcoming.length}</strong> renewals / trials within 7 days</>}</span></Link></div>{upcoming.slice(0,3).map(s => <p key={s.id} className="mt-2 text-sm text-muted-foreground">{s.name} · {s.is_trial ? 'Trial ends' : 'Renews'} {s.is_trial ? s.trial_ends_on : s.next_billing_date} · {money(userShare(s),s.currency)}</p>)}</section>;
}

export function SubscriptionNotificationBell() {
  const { data, isError } = useQuery(subscriptionQueryOptions);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    if (!data?.userId) return;
    try { setRead(JSON.parse(localStorage.getItem(`subscription-read-${data.userId}`) ?? '[]')); } catch { setRead([]); }
  }, [data?.userId]);
  const today = localToday(data?.profile.timezone ?? 'UTC');
  const month = monthKey(today);
  const notifications = data?.subscriptions.filter(s => s.status === 'active').flatMap(s => {
    const date = s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date;
    const days = dayDistance(today, date);
    const items: { id: string; text: string; urgent: boolean }[] = [];
    if (days <= data.profile.renewal_reminder_days) items.push({ id: `${s.id}-${date}-${s.is_trial}`, text: `${s.name}: ${s.is_trial ? 'trial ends' : 'renews'} ${days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'today' : `in ${days} days`}`, urgent: s.is_trial || days < 3 });
    if (!data.ratings.some(r => r.subscription_id === s.id && r.month === month)) items.push({ id: `${s.id}-rating-${month}`, text: `How much did you use ${s.name} this month?`, urgent: false });
    return items;
  }) ?? [];
  const unread = notifications.filter(n => !read.includes(n.id)).length;
  function markRead() {
    const ids = notifications.map(n => n.id);
    setRead(ids);
    if (data?.userId) localStorage.setItem(`subscription-read-${data.userId}`, JSON.stringify(ids));
  }
  return <div className="relative"><Button variant="ghost" size="icon" aria-label={`Notifications, ${unread} unread`} title="Notifications" onClick={() => setOpen(!open)}><Bell/>{unread > 0 && <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-urgency px-1 text-[10px] text-urgency-foreground">{unread}</span>}</Button>{open && <div className="absolute right-0 top-12 z-30 w-[min(340px,calc(100vw-32px))] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><Button size="icon" variant="ghost" aria-label="Close notifications" onClick={() => setOpen(false)}><X/></Button></div>{notifications.length > 0 && <Button variant="link" className="mb-2 h-auto p-0" onClick={markRead}>Mark all as read</Button>}<div className="max-h-80 overflow-auto">{notifications.map(n => <Link key={n.id} to="/subscriptions" onClick={() => setOpen(false)} className={`block border-t border-border py-3 text-sm ${n.urgent ? 'text-urgency' : 'text-foreground'}`}><span className={read.includes(n.id) ? 'opacity-60' : 'font-medium'}>{n.text}</span></Link>)}{!notifications.length && <p className="text-sm text-muted-foreground">{isError ? 'Notifications unavailable. Try again shortly.' : data ? 'All caught up.' : 'Loading notifications…'}</p>}</div></div>}</div>;
}

export function SubscriptionsPage() {
  const { data } = useSuspenseQuery(subscriptionQueryOptions);
  const refresh = useSubscriptionRefresh();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [insightCurrency, setInsightCurrency] = useState(data.profile.default_currency);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()),60000); return () => clearInterval(timer); },[]);
  const today = localToday(data.profile.timezone, now);
  const active = data.subscriptions.filter(s => s.status === 'active');
  const month = monthKey(today);
  const renewing = active.filter(s => { const d = dayDistance(today,s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date); return d >= 0 && d <= 7; });
  const filtered = data.subscriptions.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || s.category === category) && (status === 'all' || s.status === status));
  const insights = active.filter(s => s.currency === insightCurrency && !s.is_trial);
  const chartData = subscriptionCategories.map(c => ({ name: label(c), value: insights.filter(s => s.category === c).reduce((sum,s) => sum + monthlyCost(s),0) })).filter(c => c.value > 0);
  const timeline = renewalTimeline(active, today);
  const dueTotals = timeline.reduce<Record<string,number>>((a,item) => ({ ...a,[item.subscription.currency]: (a[item.subscription.currency] ?? 0) + item.amount }),{});
  const ranked = active.filter(s => !s.is_trial).map(s => ({ s, rating: data.ratings.find(r => r.subscription_id === s.id && r.month === month)?.rating ?? null })).sort((a,b) => (b.rating ?? 0) / Math.max(monthlyCost(b.s),1) - (a.rating ?? 0) / Math.max(monthlyCost(a.s),1));
  const median = (values: number[]) => { const sorted = values.toSorted((a,b) => a-b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] ?? 0 : 0; };
  const flagged = ranked.filter(({s,rating}) => rating !== null && rating <= 2 && monthlyCost(s) >= median(active.filter(a => a.currency === s.currency && !a.is_trial).map(monthlyCost)));
  const duplicates = ['streaming','music'].map(c => ({ category: c, items: active.filter(s => s.category === c) })).filter(g => g.items.length > 1);
  async function update(s: Subscription, action: 'pause'|'cancel'|'delete'|'renew') {
    if ((action === 'delete' || action === 'cancel') && !window.confirm(action === 'delete' ? `Delete ${s.name} and its ratings?` : `Mark ${s.name} as cancelled? This does not cancel with the provider.`)) return;
    setBusyId(s.id);
    try {
      const result = action === 'renew' ? await supabase.rpc('mark_subscription_renewed', { subscription: s.id, expected_date: s.next_billing_date }) : action === 'delete' ? await supabase.from('subscriptions').delete().eq('id',s.id).eq('user_id',data.userId) : await supabase.from('subscriptions').update({ status: action === 'cancel' ? 'cancelled' : s.status === 'paused' ? 'active' : 'paused' }).eq('id',s.id).eq('user_id',data.userId);
      if (result.error) throw result.error;
      toast.success(action === 'renew' ? 'Renewal recorded.' : action === 'delete' ? 'Subscription deleted.' : action === 'cancel' ? 'Marked as cancelled. Cancel with your provider to stop billing.' : s.status === 'paused' ? 'Subscription resumed.' : 'Marked as paused. Provider billing is unchanged.');
      await refresh();
    } catch { toast.error('That change could not be saved. Refresh and try again.'); } finally { setBusyId(null); }
  }
  async function rate(s: Subscription, rating: number) {
    setBusyId(s.id);
    const { error } = await supabase.from('subscription_ratings').upsert({ subscription_id: s.id,user_id: data.userId,rating,month },{ onConflict: 'subscription_id,month' });
    if (error) toast.error('Your rating could not be saved.'); else { toast.success('Monthly rating saved.'); await refresh(); }
    setBusyId(null);
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob(['\ufeff',subscriptionsCsv(data.subscriptions)],{type:'text/csv;charset=utf-8;'}));
    const a = document.createElement('a'); a.href = url; a.download = `subscriptions-${today}.csv`; a.click(); URL.revokeObjectURL(url); toast.success('Subscriptions exported.');
  }
  return <div className="space-y-8 radar-enter">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-primary">Your recurring spend</p><h1 className="mt-2 text-3xl font-semibold">Subscriptions</h1><p className="mt-2 text-sm text-muted-foreground">Keep the good ones. Rethink the rest.</p></div><div className="flex gap-2"><Button variant="outline" size="icon" title="Export subscriptions to CSV" aria-label="Export subscriptions to CSV" onClick={exportCsv}><Download/></Button><Button asChild><Link to="/subscription-new"><Plus/>Add subscription</Link></Button></div></header>
    <section aria-label="Subscription summary" className="grid grid-cols-2 gap-4 border-y border-border py-6 lg:grid-cols-4">{[{ title:'Monthly cost',value:<Totals totals={currencyTotals(active)}/> },{title:'Yearly cost',value:<Totals totals={currencyTotals(active,12)}/>},{title:'Active subscriptions',value:active.length},{title:'Renewing within 7 days',value:renewing.length}].map(({title,value}) => <div key={title}><p className="text-xs text-muted-foreground">{title}</p><div className="mt-2 break-words text-xl font-semibold">{value}</div></div>)}</section>
    <div className="flex flex-wrap gap-3"><Input className="w-full sm:w-60" placeholder="Search subscriptions" aria-label="Search subscriptions" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Filter category" className={`${selectClass} sm:w-44`} value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{subscriptionCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}</select><select aria-label="Filter status" className={`${selectClass} sm:w-40`} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{['active','paused','cancelled'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div>
    {!filtered.length ? <div className="py-12 text-center"><CreditCard className="mx-auto size-12 text-primary"/><h2 className="mt-4 text-lg font-semibold">{data.subscriptions.length ? 'No matching subscriptions' : 'Your subscriptions, in one place'}</h2>{!data.subscriptions.length && <Button asChild className="mt-4"><Link to="/subscription-new"><Plus/>Add your first subscription</Link></Button>}</div> : <section aria-label="Subscription list" className="grid gap-4 xl:grid-cols-2">{filtered.map(s => {
      const Icon = categoryIcons[s.category as keyof typeof categoryIcons] ?? Wallet;
      const date = s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date;
      const days = dayDistance(today,date);
      const urgency = renewalUrgency(date,data.profile.timezone,now);
      const tone = s.status !== 'active' ? 'text-muted-foreground' : urgency === 'urgent' ? 'text-urgency' : urgency === 'warning' ? 'text-warning' : 'text-success';
      return <article key={s.id} className="min-w-0 rounded-lg border border-border bg-surface-raised p-5"><div className="flex justify-between gap-2"><div className="flex min-w-0 gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-primary"><Icon className="size-5"/></div><div className="min-w-0"><h2 className="break-words font-semibold">{s.name}</h2><p className="text-xs text-muted-foreground">{label(s.category)}</p></div></div><span className="self-start rounded-sm bg-accent px-2 py-1 text-xs">{label(s.status)}</span></div><div className="mt-5 flex flex-wrap justify-between gap-2"><p className="text-xl font-semibold">{money(userShare(s),s.currency)} <span className="text-xs font-normal text-muted-foreground">/ {s.billing_cycle === 'custom_days' ? `${s.custom_days} days` : s.billing_cycle.replace('ly','')}</span></p><p className={`self-center text-sm font-medium ${tone}`}>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Renews today' : `Renews in ${days} ${days === 1 ? 'day' : 'days'}`}</p></div>{s.shared_with > 1 && <p className="mt-1 text-xs text-muted-foreground">Your share · {money(s.price,s.currency)} split {s.shared_with} ways</p>}{s.is_trial && <div className={`mt-4 border-l-2 border-current pl-3 text-sm ${tone}`}><strong>{days < 0 ? 'Trial ended' : `Trial ends ${days === 0 ? 'today' : `in ${days} days`}`}</strong><p>Cancel before you're charged.</p></div>}<Progress value={periodProgress(s,today)} className="mt-4 h-1.5"/><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{s.auto_renew ? 'Auto-renew on' : 'Auto-renew off'}</span><span>{date}</span></div><div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3"><Button variant="ghost" size="icon" asChild title="Edit subscription"><Link to="/subscription-edit/$id" params={{id:s.id}} aria-label={`Edit ${s.name}`}><Pencil/></Link></Button>{s.status !== 'cancelled' && <><Button variant="ghost" size="sm" disabled={busyId === s.id} onClick={() => void update(s,'pause')}>{s.status === 'paused' ? 'Resume' : 'Pause'}</Button><Button variant="ghost" size="sm" disabled={busyId === s.id} onClick={() => void update(s,'cancel')}>Cancel</Button></>}{s.status === 'active' && <Button variant="ghost" size="sm" disabled={busyId === s.id} onClick={() => void update(s,'renew')}><Play className="size-3"/>Mark as renewed</Button>}<Button variant="ghost" size="icon" title="Delete subscription" aria-label={`Delete ${s.name}`} disabled={busyId === s.id} onClick={() => void update(s,'delete')}><Trash2 className="size-4"/></Button>{s.cancel_url && /^https?:\/\//.test(s.cancel_url) && <Button variant="outline" size="sm" asChild><a href={s.cancel_url} target="_blank" rel="noopener noreferrer">Manage / Cancel<ExternalLink className="size-3"/></a></Button>}</div></article>;
    })}</section>}
    {active.length > 0 && <section className="space-y-6 border-t border-border pt-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Spending insights</h2><select aria-label="Insights currency" className={`${selectClass} max-w-32`} value={insightCurrency} onChange={e => setInsightCurrency(e.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></div>
      {flagged.length > 0 && <div className="border-l-2 border-warning bg-warning/10 p-4"><p className="font-semibold">Cancelling these {flagged.length} would save you <Totals totals={currencyTotals(flagged.map(f => f.s),12)}/> per year.</p><p className="mt-1 text-sm text-muted-foreground">{flagged.map(f => f.s.name).join(', ')}</p></div>}
      {duplicates.map(d => <p key={d.category} className="text-sm text-warning">Overlapping {d.category} plans: {d.items.map(s => s.name).join(', ')}.</p>)}
      <div className="grid gap-8 lg:grid-cols-2"><div><h3 className="font-semibold">Monthly spending by category</h3><div className="mt-3 h-60 w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>{chartData.map((item,i) => <Cell key={item.name} fill={chartColors[i % chartColors.length]}/>)}</Pie><Tooltip formatter={(v: number) => money(v,insightCurrency)} contentStyle={{ background:'var(--popover)',borderColor:'var(--border)',color:'var(--foreground)',borderRadius:6 }}/></PieChart></ResponsiveContainer> : <p className="pt-12 text-sm text-muted-foreground">No paid plans in {insightCurrency}.</p>}</div><div className="space-y-2">{chartData.map((c,i) => <div key={c.name} className="flex justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{background:chartColors[i % chartColors.length]}}/>{c.name}</span><span>{money(c.value,insightCurrency)}</span></div>)}</div></div>
      <div><h3 className="font-semibold">Next 30 days</h3><div className="mt-2 text-lg font-semibold"><Totals totals={dueTotals}/></div><div className="mt-3 max-h-96 space-y-0 overflow-y-auto">{timeline.map((item,i) => <div key={`${item.subscription.id}-${i}`} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"><div><p className="font-medium">{item.subscription.name}</p><p className="text-xs text-muted-foreground">{item.date}{item.subscription.is_trial && i === 0 ? ' · Trial converts' : ''}</p></div><span>{money(item.amount,item.subscription.currency)}</span></div>)}{!timeline.length && <p className="text-sm text-muted-foreground">No upcoming charges.</p>}</div></div></div>
      <div className="border-t border-border pt-6"><h3 className="font-semibold">Worth keeping?</h3><p className="mt-1 text-sm text-muted-foreground">{new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(new Date(`${today}T12:00:00`))} · Monthly use ratings</p><div className="mt-3">{ranked.map(({s,rating}) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4"><div><p className="text-sm font-medium">How much did you use {s.name} this month?</p><p className="mt-1 text-xs text-muted-foreground">{money(monthlyCost(s),s.currency)}/month{rating ? ` · ${rating}/5 use rating` : ''}{flagged.some(f => f.s.id === s.id) ? ` · Consider cancelling: ${money(monthlyCost(s)*12,s.currency)}/year saved` : ''}</p></div><div className="flex" role="group" aria-label={`Rate ${s.name}`}>{[1,2,3,4,5].map(star => <Button key={star} size="icon" variant="ghost" aria-label={`Rate ${s.name} ${star} stars`} title={`${star} ${star === 1 ? 'star' : 'stars'}`} disabled={busyId === s.id} onClick={() => void rate(s,star)}><Star className={rating && star <= rating ? 'fill-warning text-warning' : 'text-muted-foreground'}/></Button>)}</div></div>)}</div></div>
    </section>}
  </div>;
}

export function SubscriptionEditor({ subscriptionId }: { subscriptionId?: string }) {
  const { data } = useSuspenseQuery(subscriptionQueryOptions);
  const navigate = useNavigate();
  const refresh = useSubscriptionRefresh();
  const existing = data.subscriptions.find(s => s.id === subscriptionId);
  const today = localToday(data.profile.timezone);
  const [form, setForm] = useState<SubscriptionDraft>(() => existing ? { ...existing, category: existing.category as SubscriptionDraft['category'],billing_cycle: existing.billing_cycle as SubscriptionDraft['billing_cycle'],currency: existing.currency as SubscriptionDraft['currency'],status: existing.status as SubscriptionDraft['status'] } : { name:'',category:'other',price:0,currency:data.profile.default_currency as SubscriptionDraft['currency'],billing_cycle:'monthly',custom_days:null,next_billing_date:advanceDate(today,'monthly',null,today),start_date:today,is_trial:false,trial_ends_on:null,auto_renew:true,payment_method:'',shared_with:1,cancel_url:'',notes:'',status:'active' });
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState('custom');
  const set = <K extends keyof SubscriptionDraft>(key: K, value: SubscriptionDraft[K]) => setForm(old => ({ ...old,[key]:value }));
  if (subscriptionId && !existing) return <div className="py-10"><h1 className="text-2xl font-semibold">Subscription not found</h1><Button asChild variant="link"><Link to="/subscriptions">Back to subscriptions</Link></Button></div>;
  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = subscriptionSchema.safeParse({ ...form,price:price.trim() === '' ? NaN : Number(price),trial_ends_on:form.is_trial ? form.trial_ends_on : null,custom_days:form.billing_cycle === 'custom_days' ? form.custom_days : null });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(i => [i.path[0],i.message]))); return; }
    setSaving(true); setErrors({});
    const result = subscriptionId ? await supabase.from('subscriptions').update(parsed.data).eq('id',subscriptionId).eq('user_id',data.userId) : await supabase.from('subscriptions').insert({ ...parsed.data,user_id:data.userId });
    setSaving(false);
    if (result.error) { toast.error('Subscription could not be saved. Check your details and try again.'); return; }
    toast.success(subscriptionId ? 'Subscription updated.' : 'Subscription added.');
    await refresh(); await navigate({to:'/subscriptions'});
  }
  const field = (name: string,title: string,children: React.ReactNode) => <div className="space-y-2"><Label htmlFor={name}>{title}</Label>{children}{errors[name] && <p role="alert" className="text-xs text-destructive">{errors[name]}</p>}</div>;
  return <section className="mx-auto max-w-3xl radar-enter"><Button asChild variant="link" className="mb-3 px-0"><Link to="/subscriptions">← Subscriptions</Link></Button><h1 className="text-3xl font-semibold">{subscriptionId ? 'Edit subscription' : 'Add subscription'}</h1><form className="mt-6 space-y-6" onSubmit={e => void save(e)} noValidate>
    {!subscriptionId && field('preset','Service',<select id="preset" className={selectClass} value={preset} onChange={e => { setPreset(e.target.value); const p = presets.find(p => p[0] === e.target.value); if(p) { setForm(old => ({...old,name:p[0],category:p[1],billing_cycle:p[2],next_billing_date:advanceDate(old.start_date,p[2],null,old.start_date),cancel_url:p[3]})); setPrice(''); } }}><option value="custom">Custom subscription</option>{presets.map(p => <option key={p[0]}>{p[0]}</option>)}</select>)}
    <div className="grid gap-5 sm:grid-cols-2">{field('name','Name',<Input id="name" value={form.name} maxLength={120} onChange={e => set('name',e.target.value)}/>)}{field('category','Category',<select id="category" className={selectClass} value={form.category} onChange={e => set('category',e.target.value as SubscriptionDraft['category'])}>{subscriptionCategories.map(c => <option key={c} value={c}>{label(c)}</option>)}</select>)}{field('price','Full plan price',<Input id="price" type="number" min="0" step="0.01" placeholder="Enter your plan price" value={price} onChange={e => setPrice(e.target.value)}/>)}{field('currency','Currency',<select id="currency" className={selectClass} value={form.currency} onChange={e => set('currency',e.target.value as SubscriptionDraft['currency'])}>{currencies.map(c => <option key={c}>{c}</option>)}</select>)}{field('billing_cycle','Billing cycle',<select id="billing_cycle" className={selectClass} value={form.billing_cycle} onChange={e => set('billing_cycle',e.target.value as SubscriptionDraft['billing_cycle'])}>{cycles.map(c => <option key={c} value={c}>{label(c)}</option>)}</select>)}{form.billing_cycle === 'custom_days' && field('custom_days','Days per cycle',<Input id="custom_days" type="number" min="1" max="3660" value={form.custom_days ?? ''} onChange={e => set('custom_days',e.target.value ? Number(e.target.value) : null)}/>)}{field('start_date','Start date',<Input id="start_date" type="date" value={form.start_date} onChange={e => set('start_date',e.target.value)}/>)}{field('next_billing_date','Next billing date',<Input id="next_billing_date" type="date" value={form.next_billing_date} onChange={e => set('next_billing_date',e.target.value)}/>)}{field('shared_with','Splitting with others (including you)',<Input id="shared_with" type="number" min="1" max="100" value={form.shared_with} onChange={e => set('shared_with',Number(e.target.value))}/>)}{field('payment_method','Payment method (optional)',<Input id="payment_method" placeholder="e.g. Visa ending 1234" maxLength={120} value={form.payment_method} onChange={e => set('payment_method',e.target.value)}/>)}{field('status','Status',<select id="status" className={selectClass} value={form.status} onChange={e => set('status',e.target.value as SubscriptionDraft['status'])}>{['active','paused','cancelled'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>)}</div>
    <div className="flex items-center justify-between border-y border-border py-4"><Label htmlFor="is_trial">This is a free trial</Label><Switch id="is_trial" checked={form.is_trial} onCheckedChange={v => set('is_trial',v)}/></div>{form.is_trial && field('trial_ends_on','Trial end date',<Input id="trial_ends_on" type="date" value={form.trial_ends_on ?? ''} onChange={e => set('trial_ends_on',e.target.value || null)}/>)}<div className="flex items-center justify-between"><Label htmlFor="auto_renew">Automatically renews</Label><Switch id="auto_renew" checked={form.auto_renew} onCheckedChange={v => set('auto_renew',v)}/></div>{field('cancel_url','Manage / cancel URL (optional)',<Input id="cancel_url" type="url" placeholder="https://" value={form.cancel_url} onChange={e => set('cancel_url',e.target.value)}/>)}{field('notes','Notes',<textarea id="notes" className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.notes} onChange={e => set('notes',e.target.value)}/>)}<div className="flex justify-end gap-3 border-t border-border pt-5"><Button asChild variant="outline"><Link to="/subscriptions">Cancel</Link></Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save subscription'}</Button></div>
  </form></section>;
}
