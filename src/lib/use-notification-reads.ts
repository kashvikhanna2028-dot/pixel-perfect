import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { getNotificationReads, markNotificationsRead } from './subscriptions.functions';
import { mergeNotificationReads, migrateNotificationKeys } from './subscription-notifications';
import type { Subscription } from './subscriptions';

export function useNotificationReads(userId: string | undefined, subscriptions: Subscription[] | undefined) {
  const qc = useQueryClient();
  const load = useServerFn(getNotificationReads);
  const save = useServerFn(markNotificationsRead);
  const queryKey = ['notification-reads', userId];
  const query = useQuery({ queryKey, queryFn: () => load(), enabled: Boolean(userId), staleTime: 0, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const mutation = useMutation({
    mutationFn: (keys: string[]) => save({ data: { keys } }),
    onMutate: async keys => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<string[]>(queryKey) ?? [];
      qc.setQueryData(queryKey, mergeNotificationReads(previous, keys));
      return { previous };
    },
    onError: (_error, _keys, context) => {
      if (context) qc.setQueryData(queryKey, context.previous);
      toast.error('Read status could not be saved. Please retry.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
  useEffect(() => {
    if (!userId || !subscriptions) return;
    let cancelled = false;
    const storageKey = `subscription-read-${userId}`;
    async function migrate() {
      let local;
      try { local = localStorage.getItem(storageKey); } catch { return; }
      if (local === null) return;
      let parsed: unknown;
      try { parsed = JSON.parse(local); } catch { return; }
      const keys = migrateNotificationKeys(parsed, subscriptions ?? []);
      try {
        if (keys.length) await save({ data: { keys } });
        // Remove only after persistence succeeds; retries are idempotent.
        if (cancelled) return;
        localStorage.removeItem(storageKey);
        await qc.invalidateQueries({ queryKey: ['notification-reads', userId] });
      } catch { /* Keep the local copy for a future load. */ }
    }
    void migrate();
    return () => { cancelled = true; };
  }, [userId, subscriptions, save, qc]);
  return { read: query.data ?? [], isError: query.isError, pending: mutation.isPending, markRead: (keys: string[]) => { if (userId && !mutation.isPending) mutation.mutate(keys); } };
}