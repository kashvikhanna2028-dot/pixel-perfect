import { createHmac, timingSafeEqual } from 'node:crypto';

export const proPricing = {
  pro_monthly: { amountPaise: 14_900, currency: 'INR', entitlementMonths: 1 },
  pro_yearly: { amountPaise: 119_900, currency: 'INR', entitlementMonths: 12 },
} as const;

export type ProPlan = keyof typeof proPricing;
export type PaymentStatus = 'created' | 'paid' | 'failed';

type SignatureInput = {
  orderId?: string | null;
  paymentId?: string | null;
  signature?: string | null;
  keySecret?: string | null;
};

type WebhookSignatureInput = {
  body?: string | null;
  signature?: string | null;
  webhookSecret?: string | null;
};

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function createPaymentSignature(orderId: string, paymentId: string, keySecret: string): string {
  return createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

export function verifyPaymentSignature(input: SignatureInput): boolean {
  if (!input.orderId || !input.paymentId || !input.signature || !input.keySecret) return false;
  const expected = createPaymentSignature(input.orderId, input.paymentId, input.keySecret);
  return constantTimeEqual(expected, input.signature);
}

export function createWebhookSignature(body: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(body).digest('hex');
}

export function verifyWebhookSignature(input: WebhookSignatureInput): boolean {
  if (!input.body || !input.signature || !input.webhookSecret) return false;
  const expected = createWebhookSignature(input.body, input.webhookSecret);
  return constantTimeEqual(expected, input.signature);
}

export function calculateExtendedProUntil(
  currentProUntil: string | null,
  plan: ProPlan,
  now: Date = new Date(),
): string {
  const currentDate = currentProUntil ? new Date(currentProUntil) : null;
  const currentMs = currentDate && !Number.isNaN(currentDate.getTime()) ? currentDate.getTime() : 0;
  const base = new Date(Math.max(now.getTime(), currentMs));
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + proPricing[plan].entitlementMonths);
  return next.toISOString();
}

export function applyPaidTransitionIdempotent(
  status: PaymentStatus,
  currentProUntil: string | null,
  plan: ProPlan,
  now: Date = new Date(),
): { status: 'paid'; proUntil: string | null; extended: boolean } {
  if (status === 'paid') return { status: 'paid', proUntil: currentProUntil, extended: false };
  return { status: 'paid', proUntil: calculateExtendedProUntil(currentProUntil, plan, now), extended: true };
}
