import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createRazorpayOrder, markPaymentPaidAndExtend } from '@/lib/payments.server';
import { verifyPaymentSignature } from '@/lib/payments';

const planSchema = z.enum(['pro_monthly', 'pro_yearly']);

export const createOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ plan: planSchema }).parse(input))
  .handler(async ({ context, data }) => {
    const created = await createRazorpayOrder(context.userId, data.plan);
    return { order_id: created.orderId, key_id: created.keyId };
  });

export const verifyPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        order_id: z.string().min(1).max(120),
        payment_id: z.string().min(1).max(120),
        signature: z.string().min(1).max(256),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const keySecret = process.env['RAZORPAY_KEY_SECRET'];
    const valid = verifyPaymentSignature({
      orderId: data.order_id,
      paymentId: data.payment_id,
      signature: data.signature,
      keySecret,
    });
    if (!valid) throw new Error('Invalid payment signature.');

    const result = await markPaymentPaidAndExtend(
      data.order_id,
      data.payment_id,
      new Date(),
      context.userId,
    );
    if (result === 'not_found') throw new Error('Payment order not found.');

    return { ok: true };
  });
