ALTER TABLE public.profiles ADD COLUMN default_currency text NOT NULL DEFAULT 'USD' CHECK (default_currency IN ('INR','USD','EUR','GBP')), ADD COLUMN renewal_reminder_days integer NOT NULL DEFAULT 3 CHECK (renewal_reminder_days IN (1,3,7));
CREATE TABLE public.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), category text NOT NULL CHECK (category IN ('streaming','music','shopping','software','cloud_storage','news','gaming','fitness','education','other')), price numeric NOT NULL CHECK (price >= 0), currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('INR','USD','EUR','GBP')), billing_cycle text NOT NULL CHECK (billing_cycle IN ('weekly','monthly','quarterly','yearly','custom_days')), custom_days integer CHECK (custom_days BETWEEN 1 AND 3660), next_billing_date date NOT NULL, start_date date NOT NULL, is_trial boolean NOT NULL DEFAULT false, trial_ends_on date, auto_renew boolean NOT NULL DEFAULT true, payment_method text NOT NULL DEFAULT '', shared_with integer NOT NULL DEFAULT 1 CHECK (shared_with BETWEEN 1 AND 100), cancel_url text NOT NULL DEFAULT '' CHECK (cancel_url = '' OR cancel_url ~ '^https?://'), notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')), created_at timestamptz NOT NULL DEFAULT now(), CHECK (billing_cycle <> 'custom_days' OR custom_days IS NOT NULL), CHECK (NOT is_trial OR trial_ends_on IS NOT NULL), CHECK (next_billing_date >= start_date), CHECK (trial_ends_on IS NULL OR trial_ends_on >= start_date), UNIQUE(id,user_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subscriptions owned by user" ON public.subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.subscription_ratings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL, user_id uuid NOT NULL DEFAULT auth.uid(), rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), month date NOT NULL CHECK (extract(day from month) = 1), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subscription_id,month), FOREIGN KEY(subscription_id,user_id) REFERENCES public.subscriptions(id,user_id) ON DELETE CASCADE
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.subscription_ratings TO authenticated;
GRANT ALL ON public.subscription_ratings TO service_role;
ALTER TABLE public.subscription_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings owned by user" ON public.subscription_ratings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));
CREATE INDEX subscriptions_owner_due ON public.subscriptions(user_id,next_billing_date);
CREATE FUNCTION public.advance_subscription_date(d date, cycle text, days integer, anchor date) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE target date; months integer;
BEGIN
 IF cycle = 'weekly' THEN RETURN d + 7; END IF;
 IF cycle = 'custom_days' THEN RETURN d + days; END IF;
 months := CASE cycle WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 ELSE 12 END;
 target := (date_trunc('month',d) + make_interval(months => months))::date;
 RETURN target + (least(extract(day from anchor)::integer,extract(day from (target + interval '1 month - 1 day'))::integer) - 1);
END; $$;
CREATE FUNCTION public.roll_subscription_renewals() RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.subscriptions; due date; today date;
BEGIN
 SELECT (now() AT TIME ZONE p.timezone)::date INTO today FROM public.profiles p WHERE p.user_id = auth.uid();
 today := coalesce(today,current_date);
 FOR s IN SELECT * FROM public.subscriptions WHERE user_id = auth.uid() AND status = 'active' AND auto_renew AND NOT is_trial AND next_billing_date < today FOR UPDATE LOOP
 due := s.next_billing_date;
 WHILE due < today LOOP due := public.advance_subscription_date(due,s.billing_cycle,s.custom_days,s.start_date); END LOOP;
 UPDATE public.subscriptions SET next_billing_date = due WHERE id = s.id AND user_id = auth.uid();
 END LOOP;
END; $$;
CREATE FUNCTION public.mark_subscription_renewed(subscription uuid, expected_date date) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 UPDATE public.subscriptions SET next_billing_date = public.advance_subscription_date(next_billing_date,billing_cycle,custom_days,start_date), is_trial = false WHERE id = subscription AND user_id = auth.uid() AND next_billing_date = expected_date AND status = 'active';
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription changed. Refresh and try again.'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.roll_subscription_renewals() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mark_subscription_renewed(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roll_subscription_renewals(),public.mark_subscription_renewed(uuid,date) TO authenticated;
