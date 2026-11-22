import { describe, expect, it } from "vitest";
import {
  buildPurchaseOrderHtml,
  suggestPurchaseOrderNumber,
} from "@/lib/purchase-order-doc";
import { indianFiscalYear } from "@/lib/sales-invoice";

describe("purchase order document", () => {
  it("uses the Tally purchase order format from Purchase Order_55", () => {
    const fy = indianFiscalYear(new Date("2026-11-17T00:00:00"));
    expect(suggestPurchaseOrderNumber("ganesh", "55")).toBe(`GI/PO/55/${fy}`);

    const html = buildPurchaseOrderHtml({
      id: "GI/PO/55/26-27",
      company_id: "ganesh",
      supplier_name: "Gujarat Ambuja Exports Ltd",
      product_name: "Malto Dextrin Powder",
      quantity: 25000,
      unit: "Kg",
      unit_price: 57,
      total_amount: 1425000,
      status: "Requested",
      notes: JSON.stringify({ remark: "GST Extra" }),
      created_at: "2026-11-17T00:00:00.000Z",
    });

    expect(html).toContain("Purchase Order");
    expect(html).toContain("Invoice To");
    expect(html).toContain("Supplier (Bill from)");
    expect(html).toContain("Gujarat Ambuja Exports Ltd");
    expect(html).toContain("Malto Dextrin Powder");
    expect(html).toContain("Authorised Signatory");
  });
});
