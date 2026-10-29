-- Companion extension sync: store provider usage readings as timestamped
-- SNAPSHOTS. A snapshot records exactly what the provider's own usage page
-- showed (a percentage, or used/total amounts with the provider's unit),
-- when it was observed, and the provider's verbatim reset text.
--
-- Snapshots never mutate trackers.used_amount or usage_logs: the provider's
-- reset boundary is display text we cannot enforce, so writing provider
-- numbers into the app's own counters could silently retain stale or
-- misaligned usage. The tracker's own reset schedule alone owns its math;
-- a snapshot is provider-reported state shown alongside it.

-- Explicit per-tracker opt-in: a snapshot associates with a tracker only
-- when the user linked that tracker to a provider + metric. Manual trackers
-- are never touched, and trackers are never matched by name.
ALTER TABLE public.trackers ADD COLUMN external_provider text;
ALTER TABLE public.trackers ADD COLUMN external_metric text;

CREATE TABLE public.external_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tracker_id uuid REFERENCES public.trackers (id) ON DELETE SET NULL,
  provider text NOT NULL,
  metric text NOT NULL,
  percent numeric CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  used_amount numeric,
  total_amount numeric,
  unit text,
  reset_text text,
  observed_at timestamptz NOT NULL,
  external_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_usage_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots belong to their owner" ON public.external_usage_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users record their own snapshots" ON public.external_usage_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own snapshots" ON public.external_usage_snapshots
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX external_usage_snapshots_owner_time_idx
  ON public.external_usage_snapshots (user_id, observed_at DESC);

-- Record one snapshot transactionally. The stable external key makes
-- concurrent captures, duplicated delivery and client retries idempotent.
CREATE OR REPLACE FUNCTION public.record_external_usage_snapshot(
  p_tracker_id uuid,
  p_provider text,
  p_metric text,
  p_percent numeric,
  p_used_amount numeric,
  p_total_amount numeric,
  p_unit text,
  p_reset_text text,
  p_observed_at timestamptz,
  p_external_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not authenticated');
  END IF;

  -- A tracker association is valid only for the caller's own tracker that is
  -- explicitly linked to this provider + metric.
  IF p_tracker_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trackers
      WHERE id = p_tracker_id
        AND user_id = auth.uid()
        AND external_provider = p_provider
        AND external_metric = p_metric
    ) THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'tracker not linked');
    END IF;
  END IF;

  -- The exact reading was already recorded (retry or duplicate delivery).
  IF EXISTS (SELECT 1 FROM public.external_usage_snapshots WHERE external_key = p_external_key) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate');
  END IF;

  INSERT INTO public.external_usage_snapshots (
    user_id, tracker_id, provider, metric, percent, used_amount, total_amount,
    unit, reset_text, observed_at, external_key
  ) VALUES (
    auth.uid(), p_tracker_id, p_provider, p_metric, p_percent, p_used_amount,
    p_total_amount, p_unit, p_reset_text, p_observed_at, p_external_key
  );

  RETURN jsonb_build_object('applied', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_external_usage_snapshot(uuid, text, text, numeric, numeric, numeric, text, text, timestamptz, text) FROM public;
REVOKE ALL ON FUNCTION public.record_external_usage_snapshot(uuid, text, text, numeric, numeric, numeric, text, text, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_external_usage_snapshot(uuid, text, text, numeric, numeric, numeric, text, text, timestamptz, text) TO authenticated;
