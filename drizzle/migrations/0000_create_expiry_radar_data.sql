CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are readable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Profiles are editable by owner" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

CREATE TABLE public.trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN ('llm_credits', 'api_quota', 'free_minutes', 'gym_pass', 'coupon', 'free_trial', 'other')),
  unit text NOT NULL DEFAULT 'other' CHECK (char_length(trim(unit)) BETWEEN 1 AND 32),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  used_amount numeric NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
  reset_type text NOT NULL CHECK (reset_type IN ('one_time', 'daily', 'weekly', 'monthly')),
  reset_day integer,
  expires_at timestamptz,
  reset_time time NOT NULL DEFAULT '00:00',
  timezone text NOT NULL DEFAULT 'UTC',
  cost_value numeric CHECK (cost_value IS NULL OR cost_value >= 0),
  notes text NOT NULL DEFAULT '',
  next_reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trackers_reset_date_valid CHECK (
    (reset_type = 'one_time' AND expires_at IS NOT NULL)
    OR (reset_type <> 'one_time' AND expires_at IS NULL)
  ),
  CONSTRAINT trackers_reset_day_valid CHECK (
    reset_day IS NULL OR (reset_type = 'weekly' AND reset_day BETWEEN 0 AND 6)
    OR (reset_type = 'monthly' AND reset_day BETWEEN 1 AND 31)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trackers TO authenticated;
GRANT ALL ON public.trackers TO service_role;
ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trackers belong to their owner" ON public.trackers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their own trackers" ON public.trackers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own trackers" ON public.trackers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own trackers" ON public.trackers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX trackers_owner_reset_idx ON public.trackers (user_id, next_reset_at);

CREATE TABLE public.usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  logged_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usage logs belong to their owner" ON public.usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users log their own usage" ON public.usage_logs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.trackers WHERE id = tracker_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Users delete their own usage logs" ON public.usage_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX usage_logs_owner_time_idx ON public.usage_logs (user_id, logged_at DESC);
CREATE INDEX usage_logs_tracker_time_idx ON public.usage_logs (tracker_id, logged_at DESC);