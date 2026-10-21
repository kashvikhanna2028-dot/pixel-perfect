import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/auth-recovery";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Expiry Radar" },
      { name: "description", content: "Request a password reset link for your Expiry Radar account." },
      { property: "og:title", content: "Reset your password — Expiry Radar" },
      { property: "og:description", content: "Request a password reset link for your Expiry Radar account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});
