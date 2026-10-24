// Server-only Razorpay helpers. Never import this module from client code:
// it handles the key secret and webhook secret. Load inside server handlers with
// await import('@/lib/razorpay.server') or from other *.server.ts modules.
import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayConfig = {
  keyId: string | undefined;
  keySecret: string | undefined;
  webhookSecret: string | undefined;
};

export const readRazorpayConfig = (): RazorpayConfig => ({
  keyId: process.env["RAZORPAY_KEY_ID"],
  keySecret: process.env["RAZORPAY_KEY_SECRET"],
  webhookSecret: process.env["RAZORPAY_WEBHOOK_SECRET"],
});

export const razorpayConnected = (config: RazorpayConfig) =>
  Boolean(config.keyId && config.keySecret);

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function signaturesMatch(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex) || !/^[0-9a-f]{64}$/i.test(receivedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
}

// Checkout handler signature: HMAC_SHA256(key_secret, "<order_id>|<payment_id>").
export function checkoutSignatureMatches(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  return signaturesMatch(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

export async function createRazorpayOrder(
  config: RazorpayConfig,
  order: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  if (!razorpayConnected(config)) throw new Error("Razorpay is not connected.");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: order.amountPaise,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    }),
  });
  if (!response.ok) {
    // Do not log credentials or response bodies; the status is enough to diagnose.
    console.error("Razorpay order creation failed", response.status);
    throw new Error("The payment order could not be created.");
  }
  return (await response.json()) as RazorpayOrder;
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function fetchRazorpayPayment(
  config: RazorpayConfig,
  paymentId: string,
): Promise<RazorpayPayment> {
  if (!razorpayConnected(config)) throw new Error("Razorpay is not connected.");
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      },
    },
  );
  if (!response.ok) {
    console.error("Razorpay payment lookup failed", response.status);
    throw new Error("The payment could not be confirmed.");
  }
  return (await response.json()) as RazorpayPayment;
}
