import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getReminderEmailStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { connected: Boolean(process.env['REMINDER_RESEND_API_KEY'] && process.env['REMINDER_EMAIL_FROM']) };
  });

export const sendTestReminder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = { apiKey: process.env['REMINDER_RESEND_API_KEY'], from: process.env['REMINDER_EMAIL_FROM'] };
    if (!config.apiKey || !config.from) return { sent: false, message: 'Email provider not connected yet. Your reminders are saved, but no email will be sent.' };
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !data.user?.email || data.user.id !== context.userId) throw new Error('Your account email could not be verified.');
    const { sendReminderEmail } = await import('./reminder-email.server');
    try {
      await sendReminderEmail(config, data.user.email, 'Your test reminder — Expiry Radar', 'This is your requested test reminder from Expiry Radar. Scheduled reminders cover upcoming subscription renewals and trial end dates in your chosen reminder window. Manage email reminders in Settings.', `test-${context.userId}-${crypto.randomUUID()}`);
      return { sent: true, message: 'Test reminder sent. Check your inbox.' };
    } catch { return { sent: false, message: 'The test reminder could not be sent. Check the email provider and verified sender.' }; }
  });