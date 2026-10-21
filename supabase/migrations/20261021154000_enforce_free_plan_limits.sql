DROP POLICY IF EXISTS "Users create their own trackers" ON public.trackers;
CREATE POLICY "Users create their own trackers"
  ON public.trackers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.entitlements e
        WHERE e.user_id = auth.uid()
          AND e.plan = 'pro'
          AND (e.pro_until IS NULL OR e.pro_until > now())
      )
      OR (
        SELECT count(*)
        FROM public.trackers t
        WHERE t.user_id = auth.uid()
      ) < 5
    )
  );

DROP POLICY IF EXISTS "Subscriptions owned by user" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions readable by owner" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions editable by owner" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions deletable by owner" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions insertable by owner" ON public.subscriptions;

CREATE POLICY "Subscriptions readable by owner"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Subscriptions editable by owner"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Subscriptions deletable by owner"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Subscriptions insertable by owner"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.entitlements e
        WHERE e.user_id = auth.uid()
          AND e.plan = 'pro'
          AND (e.pro_until IS NULL OR e.pro_until > now())
      )
      OR (
        SELECT count(*)
        FROM public.subscriptions s
        WHERE s.user_id = auth.uid()
      ) < 5
    )
  );
