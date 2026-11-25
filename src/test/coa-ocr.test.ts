import { describe, expect, it } from "vitest";
import {
  extractInvoiceAmountFromText,
  extractPurchaseInvoiceRefs,
  fieldStatus,
  heuristicExtractFromText,
  normalizeDateValue,
  resolvedReceiveQuantity,
} from "@/lib/coa-ocr";

describe("COA OCR helpers", () => {
  it("normalizes dmy dates", () => {
    expect(normalizeDateValue("08-06-2026")).toBe("2026-06-08");
    expect(normalizeDateValue("2026-08-23")).toBe("2026-08-23");
    expect(normalizeDateValue("not-a-date")).toBeNull();
  });

  it("parses dextrose-style text heuristics", () => {
    const text = `
      Product Name: Dextrose Anhydrous – IP Grade
      Batch No: DAH/30
      Mfg Date: 08-06-2026
      Expiry Date: 07-06-2031
      Dispatch Quantity: 6 MT
      Manufacturer: Sample Labs
    `;
    const extracted = heuristicExtractFromText(text);
    expect(extracted.productName.value).toMatch(/Dextrose/i);
    expect(extracted.batchNumber.value).toBe("DAH/30");
    expect(extracted.dispatchQuantity.value).toBe("6");
    const qty = resolvedReceiveQuantity(extracted);
    expect(qty.quantity).toBe(6);
  });

  it("computes bags x weight totals", () => {
    const extracted = heuristicExtractFromText(
      "Product Name: Sunmalt (Maltodextrin)\nBatch No: MD/232\n216 Bags x 25 KG",
    );
    expect(extracted.packageCount.value).toBe("216");
    expect(extracted.packageWeight.value).toBe("25");
    const qty = resolvedReceiveQuantity(extracted);
    expect(qty.quantity).toBe(5400);
    expect(qty.unit.toLowerCase()).toBe("kg");
  });

  it("marks missing and low-confidence fields", () => {
    expect(fieldStatus({ value: null, confidence: 0 })).toBe("missing");
    expect(fieldStatus({ value: "ok", confidence: 0.4 })).toBe("low");
    expect(fieldStatus({ value: "bad-date", confidence: 0.9 }, "date")).toBe("invalid");
  });

  it("extracts purchase invoice grand total amount", () => {
    const amt = extractInvoiceAmountFromText(
      "Supplier Tax Invoice\nQty: 10 MT\nGrand Total ₹1,25,450.00\nAmount in words",
    );
    expect(amt.value).toBe("125450");
    const extracted = heuristicExtractFromText(
      "Purchase Invoice\nQuantity: 10 MT\nInvoice Total: Rs. 98400.50",
    );
    expect(extracted.dispatchQuantity.value).toBe("10");
    expect(extracted.invoiceAmount.value).toBe("98400.5");
  });

  it("splits Tally Invoice No. and e-Way Bill No. when glued", () => {
    const text = `
Invoice No. e-Way Bill No.
MH0026113992232330552894
Supplier Invoice No. & Date.
MH0026113992
  dt. 16-Nov-26
`;
    const refs = extractPurchaseInvoiceRefs(text);
    expect(refs.invoiceNumber.value).toBe("MH0026113992");
    expect(refs.ewayBillNumber.value).toBe("232330552894");
    expect(refs.invoiceDate.value).toBe("2026-11-16");

    const spaced = extractPurchaseInvoiceRefs(`
Invoice No. e-Way Bill No.
1400328620 172622670696
Supplier Invoice No. & Date.
1400328620  dt.
24-Nov-26
`);
    expect(spaced.invoiceNumber.value).toBe("1400328620");
    expect(spaced.ewayBillNumber.value).toBe("172622670696");

    const noEway = extractPurchaseInvoiceRefs(`
Invoice No.
CVFL/26-27/1377
Supplier Invoice No. & Date.
CVFL/26-27/1377  dt.
30-Oct-26
`);
    expect(noEway.invoiceNumber.value).toBe("CVFL/26-27/1377");
    expect(noEway.ewayBillNumber.value).toBeNull();
  });
});
