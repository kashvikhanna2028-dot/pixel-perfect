export type ResetType = "one_time" | "daily" | "weekly" | "monthly";
export type TrackerCategory =
  | "llm_credits"
  | "api_quota"
  | "free_minutes"
  | "gym_pass"
  | "coupon"
  | "free_trial"
  | "other";

export type Tracker = {
  id: string;
  user_id: string;
  name: string;
  category: TrackerCategory;
  unit: string;
  total_amount: number;
  used_amount: number;
  reset_type: ResetType;
  reset_day: number | null;
  expires_at: string | null;
  reset_time: string;
  timezone: string;
  cost_value: number | null;
  notes: string;
  next_reset_at: string | null;
  created_at: string;
};

export type TrackerDraft = Omit<Tracker, "id" | "user_id" | "created_at">;

const dateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday"),
  };
};

const weekdayNumber: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Turns a wall-clock time in an IANA time zone into its corresponding instant. */
export function zonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const p = dateParts(new Date(instant), timeZone);
    const rendered = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(new Date(instant));
    const read = (type: string) => Number(rendered.find((part) => part.type === type)?.value ?? 0);
    const observed = Date.UTC(p.year, p.month - 1, p.day, read("hour"), read("minute"));
    const correction = desired - observed;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant);
}

/** Returns the first scheduled reset strictly after now. Weekly days use Sunday=0. */
export function nextResetAt(
  resetType: ResetType,
  resetDay: number | null,
  resetTime: string,
  timeZone: string,
  now: Date,
): Date | null {
  if (resetType === "one_time") return null;
  const [hour = 0, minute = 0] = resetTime.split(":").map(Number);
  const local = dateParts(now, timeZone);
  const wallDate = new Date(Date.UTC(local.year, local.month - 1, local.day));

  const candidateForDate = (candidate: Date) =>
    zonedDateTime(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth() + 1,
      candidate.getUTCDate(),
      hour,
      minute,
      timeZone,
    );

  if (resetType === "daily") {
    let result = candidateForDate(wallDate);
    if (result.getTime() <= now.getTime()) {
      wallDate.setUTCDate(wallDate.getUTCDate() + 1);
      result = candidateForDate(wallDate);
    }
    return result;
  }

  if (resetType === "weekly") {
    const target = resetDay ?? weekdayNumber[local.weekday] ?? 0;
    const difference = (target - (weekdayNumber[local.weekday] ?? 0) + 7) % 7;
    wallDate.setUTCDate(wallDate.getUTCDate() + difference);
    let result = candidateForDate(wallDate);
    if (result.getTime() <= now.getTime()) {
      wallDate.setUTCDate(wallDate.getUTCDate() + 7);
      result = candidateForDate(wallDate);
    }
    return result;
  }

  const targetDay = Math.min(resetDay ?? local.day, new Date(Date.UTC(local.year, local.month, 0)).getUTCDate());
  let result = candidateForDate(new Date(Date.UTC(local.year, local.month - 1, targetDay)));
  if (result.getTime() <= now.getTime()) {
    const nextMonth = new Date(Date.UTC(local.year, local.month, 1));
    const day = Math.min(resetDay ?? targetDay, new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate());
    result = candidateForDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), day)));
  }
  return result;
}

export function unusedValue(tracker: Pick<Tracker, "cost_value" | "total_amount" | "used_amount">): number {
  if (tracker.cost_value === null || tracker.total_amount <= 0) return 0;
  return Math.max(0, tracker.cost_value * (1 - tracker.used_amount / tracker.total_amount));
}

export function isUnused(tracker: Pick<Tracker, "total_amount" | "used_amount">): boolean {
  return tracker.used_amount < tracker.total_amount;
}

export function formatCountdown(deadline: Date, now: Date): string {
  const remaining = Math.max(0, deadline.getTime() - now.getTime());
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function dateTimeFieldToIso(date: string, time: string, timeZone: string): string | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  if (!match || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  const parsed = zonedDateTime(Number(year), Number(month), Number(day), hour, minute, timeZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function isoToDateTimeFields(isoDate: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoDate));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export function urgencyFor(deadline: Date, now: Date, lotsUnused: boolean) {
  const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (lotsUnused && hoursLeft < 48) return "urgent" as const;
  if (hoursLeft <= 24 * 7) return "warning" as const;
  return "calm" as const;
}