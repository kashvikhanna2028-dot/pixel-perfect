// Shared Razorpay Pro plan configuration. Prices live only here; the server is authoritative.
// Client-safe: no secrets in this module.
export const PRO_PLANS = {
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro Monthly",
    intervalLabel: "month",
    months: 1,
    amountPaise: 14900,
    currency: "INR",
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro Yearly",
    intervalLabel: "year",
    months: 12,
    amountPaise: 119900,
    currency: "INR",
  },
} as const;

export type ProPlanId = keyof typeof PRO_PLANS;

export const isProPlanId = (value: unknown): value is ProPlanId =>
  typeof value === "string" && value in PRO_PLANS;

export const formatInr = (amountPaise: number) =>
  `₹${(amountPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

// Pure entitlement extension: an active subscription extends from its current end,
// an expired or missing one starts now. Testable without a database.
export function nextProUntil(
  currentProUntil: string | null | undefined,
  planId: ProPlanId,
  now: Date,
): string {
  const current = currentProUntil ? new Date(currentProUntil) : null;
  const base = current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  const next = new Date(base.getTime());
  const dayOfMonth = next.getDate();
  if (PRO_PLANS[planId].months >= 12) next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  // Clamp to the target month's last day when the day overflows (e.g. Jan 31 -> Feb 28).
  if (next.getDate() !== dayOfMonth) next.setDate(0);
  return next.toISOString();
}
