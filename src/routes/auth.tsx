import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Expiry Radar" },
      {
        name: "description",
        content: "Create an account or sign in to manage your Expiry Radar trackers.",
      },
      { property: "og:title", content: "Sign in — Expiry Radar" },
      {
        property: "og:description",
        content: "Create an account or sign in to manage your Expiry Radar trackers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});
