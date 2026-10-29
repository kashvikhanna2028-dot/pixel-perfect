-- Companion extension sync: apply an external usage reading transactionally.
-- A reading carries an absolute "used" amount read off the provider's own
-- usage page plus a stable key, so concurrent captures, duplicated delivery
-- and client retries can never double-apply or move usage backwards.

-- Explicit per-tracker opt-in: automatic sync writes only to a tracker the
-- user has linked to a provider + metric. Manual trackers are never touched.
ALTER TABLE public.trackers ADD COLUMN external_provider text;
ALTER TABLE public.trackers ADD COLUMN external_metric text;

ALTER TABLE public.usage_logs ADD COLUMN external_key text;
CREATE UNIQUE INDEX usage_logs_external_key_uniq
  ON public.usage_logs (external_key)
  WHERE external_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_external_usage_reading(
  p_tracker_id uuid,
  p_used_amount numeric,
  p_external_key text,
  p_provider text DEFAULT 'claude',
  p_metric text DEFAULT 'weekly'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tracker public.trackers;
  v_delta numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not authenticated');
  END IF;

  -- Lock the tracker row: concurrent readings serialize on this row.
  SELECT * INTO v_tracker
  FROM public.trackers
  WHERE id = p_tracker_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'tracker not found');
  END IF;

  -- The tracker must be explicitly linked to this provider + metric.
  IF v_tracker.external_provider IS DISTINCT FROM p_provider
     OR v_tracker.external_metric IS DISTINCT FROM p_metric THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'tracker not linked');
  END IF;

  -- The exact reading was already applied (retry or duplicate delivery).
  IF EXISTS (SELECT 1 FROM public.usage_logs WHERE external_key = p_external_key) THEN
    RETURN jsonb_build_object(
      'applied', false, 'reason', 'duplicate', 'used_amount', v_tracker.used_amount
    );
  END IF;

  v_delta := round(p_used_amount - v_tracker.used_amount, 2);

  -- A reading at or below the current level means no new usage (or the
  -- provider reset ahead of schedule). Never move usage backwards here; the
  -- app's own reset schedule owns decreases.
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object(
      'applied', false, 'reason', 'no increase', 'used_amount', v_tracker.used_amount
    );
  END IF;

  INSERT INTO public.usage_logs (tracker_id, user_id, amount, external_key)
  VALUES (p_tracker_id, auth.uid(), v_delta, p_external_key);

  RETURN jsonb_build_object(
    'applied', true, 'amount', v_delta, 'used_amount', v_tracker.used_amount + v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_external_usage_reading(uuid, numeric, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.apply_external_usage_reading(uuid, numeric, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_external_usage_reading(uuid, numeric, text, text, text) TO authenticated;
