import { createFileRoute } from "@tanstack/react-router";
import { TrackerEditorPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/_authenticated/tracker-edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit Tracker — Expiry Radar" },
      {
        name: "description",
        content: "Update an allowance, pass, credit, or trial on your radar.",
      },
      { property: "og:title", content: "Edit Tracker — Expiry Radar" },
      {
        property: "og:description",
        content: "Update an allowance, pass, credit, or trial on your radar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => {
    const { id } = Route.useParams();
    return <TrackerEditorPage trackerId={id} />;
  },
});
