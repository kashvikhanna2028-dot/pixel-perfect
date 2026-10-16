import { describe, expect, it } from "vitest";
import { dateTimeFieldToIso, isoToDateTimeFields, nextResetAt, unusedValue, urgencyFor } from "@/lib/expiry-radar";

describe("Expiry Radar calculations", () => {
  it("calculates daily resets in the selected time zone", () => {
    const now = new Date("2026-10-16T15:00:00.000Z");
    const next = nextResetAt("daily", null, "09:00", "America/Los_Angeles", now);
    expect(next?.toISOString()).toBe("2026-10-16T16:00:00.000Z");
  });

  it("keeps weekly resets on the selected weekday", () => {
    const now = new Date("2026-10-16T15:00:00.000Z");
    const next = nextResetAt("weekly", 1, "09:00", "America/Los_Angeles", now);
    expect(next?.toISOString()).toBe("2026-10-19T16:00:00.000Z");
  });

  it("clamps a monthly reset day to the last day of February", () => {
    const now = new Date("2027-02-01T12:00:00.000Z");
    const next = nextResetAt("monthly", 31, "09:00", "UTC", now);
    expect(next?.toISOString()).toBe("2027-02-28T09:00:00.000Z");
  });

  it("values only the unused share of an allowance", () => {
    expect(unusedValue({ cost_value: 20, total_amount: 100, used_amount: 40 })).toBe(12);
  });

  it("stores one-time expiry using the selected IANA time zone", () => {
    expect(dateTimeFieldToIso("2026-10-17", "09:00", "America/Los_Angeles")).toBe("2026-10-17T16:00:00.000Z");
  });

  it("shows an existing expiry date and time in its own time zone", () => {
    expect(isoToDateTimeFields("2026-10-17T16:00:00.000Z", "America/Los_Angeles")).toEqual({ date: "2026-10-17", time: "09:00" });
  });

  it("marks a mostly unused allowance expiring within 48 hours urgent", () => {
    const now = new Date("2026-10-16T15:00:00.000Z");
    expect(urgencyFor(new Date("2026-10-17T15:00:00.000Z"), now, true)).toBe("urgent");
  });

  it("does not mark a nearly used-up allowance urgent for the amount left", () => {
    const now = new Date("2026-10-16T15:00:00.000Z");
    expect(urgencyFor(new Date("2026-10-17T15:00:00.000Z"), now, false)).toBe("warning");
  });
});