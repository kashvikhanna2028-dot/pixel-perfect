import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInr, type ProPlanId } from "@/lib/pro-plans";
import { createProOrder, getProStatus, verifyProPayment } from "@/lib/razorpay.functions";

type ProStatus = Awaited<ReturnType<typeof getProStatus>>;

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let checkoutLoader: Promise<void> | null = null;

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout needs a browser."));
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutLoader) {
    checkoutLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        checkoutLoader = null;
        script.remove();
        reject(new Error("The payment window could not be loaded."));
      };
      document.body.appendChild(script);
    });
  }
  return checkoutLoader;
}

export function ProUpgradeCard() {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [busy, setBusy] = useState<ProPlanId | null>(null);

  useEffect(() => {
    let alive = true;
    getProStatus()
      .then((result) => {
        if (alive) setStatus(result);
      })
      .catch(() => {
        if (alive) setStatus(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function startCheckout(plan: ProPlanId) {
    if (busy) return;
    setBusy(plan);
    try {
      const order = await createProOrder({ data: { plan } });
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("The payment window could not be loaded.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Expiry Radar",
        description: `${order.planName} subscription`,
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const verified = await verifyProPayment({
              data: {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
            });
            setStatus((current) =>
              current ? { ...current, proUntil: verified.proUntil, proActive: true } : current,
            );
            toast.success("You’re Pro now. Enjoy the radar.");
          } catch {
            toast.error(
              "Your payment couldn’t be confirmed yet. If money was deducted, it will reflect shortly.",
            );
          }
        },
      });
      checkout.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("not connected")
          ? "Payments aren’t connected yet. Please try again later."
          : "The payment couldn’t be started. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!status) return null;

  if (status.proActive && status.proUntil) {
    return (
      <div className="mt-5 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BadgeCheck className="size-5 text-primary" /> Expiry Radar Pro
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Your Pro plan is active until{" "}
          {new Date(status.proUntil).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Renew any time to extend it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {status.plans.map((plan) => (
            <Button
              key={plan.id}
              variant="outline"
              disabled={!status.paymentsConfigured || busy !== null}
              onClick={() => void startCheckout(plan.id as ProPlanId)}
            >
              {busy === plan.id
                ? "Opening payment…"
                : `Extend · ${formatInr(plan.amountPaise)}/${plan.intervalLabel}`}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Crown className="size-5 text-primary" /> Upgrade to Expiry Radar Pro
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        Pay securely with Razorpay - UPI, cards, netbanking, and wallets. Choose a plan to start
        your Pro access right away.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {status.plans.map((plan) => (
          <div key={plan.id} className="rounded-md border border-border bg-background p-4">
            <p className="text-sm font-medium">{plan.name}</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatInr(plan.amountPaise)}
              <span className="text-sm font-normal text-muted-foreground">
                /{plan.intervalLabel}
              </span>
            </p>
            <Button
              className="mt-3 w-full"
              disabled={!status.paymentsConfigured || busy !== null}
              onClick={() => void startCheckout(plan.id as ProPlanId)}
            >
              {busy === plan.id
                ? "Opening payment…"
                : `Pay ${formatInr(plan.amountPaise)} with Razorpay`}
            </Button>
          </div>
        ))}
      </div>
      {!status.paymentsConfigured && (
        <p className="mt-3 text-xs text-muted-foreground">
          Payments aren’t connected on this deployment yet. Once the site owner adds the Razorpay
          keys, these buttons will start checkout.
        </p>
      )}
    </div>
  );
}
