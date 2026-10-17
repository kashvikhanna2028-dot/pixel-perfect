import { createFileRoute } from '@tanstack/react-router';
import { deliverOnce, eligibleReminders, verifyReminderSecret } from '@/lib/subscription-reminders';
import { money, userShare } from '@/lib/subscriptions';

export const Route = createFileRoute('/api/public/send-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!await verifyReminderSecret(request, process.env['REMINDER_CRON_SECRET'])) return new Response('Unauthorized', { status: 401 });
        const counts = { sent: 0, duplicate: 0, would_send: 0, failed: 0 };
        try {
          // Privileged cross-account reads are allowed only after cron authentication.
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { emailProviderConnected, sendReminderEmail } = await import('@/lib/reminder-email.server');
          const config = { apiKey: process.env['REMINDER_RESEND_API_KEY'], from: process.env['REMINDER_EMAIL_FROM'] };
          const connected = emailProviderConnected(config);
          // Page opted-in recipients; never return or log their identities.
          for (let offset = 0; ; offset += 500) {
            const profiles = await supabaseAdmin.from('profiles').select('user_id,timezone,renewal_reminder_days,email_reminders_enabled').eq('email_reminders_enabled', true).order('user_id').range(offset, offset + 499);
            if (profiles.error) throw new Error('Recipient settings could not be loaded.');
            for (const profile of profiles.data) {
              // Re-read consent immediately before preparing this recipient's messages.
              const consent = await supabaseAdmin.from('profiles').select('email_reminders_enabled,timezone,renewal_reminder_days').eq('user_id', profile.user_id).single();
              if (consent.error) { counts.failed++; continue; }
              if (!consent.data.email_reminders_enabled) continue;
              const plans = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', profile.user_id).eq('status', 'active');
              if (plans.error) { counts.failed++; continue; }
              let reminders;
              try { reminders = eligibleReminders(consent.data, plans.data); } catch { counts.failed++; continue; }
              if (!connected) {
                counts.would_send += reminders.length;
                if (reminders.length) console.info('would send', reminders.length);
                continue;
              }
              if (!reminders.length) continue;
              const recipient = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
              const email = recipient.data.user?.email;
              if (recipient.error || !email || !recipient.data.user?.email_confirmed_at) { counts.failed += reminders.length; continue; }
              for (const reminder of reminders) {
                const { subscription, kind, billing_date } = reminder;
                const result = await deliverOnce(connected, async () => {
                  const reservation = await supabaseAdmin.from('reminder_deliveries').insert({ user_id: profile.user_id, subscription_id: subscription.id, kind, billing_date }).select('id').single();
                  if (reservation.error?.code === '23505') return false;
                  if (reservation.error) throw new Error('Delivery could not be reserved.');
                  return true;
                }, async () => {
                  await sendReminderEmail(config, email, `${subscription.name} ${kind === 'trial_end' ? 'trial ends' : 'renews'} on ${billing_date}`, `${subscription.name} ${kind === 'trial_end' ? 'trial ends' : 'renews'} on ${billing_date}.\nYour share: ${money(userShare(subscription), subscription.currency)}.\nReview your plan with the provider if you do not want to renew. Manage email reminders in Expiry Radar Settings.`, `reminder-${profile.user_id}-${subscription.id}-${kind}-${billing_date}`);
                  const saved = await supabaseAdmin.from('reminder_deliveries').update({ sent_at: new Date().toISOString() }).eq('user_id', profile.user_id).eq('subscription_id', subscription.id).eq('kind', kind).eq('billing_date', billing_date);
                  if (saved.error) console.error('Sent reminder timestamp could not be saved. Reservation retained.');
                }).catch(() => 'failed' as const);
                counts[result]++;
              }
            }
            if (profiles.data.length < 500) break;
          }
          return Response.json(counts, { headers: { 'Cache-Control': 'no-store' } });
        } catch {
          console.error('Reminder dispatch could not complete.');
          return Response.json({ ...counts, failed: counts.failed + 1 }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
      },
      GET: () => new Response('Unauthorized', { status: 401 }),
    },
  },
});