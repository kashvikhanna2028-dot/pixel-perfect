import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getSubscriptionData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rolled = await context.supabase.rpc('roll_subscription_renewals');
    if (rolled.error) throw new Error('Renewals could not be refreshed.');
    const [subscriptions, ratings, profile] = await Promise.all([
      context.supabase.from('subscriptions').select('*').eq('user_id', context.userId).order('next_billing_date'),
      context.supabase.from('subscription_ratings').select('*').eq('user_id', context.userId),
      context.supabase.from('profiles').select('default_currency,renewal_reminder_days,timezone').eq('user_id', context.userId).single(),
    ]);
    if (subscriptions.error || ratings.error || profile.error) throw new Error('Subscriptions could not be loaded. Please retry.');
    return { subscriptions: subscriptions.data, ratings: ratings.data, profile: profile.data, userId: context.userId };
  });

// Authenticated preview of due reminders; the protected cron route owns delivery.
export const prepareSubscriptionReminders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('timezone,renewal_reminder_days,email_reminders_enabled').eq('user_id', context.userId).single();
    if (profileError) throw new Error('Reminder settings could not be loaded.');
    const { localToday, dateAfter } = await import('@/lib/subscriptions');
    const today = localToday(profile.timezone);
    const end = dateAfter(today, profile.renewal_reminder_days);
    const { data, error } = await context.supabase.from('subscriptions').select('id,name,next_billing_date,trial_ends_on,is_trial,price,currency,shared_with').eq('user_id', context.userId).eq('status','active');
    if (error) throw new Error('Reminders could not be prepared.');
    const deliveryEnabled = profile.email_reminders_enabled && Boolean(process.env['REMINDER_RESEND_API_KEY'] && process.env['REMINDER_EMAIL_FROM']);
    return { userId: context.userId, deliveryEnabled, reminders: profile.email_reminders_enabled ? data.filter(s => (s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date) >= today && (s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date) <= end) : [] };
  });

export const getNotificationReads = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('notification_reads').select('notification_key').eq('user_id', context.userId);
    if (error) throw new Error('Notification read status could not be loaded.');
    return data.map(row => row.notification_key);
  });

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ keys: z.array(z.string().min(1).max(240)).max(1000) }).parse(input))
  .handler(async ({ context, data }) => {
    if (!data.keys.length) return { saved: true };
    const { error } = await context.supabase.from('notification_reads').upsert([...new Set(data.keys)].map(notification_key => ({ user_id: context.userId, notification_key })), { onConflict: 'user_id,notification_key', ignoreDuplicates: true });
    if (error) throw new Error('Notification read status could not be saved.');
    return { saved: true };
  });
