import { createFileRoute } from "@tanstack/react-router";
import { ModuleWorkspace } from "@/components/module-workspace";
export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "My work — Avighna One" },
      {
        name: "description",
        content: "Manage my work across your four company workspaces with Avighna One.",
      },
      { property: "og:title", content: "My work — Avighna One" },
      {
        property: "og:description",
        content: "A connected view of my work across your organization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ModuleWorkspace module="tasks" />,
});
