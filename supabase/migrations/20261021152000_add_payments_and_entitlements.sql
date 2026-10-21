CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text UNIQUE,
  plan text NOT NULL CHECK (plan IN ('pro_monthly', 'pro_yearly')),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS payments_user_created_idx
  ON public.payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  pro_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.entitlements TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.entitlements FROM authenticated, anon;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own payments" ON public.payments;
CREATE POLICY "Owners read own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners read own entitlements" ON public.entitlements;
CREATE POLICY "Owners read own entitlements"
  ON public.entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
