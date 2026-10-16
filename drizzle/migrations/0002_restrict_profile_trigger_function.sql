REVOKE ALL ON FUNCTION public.create_profile_for_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_profile_for_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.create_profile_for_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.apply_usage_log_to_tracker() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_usage_log_to_tracker() FROM anon;
REVOKE ALL ON FUNCTION public.apply_usage_log_to_tracker() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_usage_log_to_tracker() TO service_role;