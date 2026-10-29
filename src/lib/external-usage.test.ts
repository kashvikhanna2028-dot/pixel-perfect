import { describe, expect, it } from "vitest";
import { matchTracker, parseUsageMessage, planUsageSync } from "@/lib/external-usage";
import type { Tracker } from "@/lib/expiry-radar";

const tracker: Tracker = {
  id: "t1",
  user_id: "u1",
  name: "Claude Pro",
  category: "llm_credits",
  unit: "messages",
  total_amount: 100,
  used_amount: 20,
  reset_type: "weekly",
  reset_day: 1,
  expires_at: null,
  reset_time: "00:00",
  timezone: "UTC",
  cost_value: 20,
  notes: "",
  next_reset_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const validMessage = {
  source: "expiry-radar-extension",
  type: "usage-reading",
  reading: {
    provider: "claude",
    sessionPercent: 42,
    sessionReset: "Resets in 2 hr",
    weeklyPercent: 35,
    weeklyReset: "Resets Nov 3",
    observedAt: "2026-10-29T04:00:00.000Z",
  },
};

describe("parseUsageMessage", () => {
  it("accepts a valid extension message", () => {
    expect(parseUsageMessage(validMessage)).toEqual({
      provider: "claude",
      sessionPercent: 42,
      sessionReset: "Resets in 2 hr",
      weeklyPercent: 35,
      weeklyReset: "Resets Nov 3",
      observedAt: "2026-10-29T04:00:00.000Z",
    });
  });
  it("rejects messages from other sources", () => {
    expect(parseUsageMessage({ ...validMessage, source: "evil" })).toBeNull();
    expect(parseUsageMessage(null)).toBeNull();
    expect(parseUsageMessage("usage-reading")).toBeNull();
  });
  it("rejects out-of-range percents", () => {
    const bad = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: 140 } };
    expect(parseUsageMessage(bad)?.weeklyPercent).toBeNull();
  });
  it("rejects a bad observedAt", () => {
    const bad = { ...validMessage, reading: { ...validMessage.reading, observedAt: "not a date" } };
    expect(parseUsageMessage(bad)).toBeNull();
  });
});

describe("matchTracker", () => {
  it("matches the single tracker containing the provider name", () => {
    expect(matchTracker([tracker], "claude")?.id).toBe("t1");
  });
  it("returns null when zero trackers match", () => {
    expect(matchTracker([], "claude")).toBeNull();
  });
  it("prefers the weekly-named tracker for weekly figures", () => {
    const weekly = { ...tracker, id: "tw", name: "Claude weekly" };
    const session = { ...tracker, id: "ts", name: "Claude session" };
    expect(matchTracker([weekly, session], "claude", "weekly")?.id).toBe("tw");
    expect(matchTracker([weekly, session], "claude", "session")?.id).toBe("ts");
  });
  it("refuses to guess when two trackers carry the same keyword", () => {
    const a = { ...tracker, id: "ta", name: "Claude weekly home" };
    const b = { ...tracker, id: "tb", name: "Claude weekly work" };
    expect(matchTracker([a, b], "claude", "weekly")).toBeNull();
  });
  it("ignores a generic match for session figures without a session tracker", () => {
    expect(matchTracker([tracker], "claude", "session")).toBeNull();
  });
});

describe("planUsageSync", () => {
  it("logs the delta when usage increased", () => {
    const plan = planUsageSync(tracker, parseUsageMessage(validMessage)!);
    expect(plan).toEqual({ type: "log", tracker, amount: 15 });
  });
  it("snaps down when the provider reset first", () => {
    const resetMsg = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: 5 } };
    const plan = planUsageSync(tracker, parseUsageMessage(resetMsg)!);
    expect(plan).toEqual({ type: "reset", tracker, usedAmount: 5 });
  });
  it("does nothing when unchanged or weekly is missing", () => {
    const sameMsg = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: 20 } };
    expect(planUsageSync(tracker, parseUsageMessage(sameMsg)!).type).toBe("none");
    const noWeekly = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: null } };
    expect(planUsageSync(tracker, parseUsageMessage(noWeekly)!).type).toBe("none");
  });
  it("scales to tracker totals other than 100", () => {
    const big = { ...tracker, total_amount: 500, used_amount: 0 };
    const plan = planUsageSync(big, parseUsageMessage(validMessage)!);
    expect(plan).toEqual({ type: "log", tracker: big, amount: 175 });
  });
});
