CREATE OR REPLACE FUNCTION public.roll_subscription_renewals() RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.subscriptions; due date; today date;
BEGIN
 SELECT (now() AT TIME ZONE p.timezone)::date INTO today FROM public.profiles p WHERE p.user_id = auth.uid();
 today := coalesce(today,current_date);
 FOR s IN SELECT * FROM public.subscriptions WHERE user_id = auth.uid() AND status = 'active' AND auto_renew AND next_billing_date < today FOR UPDATE LOOP
 due := s.next_billing_date;
 WHILE due < today LOOP due := public.advance_subscription_date(due,s.billing_cycle,s.custom_days,s.start_date); END LOOP;
 UPDATE public.subscriptions SET next_billing_date = due WHERE id = s.id AND user_id = auth.uid();
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.roll_subscription_renewals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roll_subscription_renewals() TO authenticated;
