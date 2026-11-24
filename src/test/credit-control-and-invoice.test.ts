import { describe, expect, it } from "vitest";
import { navigation } from "@/components/workspace-shell";
import {
  fetchCreditNotes,
  createCreditNote,
  deleteCreditNote,
  updateCustomerCreditLimit,
  fetchInvoices,
  fetchCustomers,
  invoiceDueDate,
  creditFromNotes,
  computeDealCost,
  salesPriceAndQtyFromOrder,
} from "@/lib/erp-service";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

describe("Credit Control & Invoicing Suite", () => {
  it("sets an invoice due date from the customer's credit days", () => {
    const from = new Date("2026-10-07T12:00:00.000Z");
    expect(invoiceDueDate(15, from)).toBe("2026-10-22");
    expect(invoiceDueDate(30, from)).toBe("2026-11-06");
    expect(invoiceDueDate(45, from)).toBe("2026-11-21");
    expect(invoiceDueDate(0, from)).toBe("2026-11-06");
    expect(creditFromNotes("GSTIN: 29ABC · Credit: 45 days").credit_days).toBe(45);
  });

  it("restricts Credit Control in sidebar navigation strictly to Super Admin", () => {
    const financeSection = navigation.find((s) => s.section === "Finance & control");
    expect(financeSection).toBeDefined();

    type NavItem = { name: string; url: string; superAdminOnly?: boolean };
    const creditItem = financeSection?.items.find((i) => i.url === "/credit") as
      | NavItem
      | undefined;
    expect(creditItem).toBeDefined();
    expect(creditItem?.name).toBe("Credit control");
    expect(creditItem?.superAdminOnly).toBe(true);

    // Filter simulating non-super-admin (e.g. accounts, supervisor, sales, logistics)
    const nonAdminItems = (financeSection?.items as NavItem[] | undefined)?.filter(
      (item) => !item.superAdminOnly,
    );
    expect(nonAdminItems?.some((i) => i.url === "/credit")).toBe(false);

    // Filter simulating super admin
    const superAdminItems = (financeSection?.items as NavItem[] | undefined)?.filter(
      (item) => !item.superAdminOnly || true,
    );
    expect(superAdminItems?.some((i) => i.url === "/credit")).toBe(true);
  });

  it("registers /credit route in TanStack router tree without falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/credit");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.some((m) => m.routeId === "/credit")).toBe(true);
  });

  it("allows updating customer credit limit and credit days", async () => {
    const customers = await fetchCustomers("all");
    if (customers.length === 0) return; // live DB empty / RLS blocks anon — skip
    const targetCust = customers[0];
    expect(targetCust).toBeDefined();
    if (!targetCust) return;

    const updated = await updateCustomerCreditLimit(
      targetCust.id || "cust-test-1",
      750000,
      45,
      "Super Admin (Owner)",
    );

    expect(updated.credit_limit).toBe(750000);
    expect(updated.credit_days).toBe(45);
  });

  it("creates, fetches, and deletes credit notes", async () => {
    const note = await createCreditNote({
      companyId: "asian",
      customerName: "Metro B2B Wholesalers",
      invoiceId: "INV-1001",
      type: "Credit note",
      reason: "Returned goods",
      amount: 12500,
      userName: "Owner (Super Admin)",
    });

    expect(note).toBeDefined();
    expect(note.amount).toBe(12500);
    expect(note.type).toBe("Credit note");
    expect(note.reason).toBe("Returned goods");
    expect(note.status).toBe("Posted");

    const notes = await fetchCreditNotes("asian");
    expect(notes.some((n) => n.id === note.id)).toBe(true);

    const delRes = await deleteCreditNote(note.id, "Owner (Super Admin)");
    expect(delRes.success).toBe(true);

    const notesAfter = await fetchCreditNotes("asian");
    expect(notesAfter.some((n) => n.id === note.id)).toBe(false);
  });

  it("prorates deal goods cost to sold qty and computes margin", () => {
    // 25,000 kg inbound @ ₹40; sell 5,000 kg @ ₹55; owner charges on both sides.
    const result = computeDealCost({
      purchaseUnitPrice: 40,
      salesUnitPrice: 55,
      salesQuantity: 5000,
      buyTransport: 2000,
      buyLabor: 1500,
      buyMisc: 500,
      sellHandling: 800,
      sellMisc: 200,
      sellTransport: 1000,
    });
    expect(result.buyGoods).toBe(40 * 5000); // not 40 * 25000
    expect(result.sellGoods).toBe(55 * 5000);
    expect(result.buyTotal).toBe(200000 + 2000 + 1500 + 500);
    expect(result.sellTotal).toBe(275000 + 800 + 200 + 1000);
    expect(result.margin).toBe(result.sellTotal - result.buyTotal);
  });

  it("derives sales unit price and qty from an order items summary", () => {
    const prefill = salesPriceAndQtyFromOrder({
      subtotal: 275000,
      total_amount: 280000,
      items_summary: "Malto Dextrin Powder · 5000 kg · PO Ref: GI/PO/55/26-27",
    });
    expect(prefill.quantity).toBe(5000);
    expect(prefill.unitPrice).toBe(55);
  });

  it("verifies invoice records have remaining balance and due date for credit computation", async () => {
    const invoices = await fetchInvoices("all");
    if (invoices.length === 0) return; // live DB empty / RLS blocks anon — skip
    const inv = invoices[0];
    expect(inv).toBeDefined();
    if (!inv) return;
    expect(inv.amount).toBeGreaterThan(0);
    expect(typeof inv.remaining_amount).toBe("number");
    expect(inv.due_date).toBeDefined();
  });
});
