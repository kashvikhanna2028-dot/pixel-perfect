import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/expiry-radar-app";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Expiry Radar — Use it before you lose it" },
    { name: "description", content: "Keep track of the credits, passes, trials, and perks that reset or expire." },
    { property: "og:title", content: "Expiry Radar — Use it before you lose it" },
    { property: "og:description", content: "Keep track of the credits, passes, trials, and perks that reset or expire." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LandingPage,
});