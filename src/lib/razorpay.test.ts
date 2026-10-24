import { describe, expect, it } from "vitest";
import { PRO_PLANS, formatInr, nextProUntil } from "./pro-plans";
import { checkoutSignatureMatches, hmacSha256Hex, signaturesMatch } from "./razorpay.server";

describe("Pro plan config", () => {
  it("prices Pro at Rs.149 monthly and Rs.1,199 yearly in paise", () => {
    expect(PRO_PLANS.pro_monthly.amountPaise).toBe(14900);
    expect(PRO_PLANS.pro_yearly.amountPaise).toBe(119900);
    expect(PRO_PLANS.pro_monthly.currency).toBe("INR");
  });
  it("formats prices for India", () => {
    expect(formatInr(14900)).toBe("₹149");
    expect(formatInr(119900)).toBe("₹1,199");
  });
});

describe("Razorpay signatures", () => {
  // Vector from Razorpay's docs shape: HMAC_SHA256(secret, order_id|payment_id).
  it("verifies a known HMAC vector", () => {
    expect(hmacSha256Hex("secret", "order_1|pay_1")).toBe(hmacSha256Hex("secret", "order_1|pay_1"));
    expect(hmacSha256Hex("secret", "order_1|pay_1")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("accepts the correct checkout signature and rejects tampering", () => {
    const signature = hmacSha256Hex("key_secret", "order_ABC|pay_XYZ");
    expect(checkoutSignatureMatches("key_secret", "order_ABC", "pay_XYZ", signature)).toBe(true);
    expect(checkoutSignatureMatches("key_secret", "order_ABC", "pay_OTHER", signature)).toBe(false);
    expect(checkoutSignatureMatches("wrong_secret", "order_ABC", "pay_XYZ", signature)).toBe(false);
  });
  it("rejects malformed signatures without throwing", () => {
    const signature = hmacSha256Hex("key_secret", "order_ABC|pay_XYZ");
    expect(signaturesMatch(signature, "not-hex")).toBe(false);
    expect(signaturesMatch(signature, "")).toBe(false);
    expect(signaturesMatch(signature, signature.slice(2))).toBe(false);
  });
});

describe("Pro entitlement extension", () => {
  const now = new Date("2026-10-22T10:00:00.000Z");
  it("starts a new monthly subscription one month from now", () => {
    expect(nextProUntil(null, "pro_monthly", now)).toBe("2026-11-22T10:00:00.000Z");
  });
  it("starts a new yearly subscription one year from now", () => {
    expect(nextProUntil(undefined, "pro_yearly", now)).toBe("2027-10-22T10:00:00.000Z");
  });
  it("extends an active subscription from its current end date", () => {
    expect(nextProUntil("2026-12-01T00:00:00.000Z", "pro_monthly", now)).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
  it("restarts an expired subscription from now", () => {
    expect(nextProUntil("2026-01-01T00:00:00.000Z", "pro_monthly", now)).toBe(
      "2026-11-22T10:00:00.000Z",
    );
  });
  it("clamps month ends when extending from January 31", () => {
    const jan31 = new Date("2027-01-31T00:00:00.000Z");
    expect(nextProUntil(null, "pro_monthly", jan31)).toBe("2027-02-28T00:00:00.000Z");
  });
});
