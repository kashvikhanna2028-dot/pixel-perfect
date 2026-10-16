import { createFileRoute } from "@tanstack/react-router";
import { TrackerEditorPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/_authenticated/tracker-new")({
  head: () => ({
    meta: [
      { title: "Add Tracker — Expiry Radar" },
      { name: "description", content: "Add an allowance, pass, credit, or trial to your radar." },
      { property: "og:title", content: "Add Tracker — Expiry Radar" },
      {
        property: "og:description",
        content: "Add an allowance, pass, credit, or trial to your radar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <TrackerEditorPage />,
});
