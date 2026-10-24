CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 plan text NOT NULL CHECK (plan IN ('pro_monthly','pro_yearly')),
 amount_paise integer NOT NULL CHECK (amount_paise > 0),
 currency text NOT NULL DEFAULT 'INR',
 status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','captured','failed')),
 razorpay_order_id text UNIQUE,
 razorpay_payment_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.entitlements (
 user_id uuid PRIMARY KEY,
 pro_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their entitlements" ON public.entitlements FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.payments IS 'Razorpay orders and outcomes. Server-only writes; owners read their own rows.';
COMMENT ON TABLE public.entitlements IS 'Pro access windows granted by captured payments. Server-only writes; owners read their own row.';
