import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — Avighna One" },
      {
        name: "description",
        content: "Manage supplier profiles for purchase orders across your company workspaces.",
      },
      { property: "og:title", content: "Suppliers — Avighna One" },
      {
        property: "og:description",
        content: "Accounts-owned supplier master for procurement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Outlet />,
});
