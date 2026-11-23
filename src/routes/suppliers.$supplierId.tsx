import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";

export const Route = createFileRoute("/suppliers/$supplierId")({
  head: () => ({
    meta: [
      { title: "Supplier profile — Avighna One" },
      {
        name: "description",
        content: "Supplier profile, payment terms, and purchase history in Avighna One.",
      },
      { property: "og:title", content: "Supplier profile — Avighna One" },
      {
        property: "og:description",
        content: "Full supplier dossier for accounts and procurement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: function SupplierDetailPage() {
    const { supplierId } = Route.useParams();
    return <ModuleWorkspace module="suppliers" supplierId={supplierId} />;
  },
});
