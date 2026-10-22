import { createFileRoute } from "@tanstack/react-router";
import { nextProUntil, type ProPlanId } from "@/lib/pro-plans";

// Razorpay webhook: confirms captures and failures server-to-server.
// Configure the endpoint secret in the Razorpay dashboard and store it as
// RAZORPAY_WEBHOOK_SECRET. Signature is verified over the exact raw body.
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!webhookSecret) return new Response("Webhook not configured", { status: 503 });
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const rawBody = await request.text();
        const { hmacSha256Hex, signaturesMatch } = await import("@/lib/razorpay.server");
        if (!signature || !signaturesMatch(hmacSha256Hex(webhookSecret, rawBody), signature)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let event: {
          event?: string;
          payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const kind = event?.event;
        const entity = event?.payload?.payment?.entity;
        if ((kind === "payment.captured" || kind === "payment.failed") && entity?.order_id) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: payment, error } = await supabaseAdmin
              .from("payments")
              .select("id,user_id,plan,status")
              .eq("razorpay_order_id", entity.order_id)
              .maybeSingle();
            if (error) throw new Error("load");
            if (payment && payment.status !== "captured") {
              const status = kind === "payment.captured" ? "captured" : "failed";
              const { error: updateError } = await supabaseAdmin
                .from("payments")
                .update({
                  status,
                  razorpay_payment_id: entity.id ?? null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", payment.id)
                .neq("status", "captured");
              if (updateError) throw new Error("update");
              if (status === "captured") {
                const { data: current } = await supabaseAdmin
                  .from("entitlements")
                  .select("pro_until")
                  .eq("user_id", payment.user_id)
                  .maybeSingle();
                const proUntil = nextProUntil(
                  current?.pro_until,
                  payment.plan as ProPlanId,
                  new Date(),
                );
                const { error: grantError } = await supabaseAdmin.from("entitlements").upsert({
                  user_id: payment.user_id,
                  pro_until: proUntil,
                  updated_at: new Date().toISOString(),
                });
                if (grantError) throw new Error("grant");
              }
            }
          } catch {
            console.error("Razorpay webhook handling failed.");
            return Response.json(
              { received: false },
              { status: 503, headers: { "Cache-Control": "no-store" } },
            );
          }
        }
        return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
      },
      GET: () => new Response("Unauthorized", { status: 401 }),
    },
  },
});
