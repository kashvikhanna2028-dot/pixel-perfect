import { describe, expect, it } from "vitest";
import {
  matchLinkedTracker,
  matchTracker,
  parseSyncResult,
  parseUsageMessage,
  readingKey,
  syncArgsFor,
  usedAmountFor,
} from "@/lib/external-usage";
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
      id: null,
      sessionPercent: 42,
      sessionReset: "Resets in 2 hr",
      weeklyPercent: 35,
      weeklyReset: "Resets Nov 3",
      observedAt: "2026-10-29T04:00:00.000Z",
    });
  });
  it("passes through a reading id when present", () => {
    const withId = { ...validMessage, reading: { ...validMessage.reading, id: "r-1" } };
    expect(parseUsageMessage(withId)?.id).toBe("r-1");
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
  it("matches the tracker explicitly linked to the provider and metric", () => {
    const linked = { ...tracker, external_provider: "claude", external_metric: "weekly" };
    expect(matchTracker([tracker, linked], "claude", "weekly")?.id).toBe("tw" in linked ? "" : linked.id);
  });
  it("never matches an unlinked (manual) tracker, even when the name fits", () => {
    expect(matchTracker([tracker], "claude", "weekly")).toBeNull();
    const named = { ...tracker, name: "Claude weekly" };
    expect(matchTracker([named], "claude", "weekly")).toBeNull();
  });
  it("does not match a tracker linked to a different metric or provider", () => {
    const session = { ...tracker, external_provider: "claude", external_metric: "session" };
    expect(matchTracker([session], "claude", "weekly")).toBeNull();
    const other = { ...tracker, external_provider: "chatgpt", external_metric: "weekly" };
    expect(matchTracker([other], "claude", "weekly")).toBeNull();
  });
  it("refuses to guess when two trackers carry the same link", () => {
    const a = { ...tracker, id: "ta", external_provider: "claude", external_metric: "weekly" };
    const b = { ...tracker, id: "tb", external_provider: "claude", external_metric: "weekly" };
    expect(matchTracker([a, b], "claude", "weekly")).toBeNull();
  });
});

describe("usedAmountFor", () => {
  it("maps a weekly percent onto the tracker total", () => {
    const reading = parseUsageMessage(validMessage)!;
    expect(usedAmountFor(tracker, reading)).toBe(35);
  });
  it("scales to tracker totals other than 100", () => {
    const big = { ...tracker, total_amount: 500 };
    expect(usedAmountFor(big, parseUsageMessage(validMessage)!)).toBe(175);
  });
  it("returns null without a weekly figure", () => {
    const noWeekly = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: null } };
    expect(usedAmountFor(tracker, parseUsageMessage(noWeekly)!)).toBeNull();
  });
});

describe("readingKey", () => {
  it("is stable for the same captured reading and differs per capture", () => {
    const a = parseUsageMessage(validMessage)!;
    const later = {
      ...validMessage,
      reading: { ...validMessage.reading, observedAt: "2026-10-29T05:00:00.000Z" },
    };
    const b = parseUsageMessage(later)!;
    expect(readingKey(a)).toBe(readingKey({ ...a }));
    expect(readingKey(a)).not.toBe(readingKey(b));
    expect(readingKey(a)).toBe("claude:weekly:2026-10-29T04:00:00.000Z");
  });
});

describe("syncArgsFor", () => {
  it("builds the RPC arguments", () => {
    const reading = parseUsageMessage(validMessage)!;
    expect(syncArgsFor(tracker, reading)).toEqual({
      p_tracker_id: "t1",
      p_used_amount: 35,
      p_external_key: "claude:weekly:2026-10-29T04:00:00.000Z",
      p_provider: "claude",
      p_metric: "weekly",
    });
  });
  it("returns null without a weekly figure", () => {
    const noWeekly = { ...validMessage, reading: { ...validMessage.reading, weeklyPercent: null } };
    expect(syncArgsFor(tracker, parseUsageMessage(noWeekly)!)).toBeNull();
  });
});

describe("parseSyncResult", () => {
  it("accepts the RPC jsonb shapes", () => {
    expect(parseSyncResult({ applied: true, amount: 15, used_amount: 35 })).toEqual({
      applied: true,
      reason: undefined,
      amount: 15,
      used_amount: 35,
    });
    expect(parseSyncResult({ applied: false, reason: "duplicate" })?.applied).toBe(false);
  });
  it("rejects malformed results", () => {
    expect(parseSyncResult(null)).toBeNull();
    expect(parseSyncResult({ applied: "yes" })).toBeNull();
  });
});

describe("linked figure selection (weekly preferred, session supported)", () => {
  const linked = (metric: "weekly" | "session"): Tracker => ({
    ...tracker,
    id: `t-${metric}`,
    external_provider: "claude",
    external_metric: metric,
  });
  const reading = {
    provider: "claude",
    id: "r1",
    sessionPercent: 42,
    sessionReset: null,
    weeklyPercent: 35,
    weeklyReset: null,
    observedAt: "2026-10-29T04:00:00.000Z",
  };

  it("matchLinkedTracker prefers the weekly link when both exist", () => {
    const found = matchLinkedTracker([linked("session"), linked("weekly")], "claude");
    expect(found?.tracker.id).toBe("t-weekly");
    expect(found?.figure).toBe("weekly");
  });

  it("matchLinkedTracker falls back to a session link", () => {
    const found = matchLinkedTracker([linked("session")], "claude");
    expect(found?.tracker.id).toBe("t-session");
    expect(found?.figure).toBe("session");
  });

  it("matchLinkedTracker returns null without an explicit link", () => {
    expect(matchLinkedTracker([tracker], "claude")).toBeNull();
  });

  it("syncArgsFor uses the session figure and keys by it", () => {
    const args = syncArgsFor(linked("session"), reading, "session");
    expect(args?.p_used_amount).toBe(42);
    expect(args?.p_metric).toBe("session");
    expect(args?.p_external_key).toBe("claude:session:2026-10-29T04:00:00.000Z");
  });

  it("usedAmountFor returns null when the linked figure was not read", () => {
    expect(usedAmountFor(linked("weekly"), { ...reading, weeklyPercent: null }, "weekly")).toBeNull();
  });

  it("readingKey defaults to weekly for backwards compatibility", () => {
    expect(readingKey(reading)).toBe("claude:weekly:2026-10-29T04:00:00.000Z");
  });
});
