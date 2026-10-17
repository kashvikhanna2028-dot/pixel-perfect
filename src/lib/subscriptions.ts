import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { z } from 'zod';
import { dateTimeFieldToIso, isoToDateTimeFields } from './expiry-radar';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Subscription = Tables<'subscriptions'>;
export type SubscriptionRating = Tables<'subscription_ratings'>;
export const currencies = ['INR', 'USD', 'EUR', 'GBP'] as const;
export const subscriptionCategories = ['streaming', 'music', 'shopping', 'software', 'cloud_storage', 'news', 'gaming', 'fitness', 'education', 'other'] as const;
export const cycles = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom_days'] as const;
export const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const money = (value: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
export const localToday = (timezone: string, now = new Date()) => isoToDateTimeFields(now.toISOString(), timezone).date;
export const monthKey = (today: string) => `${today.slice(0, 7)}-01`;
export const dayDistance = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));
export const dateAfter = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd');
export function advanceDate(date: string, cycle: string, customDays: number | null, anchor: string): string {
  if (cycle === 'weekly' || cycle === 'custom_days') return dateAfter(date, cycle === 'weekly' ? 7 : customDays ?? 1);
  const target = addMonths(parseISO(`${date.slice(0, 7)}-01`), cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(Number(anchor.slice(8, 10)), last));
  return format(target, 'yyyy-MM-dd');
}
export const userShare = (s: Pick<Subscription, 'price' | 'shared_with'>) => Number(s.price) / s.shared_with;
export function monthlyCost(s: Pick<Subscription, 'price' | 'shared_with' | 'billing_cycle' | 'custom_days'>) {
  const share = userShare(s);
  switch (s.billing_cycle) {
    case 'weekly': return share * 52 / 12;
    case 'quarterly': return share / 3;
    case 'yearly': return share / 12;
    case 'custom_days': return share * 365 / (s.custom_days ?? 1) / 12;
    default: return share;
  }
}
export function currencyTotals(items: Subscription[], factor = 1) {
  return items.filter(s => s.status === 'active' && !s.is_trial).reduce<Record<string, number>>((totals, s) => {
    totals[s.currency] = (totals[s.currency] ?? 0) + monthlyCost(s) * factor;
    return totals;
  }, {});
}
export function renewalUrgency(date: string, timezone: string, now = new Date()) {
  const iso = dateTimeFieldToIso(date, '00:00', timezone);
  const hours = iso ? (new Date(iso).getTime() - now.getTime()) / 3600000 : 0;
  return hours < 72 ? 'urgent' : hours <= 168 ? 'warning' : 'calm';
}
export function periodProgress(s: Subscription, today: string) {
  const cycleMonths = s.billing_cycle === 'monthly' ? 1 : s.billing_cycle === 'quarterly' ? 3 : 12;
  let previous: string;
  if (s.is_trial) previous = s.start_date;
  else if (s.billing_cycle === 'weekly' || s.billing_cycle === 'custom_days') previous = dateAfter(s.next_billing_date, -(s.billing_cycle === 'weekly' ? 7 : s.custom_days ?? 1));
  else {
    const d = addMonths(parseISO(`${s.next_billing_date.slice(0, 7)}-01`), -cycleMonths);
    d.setDate(Math.min(Number(s.start_date.slice(8)), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    previous = format(d, 'yyyy-MM-dd');
  }
  previous = previous < s.start_date ? s.start_date : previous;
  const end = s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date;
  return Math.max(0, Math.min(100, dayDistance(previous, today) / Math.max(1, dayDistance(previous, end)) * 100));
}
export function renewalTimeline(items: Subscription[], today: string) {
  const end = dateAfter(today, 30);
  const charges: { subscription: Subscription; date: string; amount: number }[] = [];
  for (const s of items.filter(s => s.status === 'active')) {
    if (s.is_trial && !s.auto_renew) continue;
    let date = s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date;
    for (let n = 0; n < 40 && date <= end; n++) {
      if (date >= today) charges.push({ subscription: s, date, amount: userShare(s) });
      if (!s.auto_renew) break;
      date = advanceDate(date, s.billing_cycle, s.custom_days, s.start_date);
    }
  }
  return charges.sort((a, b) => a.date.localeCompare(b.date));
}
const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = parseISO(value); return !Number.isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === value; }, 'Choose a valid date.');
export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Add a subscription name.').max(120), category: z.enum(subscriptionCategories), price: z.number().finite().min(0, 'Price cannot be negative.'), currency: z.enum(currencies), billing_cycle: z.enum(cycles), custom_days: z.number().int().min(1).max(3660).nullable(), next_billing_date: validDate, start_date: validDate, is_trial: z.boolean(), trial_ends_on: validDate.nullable(), auto_renew: z.boolean(), payment_method: z.string().max(120), shared_with: z.number().int().min(1, 'Split between at least one person.').max(100), cancel_url: z.string().trim().max(2000).refine(v => !v || /^https?:\/\//.test(v) && (() => { try { new URL(v); return true; } catch { return false; } })(), 'Use a full http or https address.'), notes: z.string().max(5000), status: z.enum(['active', 'paused', 'cancelled']),
}).superRefine((s, ctx) => {
  if (s.billing_cycle === 'custom_days' && s.custom_days === null) ctx.addIssue({ code: 'custom', path: ['custom_days'], message: 'Enter the number of days in this cycle.' });
  if (s.is_trial && !s.trial_ends_on) ctx.addIssue({ code: 'custom', path: ['trial_ends_on'], message: 'Choose when the trial ends.' });
  if (s.next_billing_date < s.start_date) ctx.addIssue({ code: 'custom', path: ['next_billing_date'], message: 'Renewal must be on or after the start date.' });
  if (s.trial_ends_on && s.trial_ends_on < s.start_date) ctx.addIssue({ code: 'custom', path: ['trial_ends_on'], message: 'Trial end must be on or after the start date.' });
});
export type SubscriptionDraft = z.infer<typeof subscriptionSchema>;
export const presets = [
  ['Netflix', 'streaming', 'monthly', 'https://www.netflix.com/cancelplan'],
  ['Amazon Prime', 'shopping', 'yearly', 'https://www.amazon.com/amazonprime'],
  ['Spotify', 'music', 'monthly', 'https://www.spotify.com/account/subscription/'],
  ['YouTube Premium', 'streaming', 'monthly', 'https://www.youtube.com/paid_memberships'],
  ['Disney+ Hotstar', 'streaming', 'yearly', 'https://www.hotstar.com/'],
  ['JioCinema', 'streaming', 'monthly', 'https://www.jiocinema.com/'],
  ['Apple Music', 'music', 'monthly', 'https://account.apple.com/'],
  ['Apple iCloud+', 'cloud_storage', 'monthly', 'https://support.apple.com/icloud'],
  ['Google One', 'cloud_storage', 'monthly', 'https://one.google.com/settings'],
  ['Microsoft 365', 'software', 'yearly', 'https://account.microsoft.com/services'],
  ['Notion', 'software', 'monthly', 'https://www.notion.so/'],
  ['ChatGPT Plus', 'software', 'monthly', 'https://chatgpt.com/'],
  ['Claude Pro', 'software', 'monthly', 'https://claude.ai/settings/billing'],
  ['Canva Pro', 'software', 'monthly', 'https://www.canva.com/settings/billing-and-plans'],
  ['Adobe Creative Cloud', 'software', 'monthly', 'https://account.adobe.com/plans'],
  ['Duolingo', 'education', 'yearly', 'https://www.duolingo.com/settings'],
  ['Audible', 'education', 'monthly', 'https://www.audible.com/account/overview'],
  ['LinkedIn Premium', 'software', 'monthly', 'https://www.linkedin.com/premium/manage/'],
] as const;
export function demoSubscriptions(userId: string, currency: string, timezone: string): TablesInsert<'subscriptions'>[] {
  const today = localToday(timezone);
  const prices: Record<string, number[]> = { INR: [649,1499,119,99,1650,999], USD: [15.49,139,10.99,2.99,20,59.99], EUR: [13.99,89.9,10.99,2.99,18,59.99], GBP: [10.99,95,10.99,2.99,16,59.99] };
  return [0,1,2,3,4,5].map((n) => ({ user_id: userId, name: ['Netflix','Amazon Prime','Spotify','Apple iCloud+','Notion','Duolingo'][n] ?? 'Demo', category: ['streaming','shopping','music','cloud_storage','software','education'][n] ?? 'other', price: (prices[currency] ?? prices.USD)?.[n] ?? 10, currency, billing_cycle: n === 1 || n === 5 ? 'yearly' : 'monthly', start_date: dateAfter(today, -20), next_billing_date: dateAfter(today, [2,18,5,8,2,24][n] ?? 5), is_trial: n === 4, trial_ends_on: n === 4 ? dateAfter(today, 2) : null, shared_with: n === 0 ? 2 : 1, auto_renew: true, notes: 'Sample subscription — replace with your own plan and price.', cancel_url: presets.find(p => p[0] === ['Netflix','Amazon Prime','Spotify','Apple iCloud+','Notion','Duolingo'][n])?.[3] ?? '', status: 'active' }));
}
export function subscriptionsCsv(items: Subscription[]) {
  const keys = ['name','category','price','currency','billing_cycle','custom_days','next_billing_date','start_date','is_trial','trial_ends_on','auto_renew','payment_method','shared_with','cancel_url','notes','status'] as const;
  const cell = (value: unknown) => { let text = value == null ? '' : String(value); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  return [keys.join(','), ...items.map(s => keys.map(k => cell(s[k])).join(','))].join('\r\n');
}
