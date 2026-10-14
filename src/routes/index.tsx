import { createFileRoute } from "@tanstack/react-router";
import { SmartFit } from "@/components/SmartFit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartFit AI — Personalized Styling Prototype | Myntra" },
      {
        name: "description",
        content:
          "Explore personalized size recommendations, interactive fit visualization, and feedback capture in the SmartFit AI portfolio prototype.",
      },
      { property: "og:title", content: "SmartFit AI — Personalized Styling Prototype | Myntra" },
      {
        property: "og:description",
        content: "A portfolio prototype for personalized size recommendations and interactive fit visualization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmartFit,
});
