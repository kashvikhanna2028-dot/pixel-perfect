import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

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

// Future email adapter: authenticated, owner-scoped, no delivery or scheduling enabled.
export const prepareSubscriptionReminders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('timezone,renewal_reminder_days').eq('user_id', context.userId).single();
    if (profileError) throw new Error('Reminder settings could not be loaded.');
    const { localToday, dateAfter } = await import('@/lib/subscriptions');
    const today = localToday(profile.timezone);
    const end = dateAfter(today, profile.renewal_reminder_days);
    const { data, error } = await context.supabase.from('subscriptions').select('id,name,next_billing_date,trial_ends_on,is_trial,price,currency,shared_with').eq('user_id', context.userId).eq('status','active');
    if (error) throw new Error('Reminders could not be prepared.');
    return { userId: context.userId, deliveryEnabled: false, reminders: data.filter(s => (s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date) >= today && (s.is_trial ? s.trial_ends_on ?? s.next_billing_date : s.next_billing_date) <= end) };
  });
