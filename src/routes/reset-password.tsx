import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/auth-recovery";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Expiry Radar" },
      { name: "description", content: "Set a new password for your Expiry Radar account." },
      { property: "og:title", content: "Choose a new password — Expiry Radar" },
      { property: "og:description", content: "Set a new password for your Expiry Radar account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});
