import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";
export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Avighna One" },
      {
        name: "description",
        content: "Manage customers across your four company workspaces with Avighna One.",
      },
      { property: "og:title", content: "Customers — Avighna One" },
      {
        property: "og:description",
        content: "A connected view of customers across your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="customers" />,
});
