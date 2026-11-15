import { describe, expect, it } from "vitest";
import {
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
});
