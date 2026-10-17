import { dayDistance, localToday, type Subscription } from './subscriptions';

export type ReminderProfile = { email_reminders_enabled: boolean; timezone: string; renewal_reminder_days: number };
export type Reminder = { subscription: Subscription; kind: 'renewal' | 'trial_end'; billing_date: string };

export function eligibleReminders(profile: ReminderProfile, subscriptions: Subscription[], now = new Date()): Reminder[] {
  if (!profile.email_reminders_enabled) return [];
  const today = localToday(profile.timezone, now);
  return subscriptions.filter(s => s.status === 'active').flatMap(subscription => {
    const billing_date = subscription.is_trial ? subscription.trial_ends_on ?? subscription.next_billing_date : subscription.next_billing_date;
    const days = dayDistance(today, billing_date);
    return days >= 0 && days <= profile.renewal_reminder_days ? [{ subscription, kind: subscription.is_trial ? 'trial_end' as const : 'renewal' as const, billing_date }] : [];
  });
}

export async function verifyReminderSecret(request: Request, secret: string | undefined): Promise<boolean> {
  const provided = request.headers.get('x-reminder-cron-secret');
  if (!secret || !provided) return false;
  const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(provided), digest(secret)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

// A unique database reservation must succeed before the provider is called.
// Keep reservations on failures: the provider may have accepted an uncertain request.
export async function deliverOnce(connected: boolean, reserve: () => Promise<boolean>, send: () => Promise<void>): Promise<'sent' | 'duplicate' | 'would_send' | 'failed'> {
  if (!connected) return 'would_send';
  if (!await reserve()) return 'duplicate';
  try { await send(); return 'sent'; } catch { return 'failed'; }
}