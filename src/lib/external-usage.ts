import type { Tracker } from "@/lib/expiry-radar";

// Reading shape sent by the Expiry Radar Companion browser extension.
// The extension only forwards values visible on the provider's own usage
// page; this module validates and turns them into provider-reported
// SNAPSHOTS. Snapshots are display-only: they never change a tracker's
// usage counters, because the provider's reset boundary is display text we
// cannot enforce and cadence-matching ("both weekly") is not alignment.

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

export type LinkedFigure = "weekly" | "session";

/**
 * Finds the tracker a reading is associated with for display. Association
 * requires an explicit user link (external_provider + external_metric);
 * provider readings never attach to manual trackers and are never matched
 * by name. No reset-schedule gate is needed here because snapshots never
 * write into the tracker's counters - the link is a display association,
 * not a sync channel.
 */
export function matchLinkedTracker(
  trackers: Tracker[],
  provider: string,
): { tracker: Tracker; figure: LinkedFigure } | null {
  for (const figure of ["weekly", "session"] as const) {
    const linked = trackers.filter(
      (t) => t.external_provider === provider.toLowerCase() && t.external_metric === figure,
    );
    if (linked.length === 1) return { tracker: linked[0]!, figure };
  }
  return null;
}

/** Stable dedupe key for one captured reading figure. */
export function readingKey(reading: ExternalUsageReading, figure: LinkedFigure): string {
  return `${reading.provider}:${figure}:${reading.observedAt}`;
}

/** Verbatim percent + reset text a figure carries, or null when absent. */
export function figureValues(
  reading: ExternalUsageReading,
  figure: LinkedFigure,
): { percent: number; resetText: string | null } | null {
  const percent = figure === "weekly" ? reading.weeklyPercent : reading.sessionPercent;
  if (percent === null) return null;
  return {
    percent,
    resetText: figure === "weekly" ? reading.weeklyReset : reading.sessionReset,
  };
}

/** Arguments for the record_external_usage_snapshot RPC. */
export function snapshotArgsFor(
  tracker: Tracker | null,
  reading: ExternalUsageReading,
  figure: LinkedFigure,
): {
  p_tracker_id: string | null;
  p_provider: string;
  p_metric: LinkedFigure;
  p_percent: number;
  p_used_amount: null;
  p_total_amount: null;
  p_unit: string;
  p_reset_text: string | null;
  p_observed_at: string;
  p_external_key: string;
} | null {
  const values = figureValues(reading, figure);
  if (!values) return null;
  return {
    p_tracker_id: tracker?.id ?? null,
    p_provider: reading.provider,
    p_metric: figure,
    p_percent: values.percent,
    p_used_amount: null,
    p_total_amount: null,
    p_unit: "percent",
    p_reset_text: values.resetText,
    p_observed_at: reading.observedAt,
    p_external_key: readingKey(reading, figure),
  };
}

export type SnapshotResult = {
  applied: boolean;
  reason?: string | undefined;
};

/** Interprets the RPC's jsonb return. */
export function parseSnapshotResult(data: unknown): SnapshotResult | null {
  if (typeof data !== "object" || data === null) return null;
  const r = data as Record<string, unknown>;
  if (typeof r["applied"] !== "boolean") return null;
  return {
    applied: r["applied"],
    reason: typeof r["reason"] === "string" ? r["reason"] : undefined,
  };
}
