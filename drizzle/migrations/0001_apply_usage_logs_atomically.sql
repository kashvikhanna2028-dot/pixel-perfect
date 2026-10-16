CREATE OR REPLACE FUNCTION public.apply_usage_log_to_tracker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.trackers
  SET used_amount = used_amount + NEW.amount
  WHERE id = NEW.tracker_id
    AND user_id = NEW.user_id
    AND used_amount + NEW.amount <= total_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usage must belong to the tracker owner and fit within the remaining allowance.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_usage_log_to_tracker_after_insert
AFTER INSERT ON public.usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.apply_usage_log_to_tracker();