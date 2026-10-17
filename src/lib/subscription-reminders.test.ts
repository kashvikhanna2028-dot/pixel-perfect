import { describe, expect, it, vi } from 'vitest';
import { deliverOnce, eligibleReminders, verifyReminderSecret } from './subscription-reminders';
import { demoSubscriptions, type Subscription } from './subscriptions';

const plan = (overrides: Partial<Subscription> = {}): Subscription => ({ ...demoSubscriptions('u', 'USD', 'UTC')[0], id: 's', status: 'active', is_trial: false, next_billing_date: '2026-10-20', ...overrides }) as Subscription;
const profile = { email_reminders_enabled: true, timezone: 'UTC', renewal_reminder_days: 3 };
const now = new Date('2026-10-17T00:00:00Z');

describe('Safe email reminders', () => {
  it('skips users who have not opted in', () => expect(eligibleReminders({ ...profile, email_reminders_enabled: false }, [plan()], now)).toEqual([]));
  for (const days of [1, 3, 7]) it(`uses the ${days}-day window inclusively`, () => {
    const date = `2026-10-${17 + days}`;
    expect(eligibleReminders({ ...profile, renewal_reminder_days: days }, [plan({ next_billing_date: date }), plan({ next_billing_date: `2026-10-${18 + days}` })], now).map(r => r.billing_date)).toEqual([date]);
  });
  it('uses each user timezone, not UTC calendar date', () => {
    expect(eligibleReminders({ ...profile, timezone: 'Asia/Kolkata', renewal_reminder_days: 1 }, [plan({ next_billing_date: '2026-10-19' })], new Date('2026-10-17T20:00:00Z'))).toHaveLength(1);
    expect(eligibleReminders({ ...profile, renewal_reminder_days: 1 }, [plan({ next_billing_date: '2026-10-19' })], new Date('2026-10-17T20:00:00Z'))).toHaveLength(0);
  });
  it('selects trial end separately and skips inactive and past dates', () => {
    expect(eligibleReminders(profile, [plan({ is_trial: true, trial_ends_on: '2026-10-18' }), plan({ status: 'paused' }), plan({ status: 'cancelled' }), plan({ next_billing_date: '2026-10-16' })], now).map(r => [r.kind, r.billing_date])).toEqual([['trial_end', '2026-10-18']]);
  });
  it('never reserves or sends without a provider', async () => {
    const reserve = vi.fn(), send = vi.fn();
    expect(await deliverOnce(false, reserve, send)).toBe('would_send');
    expect(reserve).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('only one concurrent reservation sends the same reminder', async () => {
    let claimed = false;
    const reserve = async () => { if (claimed) return false; claimed = true; return true; };
    const send = vi.fn(async () => { expect(claimed).toBe(true); });
    expect(await Promise.all([deliverOnce(true, reserve, send), deliverOnce(true, reserve, send)])).toEqual(['sent', 'duplicate']);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('retains reservation after uncertain provider failure to prevent retries', async () => {
    let claimed = false;
    const reserve = async () => { if (claimed) return false; claimed = true; return true; };
    expect(await deliverOnce(true, reserve, async () => { throw new Error('Network lost'); })).toBe('failed');
    const send = vi.fn();
    expect(await deliverOnce(true, reserve, send)).toBe('duplicate'); expect(send).not.toHaveBeenCalled();
  });
  it('rejects missing, incorrect, and unconfigured secret headers', async () => {
    const request = (value?: string) => new Request('https://example.test/api/public/send-reminders', { headers: value ? { 'x-reminder-cron-secret': value } : {} });
    expect(await verifyReminderSecret(request(), 'fixture-secret')).toBe(false);
    expect(await verifyReminderSecret(request('wrong'), 'fixture-secret')).toBe(false);
    expect(await verifyReminderSecret(request('fixture-secret'), undefined)).toBe(false);
    expect(await verifyReminderSecret(request('fixture-secret'), 'fixture-secret')).toBe(true);
  });
});