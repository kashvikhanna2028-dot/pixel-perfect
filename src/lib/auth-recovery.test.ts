import { describe, expect, it } from "vitest";
import {
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  attemptsExhausted,
  cooldownRemaining,
  expiryRemaining,
  formatOtpCountdown,
  friendlyOtpError,
  normalizePhoneToE164,
  passwordStrength,
  passwordsMatch,
  GENERIC_RESET_MESSAGE,
} from "./auth-recovery";

describe("normalizePhoneToE164", () => {
  it("normalizes an Indian number with the default +91 code", () => {
    expect(normalizePhoneToE164("91", "98765 43210")).toBe("+919876543210");
  });
  it("drops a leading trunk zero", () => {
    expect(normalizePhoneToE164("91", "09876543210")).toBe("+919876543210");
  });
  it("does not double the dial code on pasted international numbers", () => {
    expect(normalizePhoneToE164("91", "919876543210")).toBe("+919876543210");
  });
  it("strips punctuation and spaces", () => {
    expect(normalizePhoneToE164("1", "(415) 555-0132")).toBe("+14155550132");
  });
  it("rejects numbers that are too short or too long", () => {
    expect(normalizePhoneToE164("91", "12345")).toBeNull();
    expect(normalizePhoneToE164("91", "987654321098765432")).toBeNull();
  });
  it("rejects empty input", () => {
    expect(normalizePhoneToE164("91", "")).toBeNull();
    expect(normalizePhoneToE164("", "9876543210")).toBeNull();
  });
});

describe("passwordStrength", () => {
  it("flags passwords under 8 characters as too short", () => {
    expect(passwordStrength("Ab1!").score).toBe(0);
  });
  it("rates a simple 8-letter password as weak", () => {
    expect(passwordStrength("password").score).toBe(1);
  });
  it("rates mixed case plus digits as good", () => {
    expect(passwordStrength("Passw0rd").score).toBe(2);
  });
  it("rates long varied passwords as strong", () => {
    expect(passwordStrength("Tr4ck-My-Res3ts!").score).toBe(3);
  });
});

describe("passwordsMatch", () => {
  it("requires identical non-empty passwords", () => {
    expect(passwordsMatch("secret123", "secret123")).toBe(true);
    expect(passwordsMatch("secret123", "secret124")).toBe(false);
    expect(passwordsMatch("", "")).toBe(false);
  });
});

describe("OTP timers", () => {
  it("formats the expiry countdown as m:ss", () => {
    expect(formatOtpCountdown(600)).toBe("10:00");
    expect(formatOtpCountdown(61)).toBe("1:01");
    expect(formatOtpCountdown(0)).toBe("0:00");
    expect(formatOtpCountdown(-5)).toBe("0:00");
  });
  it("counts down the 60-second resend cooldown", () => {
    const start = 1_000_000;
    expect(cooldownRemaining(start, start)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
    expect(cooldownRemaining(start, start + 30_000)).toBe(30);
    expect(cooldownRemaining(start, start + 61_000)).toBe(0);
  });
  it("counts down the 10-minute code expiry", () => {
    const sent = 2_000_000;
    expect(expiryRemaining(sent, sent)).toBe(OTP_EXPIRY_SECONDS);
    expect(expiryRemaining(sent, sent + 60_000)).toBe(540);
    expect(expiryRemaining(sent, sent + 601_000)).toBe(0);
  });
  it("blocks verification after the attempt limit", () => {
    expect(attemptsExhausted(OTP_MAX_ATTEMPTS - 1)).toBe(false);
    expect(attemptsExhausted(OTP_MAX_ATTEMPTS)).toBe(true);
  });
});

describe("safe messaging", () => {
  it("never reveals whether an email is registered", () => {
    expect(GENERIC_RESET_MESSAGE).toBe(
      "If an account exists for that email, we've sent a reset link.",
    );
  });
  it("maps rate-limit errors to a friendly message", () => {
    expect(friendlyOtpError(new Error("over_email_send_rate_limit 429 too many"))).toBe(
      "Too many attempts, try again in a few minutes.",
    );
  });
  it("maps missing SMS provider to a setup hint", () => {
    expect(friendlyOtpError(new Error("phone provider sms not configured"))).toContain(
      "SMS provider not connected",
    );
  });
  it("maps expired codes clearly", () => {
    expect(friendlyOtpError(new Error("otp expired"))).toBe(
      "That code has expired. Request a new one.",
    );
  });
});
