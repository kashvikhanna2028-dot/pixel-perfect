import { describe, expect, it } from 'vitest';
import { mergeNotificationReads, migrateNotificationKeys, renewalNotificationKey, unreadNotificationCount, unratedNotificationKey } from './subscription-notifications';
import { demoSubscriptions, type Subscription } from './subscriptions';

describe('Persistent notification read rules', () => {
  it('unread count excludes saved acknowledgements', () => {
    expect(unreadNotificationCount(['renewal:a:2026-10-20', 'unrated:a:2026-10'], ['renewal:a:2026-10-20'])).toBe(1);
  });
  it('marks instantly while retaining earlier acknowledgements without duplicates', () => {
    expect(mergeNotificationReads(['old', 'renewal:a:2026-10-20'], ['renewal:a:2026-10-20', 'new'])).toEqual(['old', 'renewal:a:2026-10-20', 'new']);
  });
  it('migrates former local renewal and monthly rating keys', () => {
    const subscription = { ...demoSubscriptions('u', 'USD', 'UTC')[0], id: 'abc' } as Subscription;
    expect(migrateNotificationKeys(['abc-2026-10-20-false', 'abc-rating-2026-10-01', 'abc-2026-10-21-true'], [subscription])).toEqual(['renewal:abc:2026-10-20', 'unrated:abc:2026-10', 'trial_end:abc:2026-10-21']);
  });
  it('a new billing date and new month are unread again', () => {
    expect(unreadNotificationCount([renewalNotificationKey('a', '2026-11-20', false), unratedNotificationKey('a', '2026-11-01')], ['renewal:a:2026-10-20', 'unrated:a:2026-10'])).toBe(2);
  });
  it('ignores invalid legacy input', () => expect(migrateNotificationKeys({ anything: 'read' }, [])).toEqual([]));
});