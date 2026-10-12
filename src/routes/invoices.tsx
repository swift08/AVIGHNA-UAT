import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — Avighna One" },
      {
        name: "description",
        content: "Manage and issue invoices, dispatch inbox, and ready to invoice orders.",
      },
      { property: "og:title", content: "Invoices — Avighna One" },
      {
        property: "og:description",
        content: "Ready to invoice, dispatch inbox, and issued commercial invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="accounts" />,
});
