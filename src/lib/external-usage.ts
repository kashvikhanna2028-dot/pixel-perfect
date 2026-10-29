import type { Tracker } from "@/lib/expiry-radar";

// Reading shape sent by the Expiry Radar Companion browser extension.
// The extension only forwards numbers visible on the provider's own usage
// page; this module validates and decides what (if anything) to write.

export type ExternalUsageReading = {
  provider: string;
  sessionPercent: number | null;
  sessionReset: string | null;
  weeklyPercent: number | null;
  weeklyReset: string | null;
  observedAt: string;
};

export type SyncPlan =
  | { type: "log"; tracker: Tracker; amount: number }
  | { type: "reset"; tracker: Tracker; usedAmount: number }
  | { type: "none"; reason: string };

const EXTENSION_SOURCE = "expiry-radar-extension";

function asPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

/** Validates a window.postMessage payload from the companion extension. */
export function parseUsageMessage(data: unknown): ExternalUsageReading | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg["source"] !== EXTENSION_SOURCE || msg["type"] !== "usage-reading") return null;
  const reading = msg["reading"] as Record<string, unknown> | undefined;
  if (!reading || typeof reading["provider"] !== "string" || !reading["provider"]) return null;
  const observedAt = reading["observedAt"];
  if (typeof observedAt !== "string" || Number.isNaN(Date.parse(observedAt))) return null;
  const sessionReset = reading["sessionReset"];
  const weeklyReset = reading["weeklyReset"];
  return {
    provider: (reading["provider"] as string).toLowerCase(),
    sessionPercent: asPercent(reading["sessionPercent"]),
    sessionReset: typeof sessionReset === "string" ? sessionReset : null,
    weeklyPercent: asPercent(reading["weeklyPercent"]),
    weeklyReset: typeof weeklyReset === "string" ? weeklyReset : null,
    observedAt,
  };
}

/**
 * Finds the tracker a reading applies to. Names carry the intent: a tracker
 * whose name also contains "week" takes the weekly figure, one containing
 * "session" takes the 5-hour session figure. With a single provider match the
 * weekly figure wins, because weekly reset types are what trackers model.
 */
export function matchTracker(
  trackers: Tracker[],
  provider: string,
  figure: "weekly" | "session" = "weekly",
): Tracker | null {
  const matches = trackers.filter((t) => t.name.toLowerCase().includes(provider.toLowerCase()));
  if (matches.length === 0) return null;
  const keyword = figure === "weekly" ? "week" : "session";
  const specific = matches.filter((t) => t.name.toLowerCase().includes(keyword));
  if (specific.length === 1) return specific[0] ?? null;
  if (specific.length > 1) return null; // ambiguous, refuse to guess
  if (figure === "weekly" && matches.length === 1) return matches[0] ?? null;
  return null;
}

/**
 * Decides how to apply a reading to a tracker. The tracker models the same
 * weekly allowance, so the reported percent maps to an absolute used amount.
 * Increase → log the delta (the DB trigger applies it atomically).
 * Decrease → the provider reset before our schedule; snap used_amount down.
 */
export function planUsageSync(tracker: Tracker, reading: ExternalUsageReading): SyncPlan {
  if (reading.weeklyPercent === null) return { type: "none", reason: "no weekly figure read" };
  const usedAbsolute = Math.round((reading.weeklyPercent / 100) * tracker.total_amount * 100) / 100;
  const delta = Math.round((usedAbsolute - tracker.used_amount) * 100) / 100;
  if (delta > 0) return { type: "log", tracker, amount: delta };
  if (delta < 0) return { type: "reset", tracker, usedAmount: usedAbsolute };
  return { type: "none", reason: "no change" };
}
