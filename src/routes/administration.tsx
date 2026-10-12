import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";
export const Route = createFileRoute("/administration")({
  head: () => ({
    meta: [
      { title: "Administration — Avighna One" },
      {
        name: "description",
        content: "Manage administration across your four company workspaces with Avighna One.",
      },
      { property: "og:title", content: "Administration — Avighna One" },
      {
        property: "og:description",
        content: "A connected view of administration across your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="administration" />,
});
