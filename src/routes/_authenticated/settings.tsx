import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings — Expiry Radar" },
    { name: "description", content: "Manage your profile, time zone, and tracker data." },
    { property: "og:title", content: "Settings — Expiry Radar" },
    { property: "og:description", content: "Manage your profile, time zone, and tracker data." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SettingsPage,
});