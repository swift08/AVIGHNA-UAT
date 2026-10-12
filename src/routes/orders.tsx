import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";
export const Route = createFileRoute("/orders")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    customer?: string | undefined;
    company?: string | undefined;
    notes?: string | undefined;
    openCreate?: string | undefined;
  } => ({
    customer: typeof search["customer"] === "string" ? (search["customer"] as string) : undefined,
    company: typeof search["company"] === "string" ? (search["company"] as string) : undefined,
    notes: typeof search["notes"] === "string" ? (search["notes"] as string) : undefined,
    openCreate:
      search["openCreate"] === "true" || search["openCreate"] === true ? "true" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Orders — Avighna One" },
      {
        name: "description",
        content: "Manage orders across your four company workspaces with Avighna One.",
      },
      { property: "og:title", content: "Orders — Avighna One" },
      {
        property: "og:description",
        content: "A connected view of orders across your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="orders" />,
});
