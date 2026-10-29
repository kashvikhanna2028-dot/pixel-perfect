import type { Tracker } from "@/lib/expiry-radar";

// Reading shape sent by the Expiry Radar Companion browser extension.
// The extension only forwards values visible on the provider's own usage
// page; this module validates and turns them into provider-reported
// SNAPSHOTS. Snapshots are display-only: they never change a tracker's
// usage counters, because the provider's reset boundary is display text we
// cannot enforce and cadence-matching ("both weekly") is not alignment.

/** One provider figure, verbatim from the provider's own page. */
export type UsageFigure = {
  metric: string;
  percent: number | null;
  used: number | null;
  total: number | null;
  unit: string | null;
  resetText: string | null;
};

export type ExternalUsageReading = {
  provider: string;
  id: string | null;
  sessionPercent: number | null;
  sessionReset: string | null;
  weeklyPercent: number | null;
  weeklyReset: string | null;
  observedAt: string;
  /** Generic per-provider figures (used by non-Claude readers). */
  figures?: UsageFigure[] | undefined;
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
  const figuresRaw = Array.isArray(reading["figures"]) ? reading["figures"] : undefined;
  const figures: UsageFigure[] | undefined = figuresRaw
    ?.map((f): UsageFigure | null => {
      if (typeof f !== "object" || f === null) return null;
      const fr = f as Record<string, unknown>;
      if (typeof fr["metric"] !== "string" || !fr["metric"]) return null;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      const str = (v: unknown) => (typeof v === "string" && v ? v : null);
      return {
        metric: fr["metric"],
        percent: asPercent(fr["percent"]),
        used: num(fr["used"]),
        total: num(fr["total"]),
        unit: str(fr["unit"]),
        resetText: str(fr["resetText"]),
      };
    })
    .filter((f): f is UsageFigure => f !== null);
  return {
    provider: (reading["provider"] as string).toLowerCase(),
    id: typeof id === "string" && id ? id : null,
    sessionPercent: asPercent(reading["sessionPercent"]),
    sessionReset: typeof sessionReset === "string" ? sessionReset : null,
    weeklyPercent: asPercent(reading["weeklyPercent"]),
    weeklyReset: typeof weeklyReset === "string" ? weeklyReset : null,
    observedAt,
    figures: figures && figures.length > 0 ? figures : undefined,
  };
}

/** Metrics a reading actually carries: generic figures, else Claude's two. */
export function readingMetrics(reading: ExternalUsageReading): string[] {
  if (reading.figures) return reading.figures.map((f) => f.metric);
  const out: string[] = [];
  if (reading.weeklyPercent !== null) out.push("weekly");
  if (reading.sessionPercent !== null) out.push("session");
  return out;
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
): { tracker: Tracker; figure: string } | null {
  const linked = trackers.filter((t) => t.external_provider === provider.toLowerCase());
  if (linked.length === 1 && linked[0]!.external_metric) {
    return { tracker: linked[0]!, figure: linked[0]!.external_metric };
  }
  return null;
}

/** Stable dedupe key for one captured reading figure. */
export function readingKey(reading: ExternalUsageReading, figure: string): string {
  return `${reading.provider}:${figure}:${reading.observedAt}`;
}

/** Verbatim values a figure carries, or null when absent from the reading. */
export function figureValues(
  reading: ExternalUsageReading,
  figure: string,
): { percent: number | null; used: number | null; total: number | null; unit: string | null; resetText: string | null } | null {
  if (reading.figures) {
    const f = reading.figures.find((x) => x.metric === figure);
    if (!f) return null;
    if (f.percent === null && f.used === null) return null;
    return { percent: f.percent, used: f.used, total: f.total, unit: f.unit, resetText: f.resetText };
  }
  const percent = figure === "weekly" ? reading.weeklyPercent : figure === "session" ? reading.sessionPercent : null;
  if (percent === null) return null;
  return {
    percent,
    used: null,
    total: null,
    unit: "percent",
    resetText: figure === "weekly" ? reading.weeklyReset : reading.sessionReset,
  };
}

/** Arguments for the record_external_usage_snapshot RPC. */
export function snapshotArgsFor(
  tracker: Tracker | null,
  reading: ExternalUsageReading,
  figure: string,
): {
  p_tracker_id: string | null;
  p_provider: string;
  p_metric: string;
  p_percent: number | null;
  p_used_amount: number | null;
  p_total_amount: number | null;
  p_unit: string | null;
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
    p_used_amount: values.used,
    p_total_amount: values.total,
    p_unit: values.unit,
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
