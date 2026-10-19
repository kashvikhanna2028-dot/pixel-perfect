// Pure helpers for account recovery and passwordless sign-in.
// Kept free of UI and network code so the rules can be tested on their own.

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_EXPIRY_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Neutral message that never reveals whether an email or phone is registered.
export const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we've sent a reset link.";
export const GENERIC_CODE_MESSAGE =
  "If that contact can sign in, we've sent a code. Check your messages.";
export const GENERIC_LINK_ERROR =
  "That contact is already linked to another account. Try a different one.";

export interface CountryCode {
  name: string;
  dial: string; // E.164 country calling code without '+'
  iso: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { name: "India", dial: "91", iso: "IN" },
  { name: "United States", dial: "1", iso: "US" },
  { name: "United Kingdom", dial: "44", iso: "GB" },
  { name: "Canada", dial: "1", iso: "CA" },
  { name: "Australia", dial: "61", iso: "AU" },
  { name: "Germany", dial: "49", iso: "DE" },
  { name: "France", dial: "33", iso: "FR" },
  { name: "Spain", dial: "34", iso: "ES" },
  { name: "Italy", dial: "39", iso: "IT" },
  { name: "Netherlands", dial: "31", iso: "NL" },
  { name: "Singapore", dial: "65", iso: "SG" },
  { name: "United Arab Emirates", dial: "971", iso: "AE" },
  { name: "Japan", dial: "81", iso: "JP" },
  { name: "Brazil", dial: "55", iso: "BR" },
  { name: "South Africa", dial: "27", iso: "ZA" },
];

export const DEFAULT_COUNTRY_DIAL = "91";

// Normalize a national phone number to E.164 (`+<dial><digits>`).
// Returns null when the result cannot be a valid E.164 number.
export function normalizePhoneToE164(dialCode: string, nationalNumber: string): string | null {
  const dial = dialCode.replace(/[^\d]/g, "");
  let digits = nationalNumber.replace(/[^\d]/g, "");
  if (!dial || !digits) return null;
  // Drop a leading trunk zero ("091 234..." -> "91234...").
  digits = digits.replace(/^0+/, "");
  // If the user pasted a full international number, don't double the dial code.
  if (digits.startsWith(dial) && digits.length > dial.length + 6) {
    digits = digits.slice(dial.length);
  }
  const e164 = `+${dial}${digits}`;
  // E.164: '+' followed by 7–15 digits.
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3; // 0 too short, 1 weak, 2 good, 3 strong
  label: string;
}

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return { score: 0, label: "Too short" };
  let variety = 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) variety += 1;
  if (/\d/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;
  if (password.length >= 14 && variety >= 2) return { score: 3, label: "Strong" };
  if (variety >= 2 || password.length >= 12) return { score: 2, label: "Good" };
  return { score: 1, label: "Weak" };
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

// "9:41" style countdown for the OTP expiry timer.
export function formatOtpCountdown(secondsLeft: number): string {
  const clamped = Math.max(0, Math.floor(secondsLeft));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function cooldownRemaining(startedAtMs: number, nowMs: number): number {
  const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsed);
}

export function expiryRemaining(sentAtMs: number, nowMs: number): number {
  const elapsed = Math.floor((nowMs - sentAtMs) / 1000);
  return Math.max(0, OTP_EXPIRY_SECONDS - elapsed);
}

export function attemptsExhausted(attempts: number): boolean {
  return attempts >= OTP_MAX_ATTEMPTS;
}

// Map a raw auth error to a safe, rate-limit-friendly message.
export function friendlyOtpError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("rate limit") || message.includes("too many") || message.includes("429"))
    return "Too many attempts, try again in a few minutes.";
  if (message.includes("expired")) return "That code has expired. Request a new one.";
  if (message.includes("invalid") || message.includes("token"))
    return "That code doesn't look right. Check it and try again.";
  if (message.includes("phone") && (message.includes("provider") || message.includes("sms")))
    return "SMS provider not connected yet. See SETUP-AUTH.md to turn on phone sign-in.";
  if (message.includes("already") && (message.includes("linked") || message.includes("registered")))
    return GENERIC_LINK_ERROR;
  return "We couldn't complete that just now. Please try again in a moment.";
}
