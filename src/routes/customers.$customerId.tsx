import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";

export const Route = createFileRoute("/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer profile — Avighna One" },
      {
        name: "description",
        content: "Customer profile, orders, credit, and visit history in Avighna One.",
      },
      { property: "og:title", content: "Customer profile — Avighna One" },
      {
        property: "og:description",
        content: "Full customer dossier across your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: function CustomerDetailPage() {
    const { customerId } = Route.useParams();
    return <ModuleWorkspace module="customers" customerId={customerId} />;
  },
});