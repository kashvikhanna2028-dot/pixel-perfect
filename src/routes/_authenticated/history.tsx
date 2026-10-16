import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [
    { title: "Usage History — Expiry Radar" },
    { name: "description", content: "Review the allowances and credits you have used." },
    { property: "og:title", content: "Usage History — Expiry Radar" },
    { property: "og:description", content: "Review the allowances and credits you have used." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HistoryPage,
});