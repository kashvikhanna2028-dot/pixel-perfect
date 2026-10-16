import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Radar — Expiry Radar" },
      { name: "description", content: "See what resets soon and make the most of your trackers." },
      { property: "og:title", content: "My Radar — Expiry Radar" },
      {
        property: "og:description",
        content: "See what resets soon and make the most of your trackers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});
