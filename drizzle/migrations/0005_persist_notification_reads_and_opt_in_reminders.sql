ALTER TABLE public.profiles ADD COLUMN email_reminders_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.notification_reads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 notification_key text NOT NULL,
 read_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, notification_key)
);
GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read notification acknowledgements" ON public.notification_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create notification acknowledgements" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update notification acknowledgements" ON public.notification_reads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.reminder_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('renewal','trial_end')),
 billing_date date NOT NULL,
 sent_at timestamptz,
 UNIQUE(user_id, subscription_id, kind, billing_date)
);
GRANT SELECT ON public.reminder_deliveries TO authenticated;
GRANT ALL ON public.reminder_deliveries TO service_role;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read reminder deliveries" ON public.reminder_deliveries FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON COLUMN public.reminder_deliveries.sent_at IS 'NULL means reserved before sending; failures remain reserved to prevent uncertain duplicate sends.';