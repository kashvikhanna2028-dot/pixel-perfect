import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PRO_PLANS, nextProUntil, type ProPlanId } from "./pro-plans";

// Extends Pro access idempotently. Only the service role may write entitlements.
async function grantPro(userId: string, planId: ProPlanId): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: current, error: readError } = await supabaseAdmin
    .from("entitlements")
    .select("pro_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error("Pro status could not be read.");
  const proUntil = nextProUntil(current?.pro_until, planId, new Date());
  const { error: writeError } = await supabaseAdmin
    .from("entitlements")
    .upsert({ user_id: userId, pro_until: proUntil, updated_at: new Date().toISOString() });
  if (writeError) throw new Error("Pro access could not be saved.");
  return proUntil;
}

export const getProStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("entitlements")
      .select("pro_until")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Pro status could not be loaded. Please retry.");
    const proUntil = data?.pro_until ?? null;
    return {
      proUntil,
      proActive: Boolean(proUntil && new Date(proUntil) > new Date()),
      paymentsConfigured: Boolean(
        process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"],
      ),
      plans: Object.values(PRO_PLANS).map((plan) => ({
        id: plan.id,
        name: plan.name,
        intervalLabel: plan.intervalLabel,
        amountPaise: plan.amountPaise,
        currency: plan.currency,
      })),
    };
  });

export const createProOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: z.enum(["pro_monthly", "pro_yearly"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { readRazorpayConfig, razorpayConnected, createRazorpayOrder } =
      await import("./razorpay.server");
    const config = readRazorpayConfig();
    if (!razorpayConnected(config))
      throw new Error("Payments are not connected yet. Please try again later.");
    const plan = PRO_PLANS[data.plan];
    // Server-side pricing: the client only chooses a plan, never an amount.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        plan: plan.id,
        amount_paise: plan.amountPaise,
        currency: plan.currency,
        status: "created",
      })
      .select("id")
      .single();
    if (insertError || !payment)
      throw new Error("The payment could not be prepared. Please retry.");
    try {
      const order = await createRazorpayOrder(config, {
        amountPaise: plan.amountPaise,
        currency: plan.currency,
        receipt: payment.id,
        notes: { plan: plan.id },
      });
      const { error: linkError } = await supabaseAdmin
        .from("payments")
        .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (linkError) throw new Error("link");
      // The publishable key id is safe for the browser; the secret never leaves the server.
      return {
        orderId: order.id,
        keyId: config.keyId!,
        amountPaise: plan.amountPaise,
        currency: plan.currency,
        planName: plan.name,
      };
    } catch {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      throw new Error("The payment order could not be created. Please retry.");
    }
  });

export const verifyProPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().min(1).max(80),
        paymentId: z.string().min(1).max(80),
        signature: z.string().regex(/^[0-9a-f]{64}$/i),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const {
      readRazorpayConfig,
      razorpayConnected,
      checkoutSignatureMatches,
      fetchRazorpayPayment,
    } = await import("./razorpay.server");
    const config = readRazorpayConfig();
    if (!razorpayConnected(config))
      throw new Error("Payments are not connected yet. Please try again later.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ownership check: the order must belong to the signed-in account.
    const { data: payment, error: loadError } = await supabaseAdmin
      .from("payments")
      .select("id,user_id,plan,amount_paise,currency,status")
      .eq("razorpay_order_id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (loadError) throw new Error("The payment could not be loaded. Please retry.");
    if (!payment) throw new Error("This payment does not belong to your account.");
    if (
      !checkoutSignatureMatches(config.keySecret!, data.orderId, data.paymentId, data.signature)
    ) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      throw new Error("The payment signature could not be verified.");
    }
    if (payment.status !== "captured") {
      // Confirm with Razorpay before granting access: a valid signature alone is not proof of capture.
      const remote = await fetchRazorpayPayment(config, data.paymentId);
      if (
        remote.order_id !== data.orderId ||
        remote.amount !== payment.amount_paise ||
        !["captured", "authorized"].includes(remote.status)
      ) {
        throw new Error("The payment has not completed yet.");
      }
      const { error: markError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "captured",
          razorpay_payment_id: data.paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "captured");
      if (markError) throw new Error("The payment could not be recorded. Please retry.");
    }
    const proUntil = await grantPro(context.userId, payment.plan as ProPlanId);
    return { proUntil };
  });
