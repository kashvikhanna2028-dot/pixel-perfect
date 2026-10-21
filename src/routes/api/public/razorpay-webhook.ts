import { createFileRoute } from '@tanstack/react-router';
import { markPaymentFailed, markPaymentPaidAndExtend } from '@/lib/payments.server';
import { verifyWebhookSignature } from '@/lib/payments';

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
};

export const Route = createFileRoute('/api/public/razorpay-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env['RAZORPAY_WEBHOOK_SECRET'];
        const signature = request.headers.get('x-razorpay-signature');
        const rawBody = await request.text();

        if (
          !verifyWebhookSignature({
            body: rawBody,
            signature,
            webhookSecret,
          })
        ) {
          return new Response('Unauthorized', { status: 401 });
        }

        let body: RazorpayWebhookPayload;
        try {
          body = JSON.parse(rawBody) as RazorpayWebhookPayload;
        } catch {
          return new Response('Invalid payload', { status: 400 });
        }

        const payment = body.payload?.payment?.entity;
        const orderId = payment?.order_id;
        const paymentId = payment?.id;
        if (!orderId || !paymentId) return new Response('Bad Request', { status: 400 });

        if (body.event === 'payment.captured') {
          await markPaymentPaidAndExtend(orderId, paymentId);
        } else if (body.event === 'payment.failed') {
          await markPaymentFailed(orderId, paymentId);
        }

        return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
      },
      GET: () => new Response('Unauthorized', { status: 401 }),
    },
  },
});
