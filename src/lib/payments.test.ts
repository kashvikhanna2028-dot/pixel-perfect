import { describe, expect, it } from 'vitest';
import {
  applyPaidTransitionIdempotent,
  createPaymentSignature,
  createWebhookSignature,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './payments';

describe('Razorpay signature verification', () => {
  it('accepts valid payment signatures', () => {
    const signature = createPaymentSignature('order_123', 'pay_456', 'secret');
    expect(
      verifyPaymentSignature({
        orderId: 'order_123',
        paymentId: 'pay_456',
        signature,
        keySecret: 'secret',
      }),
    ).toBe(true);
  });

  it('rejects tampered payment signatures', () => {
    const signature = createPaymentSignature('order_123', 'pay_456', 'secret');
    expect(
      verifyPaymentSignature({
        orderId: 'order_123',
        paymentId: 'pay_tampered',
        signature,
        keySecret: 'secret',
      }),
    ).toBe(false);
  });

  it('rejects missing payment signature fields', () => {
    expect(
      verifyPaymentSignature({
        orderId: 'order_123',
        paymentId: 'pay_456',
        signature: undefined,
        keySecret: 'secret',
      }),
    ).toBe(false);
  });

  it('accepts valid webhook signatures and rejects tampered or missing values', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const signature = createWebhookSignature(body, 'whsec');
    expect(verifyWebhookSignature({ body, signature, webhookSecret: 'whsec' })).toBe(true);
    expect(verifyWebhookSignature({ body, signature: `${signature}x`, webhookSecret: 'whsec' })).toBe(
      false,
    );
    expect(verifyWebhookSignature({ body, signature: undefined, webhookSecret: 'whsec' })).toBe(
      false,
    );
  });
});

describe('Idempotent entitlement extension', () => {
  it('extends once when transitioning to paid and does not extend on paid retries', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const first = applyPaidTransitionIdempotent('created', null, 'pro_monthly', now);
    expect(first.extended).toBe(true);
    expect(first.proUntil).toBe('2026-02-01T00:00:00.000Z');

    const second = applyPaidTransitionIdempotent('paid', first.proUntil, 'pro_monthly', now);
    expect(second.extended).toBe(false);
    expect(second.proUntil).toBe(first.proUntil);
  });
});
