import { calculateExtendedProUntil, proPricing, type ProPlan } from '@/lib/payments';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

type PaymentRow = {
  id: string;
  user_id: string;
  plan: ProPlan;
  status: 'created' | 'paid' | 'failed';
  razorpay_payment_id: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('Payment provider is not configured.');
  return value;
}

function adminDb() {
  return supabaseAdmin as any;
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function createRazorpayOrder(userId: string, plan: ProPlan): Promise<{ orderId: string; keyId: string }> {
  const keyId = requiredEnv('RAZORPAY_KEY_ID');
  const keySecret = requiredEnv('RAZORPAY_KEY_SECRET');
  const pricing = proPricing[plan];
  const receipt = `expiry-radar-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: pricing.amountPaise,
      currency: pricing.currency,
      receipt,
      notes: { user_id: userId, plan },
      payment_capture: 1,
    }),
  });
  if (!response.ok) throw new Error('Order creation failed.');
  const payload = await response.json() as { id?: string };
  if (!payload.id) throw new Error('Order creation failed.');

  const { error } = await adminDb().from('payments').insert({
    user_id: userId,
    razorpay_order_id: payload.id,
    plan,
    amount_paise: pricing.amountPaise,
    currency: pricing.currency,
    status: 'created',
  });
  if (error) throw new Error('Payment record could not be saved.');

  return { orderId: payload.id, keyId };
}

async function loadPaymentByOrder(orderId: string, userId?: string): Promise<PaymentRow | null> {
  let query = adminDb()
    .from('payments')
    .select('id,user_id,plan,status,razorpay_payment_id')
    .eq('razorpay_order_id', orderId)
    .limit(1);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error('Payment lookup failed.');
  return (data ?? null) as PaymentRow | null;
}

export async function markPaymentPaidAndExtend(
  orderId: string,
  paymentId: string,
  paidAt: Date = new Date(),
  expectedUserId?: string,
): Promise<'paid' | 'already_paid' | 'not_found'> {
  const payment = await loadPaymentByOrder(orderId, expectedUserId);
  if (!payment) return 'not_found';
  if (payment.razorpay_payment_id && payment.razorpay_payment_id !== paymentId) {
    throw new Error('Payment ID mismatch.');
  }
  if (payment.status === 'paid') return 'already_paid';

  const paidAtIso = paidAt.toISOString();
  const { data: updated, error: updateError } = await adminDb()
    .from('payments')
    .update({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: paidAtIso,
    })
    .eq('id', payment.id)
    .neq('status', 'paid')
    .select('id')
    .limit(1);

  if (updateError) throw new Error('Payment status could not be updated.');
  if (!updated?.length) return 'already_paid';

  const { data: entitlement, error: entitlementReadError } = await adminDb()
    .from('entitlements')
    .select('pro_until')
    .eq('user_id', payment.user_id)
    .maybeSingle();
  if (entitlementReadError) throw new Error('Entitlement lookup failed.');

  const proUntil = calculateExtendedProUntil(
    (entitlement?.pro_until as string | null | undefined) ?? null,
    payment.plan,
    paidAt,
  );

  const { error: entitlementWriteError } = await adminDb().from('entitlements').upsert(
    {
      user_id: payment.user_id,
      plan: 'pro',
      pro_until: proUntil,
      updated_at: paidAtIso,
    },
    { onConflict: 'user_id' },
  );
  if (entitlementWriteError) throw new Error('Entitlement update failed.');
  return 'paid';
}

export async function markPaymentFailed(
  orderId: string,
  paymentId?: string | null,
): Promise<'failed' | 'already_final' | 'not_found'> {
  const payment = await loadPaymentByOrder(orderId);
  if (!payment) return 'not_found';
  if (payment.status === 'paid' || payment.status === 'failed') return 'already_final';

  const { error } = await adminDb()
    .from('payments')
    .update({
      status: 'failed',
      razorpay_payment_id: payment.razorpay_payment_id ?? paymentId ?? null,
    })
    .eq('id', payment.id)
    .eq('status', 'created');
  if (error) throw new Error('Payment failure could not be recorded.');
  return 'failed';
}
