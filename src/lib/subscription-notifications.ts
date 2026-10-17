import { monthKey, type Subscription } from './subscriptions';

export const renewalNotificationKey = (id: string, date: string, trial: boolean) => `${trial ? 'trial_end' : 'renewal'}:${id}:${date}`;
export const unratedNotificationKey = (id: string, month: string) => `unrated:${id}:${month.slice(0, 7)}`;
export const mergeNotificationReads = (existing: string[], incoming: string[]) => [...new Set([...existing, ...incoming])];
export const unreadNotificationCount = (keys: string[], read: string[]) => keys.filter(key => !read.includes(key)).length;

export function migrateNotificationKeys(value: unknown, subscriptions: Subscription[]): string[] {
  if (!Array.isArray(value)) return [];
  return mergeNotificationReads([], value.filter((key): key is string => typeof key === 'string').flatMap(key => {
    if (/^(renewal|trial_end|unrated):/.test(key)) return [key];
    for (const s of subscriptions) {
      if (!key.startsWith(`${s.id}-`)) continue;
      const suffix = key.slice(s.id.length + 1);
      const rating = /^rating-(\d{4}-\d{2})-01$/.exec(suffix);
      if (rating?.[1]) return [unratedNotificationKey(s.id, monthKey(`${rating[1]}-01`))];
      const renewal = /^(\d{4}-\d{2}-\d{2})-(true|false)$/.exec(suffix);
      if (renewal?.[1]) return [renewalNotificationKey(s.id, renewal[1], renewal[2] === 'true')];
    }
    return [];
  }));
}