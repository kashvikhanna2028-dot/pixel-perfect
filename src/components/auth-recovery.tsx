// Account recovery and passwordless sign-in UI: forgot/reset password pages,
// the shared 6-box OTP input, and the Settings security card.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, LogOut, Radar, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  GENERIC_RESET_MESSAGE,
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  attemptsExhausted,
  cooldownRemaining,
  expiryRemaining,
  formatOtpCountdown,
  friendlyOtpError,
  passwordStrength,
  passwordsMatch,
} from "@/lib/auth-recovery";

const strengthStyles = [
  "bg-destructive",
  "bg-warning",
  "bg-primary",
  "bg-primary",
] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <div aria-live="polite" className="space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((step) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full ${
              password && strength.score > step ? strengthStyles[strength.score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      {password && (
        <p className="text-xs text-muted-foreground">
          {strength.label}
          {strength.score === 0 ? ` — at least ${PASSWORD_MIN_LENGTH} characters.` : ""}
        </p>
      )}
    </div>
  );
}

interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
}

// Six-box one-time-code input with auto-advance, backspace navigation and paste.
export function OtpInput({ value, onChange, disabled, autoFocus, label }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, OTP_LENGTH));
    if (digit && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function handlePaste(text: string) {
    const pasted = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`${label} digit ${index + 1}`}
          className="h-12 w-10 text-center text-lg font-semibold sm:w-11"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              handlePaste(raw);
              return;
            }
            setDigit(index, raw);
          }}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            handlePaste(event.clipboardData.getData("text"));
          }}
        />
      ))}
    </div>
  );
}

interface OtpVerifyPanelProps {
  sentAtMs: number;
  resendStartedAtMs: number;
  attempts: number;
  busy: boolean;
  onVerify: (code: string) => void;
  onResend: () => void;
}

// Shared verify panel: 6-box input, expiry countdown, resend cooldown, attempt limit.
export function OtpVerifyPanel({
  sentAtMs,
  resendStartedAtMs,
  attempts,
  busy,
  onVerify,
  onResend,
}: OtpVerifyPanelProps) {
  const [code, setCode] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cooldown = cooldownRemaining(resendStartedAtMs, now);
  const expiresIn = expiryRemaining(sentAtMs, now);
  const locked = attemptsExhausted(attempts) || expiresIn === 0;

  return (
    <div className="space-y-4">
      <OtpInput
        value={code}
        onChange={setCode}
        disabled={busy || locked}
        autoFocus
        label="One-time code"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">
          {expiresIn > 0 ? `Code expires in ${formatOtpCountdown(expiresIn)}` : "Code expired"}
        </span>
        <span>
          {Math.max(0, 5 - attempts)} {5 - attempts === 1 ? "attempt" : "attempts"} left
        </span>
      </div>
      {locked && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {attemptsExhausted(attempts)
            ? "Too many attempts. Request a new code to try again."
            : "That code has expired. Request a new one."}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          className="flex-1"
          disabled={busy || locked || code.length !== OTP_LENGTH}
          onClick={() => onVerify(code)}
        >
          {busy ? "Checking…" : "Verify code"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || cooldown > 0}
          onClick={onResend}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-background px-6 py-7">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/" aria-label="Expiry Radar home" className="inline-flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Radar className="size-5" strokeWidth={1.8} />
          </span>
          <span className="font-display text-lg font-semibold">Expiry Radar</span>
        </Link>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline size-4" /> Back to sign in
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 radar-enter">
        {children}
      </div>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 255) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      // Always the same neutral confirmation, whether or not the email exists.
      setSent(true);
    } catch (err) {
      setError(friendlyOtpError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
        <KeyRound className="size-5" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Tell us your account email and we'll send a link to choose a new password.
      </p>
      {sent ? (
        <div className="mt-7 space-y-5">
          <p
            role="status"
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm"
          >
            {GENERIC_RESET_MESSAGE}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email address</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={255}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    // The recovery link lands here with a session already established by the
    // auth client (it parses the URL hash). Confirm it is a recovery session.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && alive) setState("ready");
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const hash = window.location.hash;
      const isRecovery = hash.includes("type=recovery") || Boolean(data.session);
      setState(isRecovery ? "ready" : "invalid");
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      setError(`Choose a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
      return;
    }
    if (!passwordsMatch(password, confirm)) {
      setError("The passwords don't match. Type them again.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Sign out every other session so the old password can't linger anywhere.
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Password updated. Sign in with your new password.");
      await supabase.auth.signOut();
      await navigate({ to: "/auth" });
    } catch (err) {
      setError(friendlyOtpError(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
        <ShieldCheck className="size-5" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold">Choose a new password</h1>
      {state === "checking" && (
        <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
      )}
      {state === "invalid" && (
        <div className="mt-4 space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            This reset link has expired or was already used. Reset links work once and only
            for a short time.
          </p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

interface SecurityCardProps {
  email: string | null;
  emailConfirmed: boolean;
  phone: string | null;
  phoneConfirmed: boolean;
  hasPassword: boolean;
}

// Settings → Security: add or replace the sign-in phone number with OTP verification.
export function AddPhoneSection({ currentPhone, onChanged }: { currentPhone: string | null; onChanged: () => void }) {
  const [dial, setDial] = useState(DEFAULT_COUNTRY_DIAL);
  const [number, setNumber] = useState("");
  const [pending, setPending] = useState<{ phone: string; sentAtMs: number; resendStartedAtMs: number; attempts: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const e164 = normalizePhoneToE164(dial, number);
    if (!e164) {
      toast.error("Enter a valid phone number for the selected country code.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: e164 });
      if (error) throw error;
      const now = Date.now();
      setPending({ phone: e164, sentAtMs: now, resendStartedAtMs: now, attempts: 0 });
      toast.success(GENERIC_CODE_MESSAGE);
    } catch (err) {
      toast.error(friendlyOtpError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    if (!pending) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: pending.phone,
        token: code,
        type: "phone_change",
      });
      if (error) {
        const attempts = pending.attempts + 1;
        setPending({ ...pending, attempts });
        toast.error(attemptsExhausted(attempts) ? "Too many attempts, try again in a few minutes." : friendlyOtpError(error));
        return;
      }
      toast.success("Phone number verified.");
      setPending(null);
      setNumber("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: pending.phone });
      if (error) throw error;
      const now = Date.now();
      setPending({ ...pending, sentAtMs: now, resendStartedAtMs: now, attempts: 0 });
      toast.success(GENERIC_CODE_MESSAGE);
    } catch (err) {
      toast.error(friendlyOtpError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">{currentPhone ? "Change phone number" : "Add a phone number"}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Used for sign-in codes. We verify it with a text message before it takes effect.
      </p>
      {!pending ? (
        <form onSubmit={(event) => void sendCode(event)} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="security-country">Country code</Label>
            <select
              id="security-country"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={dial}
              onChange={(event) => setDial(event.target.value)}
            >
              {COUNTRY_CODES.map((country) => (
                <option key={country.iso} value={country.dial}>
                  {country.name} (+{country.dial})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40 flex-1 space-y-2">
            <Label htmlFor="security-phone">Phone number</Label>
            <Input
              id="security-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              maxLength={20}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            {busy ? "Sending…" : "Send verification code"}
          </Button>
        </form>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Code sent to <span className="font-medium text-foreground">{pending.phone}</span>.
          </p>
          <OtpVerifyPanel
            sentAtMs={pending.sentAtMs}
            resendStartedAtMs={pending.resendStartedAtMs}
            attempts={pending.attempts}
            busy={busy}
            onVerify={(code) => void verify(code)}
            onResend={() => void resend()}
          />
          <Button type="button" variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// Settings → Security: change or set a password, verified contacts, sign out everywhere.
export function SecurityCard({ email, emailConfirmed, phone, phoneConfirmed, hasPassword }: SecurityCardProps) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      toast.error(`Choose a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
      return;
    }
    if (!passwordsMatch(newPassword, confirmPassword)) {
      toast.error("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // Recovery sessions are exempt; a signed-in change proves the current password.
      const payload: { password: string; current_password?: string } = { password: newPassword };
      if (hasPassword && currentPassword) payload.current_password = currentPassword;
      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;
      toast.success(hasPassword ? "Password updated." : "Password set. You can now sign in with it too.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(friendlyOtpError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Signed out of all devices.");
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Couldn't sign out everywhere just now.");
      setSigningOut(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Security</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your sign-in methods and where you're logged in.
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="text-right">
            {email ?? "Not set"}{" "}
            {email && (
              <span className={emailConfirmed ? "text-primary" : "text-warning"}>
                ({emailConfirmed ? "verified" : "unverified"})
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="text-right">
            {phone ?? "Not added"}{" "}
            {phone && (
              <span className={phoneConfirmed ? "text-primary" : "text-warning"}>
                ({phoneConfirmed ? "verified" : "unverified"})
              </span>
            )}
          </dd>
        </div>
      </dl>
      <form onSubmit={(event) => void changePassword(event)} className="mt-5 space-y-4 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">{hasPassword ? "Change password" : "Set a password"}</h3>
        {hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-new-password">New password</Label>
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-confirm-password">Confirm new password</Label>
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
          </div>
        </div>
        <PasswordStrengthMeter password={newPassword} />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "Saving…" : hasPassword ? "Update password" : "Set password"}
        </Button>
      </form>
      <div className="mt-5 border-t border-border pt-5">
        <Button variant="outline" disabled={signingOut} onClick={() => void signOutEverywhere()}>
          <LogOut /> {signingOut ? "Signing out…" : "Sign out of all devices"}
        </Button>
      </div>
    </div>
  );
}
