import { describe, expect, it } from "vitest";
import {
  amountInWords,
  buildSalesInvoiceHtml,
  indianFiscalYear,
  suggestSalesInvoiceNumber,
} from "@/lib/sales-invoice";

describe("sales invoice numbering", () => {
  it("builds accounts sales invoice numbers like GI/S235/26-27", () => {
    const fy = indianFiscalYear(new Date("2026-11-03T00:00:00"));
    expect(fy).toBe("26-27");
    expect(suggestSalesInvoiceNumber("ganesh", "ORD-235")).toBe(`GI/S235/${fy}`);
    expect(suggestSalesInvoiceNumber("asian", "ORD-12")).toBe(`AA/S012/${fy}`);
  });
});

describe("sales invoice format", () => {
  it("uses the Tally tax invoice layout from the Ganesh sample", () => {
    expect(amountInWords(125213)).toContain("One Lakh Twenty Five Thousand Two Hundred Thirteen");
    const html = buildSalesInvoiceHtml({
      invoice: {
        id: "GI/S235/26-27",
        company_id: "ganesh",
        order_id: "ORD-235",
        customer_name: "PAGARIYA FOOD PRODUCTS (P) LTD.",
        amount: 125213,
        paid_amount: 0,
        remaining_amount: 125213,
        due_date: "2026-12-03",
        status: "Generated",
        created_at: "2026-11-03T00:00:00.000Z",
      },
      order: {
        id: "ORD-235",
        company_id: "ganesh",
        customer_name: "PAGARIYA FOOD PRODUCTS (P) LTD.",
        status: "Ready to dispatch",
        subtotal: 119250,
        discount: 0,
        tax: 5962.5,
        total_amount: 125213,
        items_summary: "Maize Starch Powder (Food Grade) · 3000 kg",
        delivery_address: "Harohalli Taluk, Bangalore",
        destination_city: "Harohalli Taluk, Bangalore",
        shortage_approved: false,
        created_at: "2026-11-03T00:00:00.000Z",
      },
      delivery: {
        company_id: "ganesh",
        order_id: "ORD-235",
        vehicle_number: "KA05AL4990",
        driver_name: "Mahesh Patel",
        status: "Out for delivery",
      },
    });
    expect(html).toContain("Tax Invoice");
    expect(html).toContain("Buyer (Bill to)");
    expect(html).toContain("OUTPUT CGST @ 2.5%");
    expect(html).toContain("Output SGST @ 2.5%");
    expect(html).toContain("Motor Vehicle No.");
    expect(html).toContain("KA05AL4990");
    expect(html).toContain("Authorised Signatory");
    expect(html).toContain("This is a Computer Generated Invoice");
  });
});

