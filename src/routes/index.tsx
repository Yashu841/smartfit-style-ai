import { createFileRoute } from "@tanstack/react-router";
import { SmartFit } from "@/components/SmartFit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartFit AI — Find Your Perfect Fit | Myntra" },
      {
        name: "description",
        content:
          "SmartFit AI by Myntra analyzes your body, fit preference and brand sizing to recommend your ideal size with a virtual try-on in seconds.",
      },
      { property: "og:title", content: "SmartFit AI — Find Your Perfect Fit | Myntra" },
      {
        property: "og:description",
        content: "AI-powered sizing & virtual try-on for premium fashion shopping.",
      },
    ],
  }),
  component: SmartFit,
});
