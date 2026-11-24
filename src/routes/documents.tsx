import { createFileRoute } from "@tanstack/react-router";
import { DocumentsWorkspace } from "@/components/documents-workspace";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Avighna One" },
      {
        name: "description",
        content: "Role-scoped document vault for COA, Purchase Orders, Purchase Invoices, and Sales Invoices.",
      },
    ],
  }),
  component: DocumentsWorkspace,
});
