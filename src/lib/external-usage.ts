import type { Tracker } from "@/lib/expiry-radar";

// Reading shape sent by the Expiry Radar Companion browser extension.
// The extension only forwards numbers visible on the provider's own usage
// page; this module validates and decides what (if anything) to write.

export type ExternalUsageReading = {
  provider: string;
  id: string | null;
  sessionPercent: number | null;
  sessionReset: string | null;
  weeklyPercent: number | null;
  weeklyReset: string | null;
  observedAt: string;
};

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
  const id = reading["id"];
  return {
    provider: (reading["provider"] as string).toLowerCase(),
    id: typeof id === "string" && id ? id : null,
    sessionPercent: asPercent(reading["sessionPercent"]),
    sessionReset: typeof sessionReset === "string" ? sessionReset : null,
    weeklyPercent: asPercent(reading["weeklyPercent"]),
    weeklyReset: typeof weeklyReset === "string" ? weeklyReset : null,
    observedAt,
  };
}

/**
 * Finds the tracker a reading applies to. A tracker syncs only when the user
 * explicitly linked it to this provider and metric (external_provider +
 * external_metric); automatic sync never guesses from tracker names and never
 * touches a manual tracker.
 */
export function matchTracker(
  trackers: Tracker[],
  provider: string,
  figure: "weekly" | "session" = "weekly",
): Tracker | null {
  const linked = trackers.filter(
    (t) => t.external_provider === provider.toLowerCase() && t.external_metric === figure,
  );
  return linked.length === 1 ? (linked[0] ?? null) : null;
}

/**
 * Stable dedupe key for one captured reading. The same reading re-delivered
 * (retry, second dashboard tab) carries the same key, so the database can
 * reject the duplicate. A new capture on the usage page gets a new key.
 */
export function readingKey(reading: ExternalUsageReading): string {
  return `${reading.provider}:weekly:${reading.observedAt}`;
}

/** Absolute used amount the reading implies for the tracker, rounded to cents. */
export function usedAmountFor(tracker: Tracker, reading: ExternalUsageReading): number | null {
  if (reading.weeklyPercent === null) return null;
  return Math.round((reading.weeklyPercent / 100) * tracker.total_amount * 100) / 100;
}

/** Arguments for the apply_external_usage_reading RPC. */
export function syncArgsFor(
  tracker: Tracker,
  reading: ExternalUsageReading,
): {
  p_tracker_id: string;
  p_used_amount: number;
  p_external_key: string;
  p_provider: string;
  p_metric: "weekly" | "session";
} | null {
  const used = usedAmountFor(tracker, reading);
  if (used === null) return null;
  return {
    p_tracker_id: tracker.id,
    p_used_amount: used,
    p_external_key: readingKey(reading),
    p_provider: reading.provider,
    p_metric: "weekly",
  };
}

export type SyncResult = {
  applied: boolean;
  reason?: string | undefined;
  amount?: number | undefined;
  used_amount?: number | undefined;
};

/** Interprets the RPC's jsonb return. */
export function parseSyncResult(data: unknown): SyncResult | null {
  if (typeof data !== "object" || data === null) return null;
  const r = data as Record<string, unknown>;
  if (typeof r["applied"] !== "boolean") return null;
  return {
    applied: r["applied"],
    reason: typeof r["reason"] === "string" ? r["reason"] : undefined,
    amount: typeof r["amount"] === "number" ? r["amount"] : undefined,
    used_amount: typeof r["used_amount"] === "number" ? r["used_amount"] : undefined,
  };
}
