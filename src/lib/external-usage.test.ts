import { describe, expect, it } from "vitest";

import {
  figureValues,
  matchLinkedTracker,
  parseSnapshotResult,
  parseUsageMessage,
  readingKey,
  snapshotArgsFor,
  type ExternalUsageReading,
} from "@/lib/external-usage";
import type { Tracker } from "@/lib/expiry-radar";

function makeTracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: "t1",
    user_id: "u1",
    name: "Claude",
    category: "ai_credits",
    unit: "credits",
    total_amount: 100,
    used_amount: 10,
    reset_type: "weekly",
    reset_day: 5,
    next_reset_at: null,
    expires_at: null,
    reset_time: "09:00",
    timezone: "Asia/Calcutta",
    cost_value: null,
    notes: "",
    external_provider: "claude",
    external_metric: "weekly",
    created_at: "",
    updated_at: "",
    ...overrides,
  } as Tracker;
}

const reading: ExternalUsageReading = {
  provider: "claude",
  id: "r1",
  sessionPercent: 13,
  sessionReset: "Resets at 2:00 PM",
  weeklyPercent: 9,
  weeklyReset: "Resets Friday 10:30 PM",
  observedAt: "2026-10-29T10:00:00.000Z",
};

describe("parseUsageMessage", () => {
  it("accepts a valid extension reading", () => {
    const parsed = parseUsageMessage({
      source: "expiry-radar-extension",
      type: "usage-reading",
      reading: { ...reading },
    });
    expect(parsed?.provider).toBe("claude");
    expect(parsed?.weeklyPercent).toBe(9);
  });

  it("rejects wrong source, missing provider and bad timestamps", () => {
    expect(parseUsageMessage({ source: "x", type: "usage-reading", reading })).toBeNull();
    expect(
      parseUsageMessage({ source: "expiry-radar-extension", type: "usage-reading", reading: { ...reading, provider: "" } }),
    ).toBeNull();
    expect(
      parseUsageMessage({
        source: "expiry-radar-extension",
        type: "usage-reading",
        reading: { ...reading, observedAt: "not a date" },
      }),
    ).toBeNull();
  });

  it("rejects out-of-range percentages", () => {
    const parsed = parseUsageMessage({
      source: "expiry-radar-extension",
      type: "usage-reading",
      reading: { ...reading, weeklyPercent: 140 },
    });
    expect(parsed?.weeklyPercent).toBeNull();
  });
});

describe("matchLinkedTracker", () => {
  it("matches only an explicitly linked tracker, never by name", () => {
    const byName = makeTracker({ id: "t2", external_provider: null, external_metric: null });
    expect(matchLinkedTracker([byName], "claude")).toBeNull();
    const linked = matchLinkedTracker([byName, makeTracker()], "claude");
    expect(linked?.tracker.id).toBe("t1");
    expect(linked?.figure).toBe("weekly");
  });

  it("does not gate on reset schedule: any linked tracker may show snapshots", () => {
    const monthly = makeTracker({ reset_type: "monthly", reset_day: 1 });
    const linked = matchLinkedTracker([monthly], "claude");
    expect(linked?.tracker.id).toBe("t1");
  });

  it("returns null when the link is ambiguous", () => {
    const a = makeTracker({ id: "a" });
    const b = makeTracker({ id: "b" });
    expect(matchLinkedTracker([a, b], "claude")).toBeNull();
  });
});

describe("snapshotArgsFor", () => {
  it("carries the verbatim percent and reset text, never a converted amount", () => {
    const args = snapshotArgsFor(makeTracker(), reading, "weekly");
    expect(args).not.toBeNull();
    expect(args?.p_percent).toBe(9);
    expect(args?.p_reset_text).toBe("Resets Friday 10:30 PM");
    expect(args?.p_used_amount).toBeNull();
    expect(args?.p_total_amount).toBeNull();
    expect(args?.p_unit).toBe("percent");
    expect(args?.p_tracker_id).toBe("t1");
    expect(args?.p_external_key).toBe(readingKey(reading, "weekly"));
  });

  it("supports the session figure without any reset-schedule gate", () => {
    const args = snapshotArgsFor(makeTracker({ reset_type: "monthly" }), reading, "session");
    expect(args?.p_percent).toBe(13);
    expect(args?.p_reset_text).toBe("Resets at 2:00 PM");
  });

  it("returns null when the figure was not read", () => {
    const noWeekly = { ...reading, weeklyPercent: null };
    expect(snapshotArgsFor(makeTracker(), noWeekly, "weekly")).toBeNull();
    expect(figureValues(noWeekly, "weekly")).toBeNull();
  });

  it("never derives tracker amounts from percentages", () => {
    // Regression guard: a tracker with total 100 must NOT receive 9 as used.
    const args = snapshotArgsFor(makeTracker({ total_amount: 100 }), reading, "weekly");
    expect(args?.p_used_amount).toBeNull();
    expect(JSON.stringify(args)).not.toContain('"p_used_amount":9');
  });
});

describe("parseSnapshotResult", () => {
  it("parses applied and duplicate results", () => {
    expect(parseSnapshotResult({ applied: true })?.applied).toBe(true);
    expect(parseSnapshotResult({ applied: false, reason: "duplicate" })?.reason).toBe("duplicate");
    expect(parseSnapshotResult("nope")).toBeNull();
    expect(parseSnapshotResult({ reason: "duplicate" })).toBeNull();
  });
});
