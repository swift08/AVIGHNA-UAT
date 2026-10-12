import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";

export const Route = createFileRoute("/credit")({
  head: () => ({
    meta: [
      { title: "Credit Control — Avighna One" },
      {
        name: "description",
        content: "Credit control, limits, days, and credit/debit notes for Super Admin.",
      },
      { property: "og:title", content: "Credit Control — Avighna One" },
      {
        property: "og:description",
        content: "Credit limits and notes management in Avighna One.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="credit" />,
});
