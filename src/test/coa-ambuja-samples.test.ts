import { describe, expect, it } from "vitest";
import {
  finalizeCoaExtraction,
  heuristicExtractFromText,
  mergeCoaExtractions,
  normalizeDateValue,
  resolvedReceiveQuantity,
} from "@/lib/coa-ocr";

const SUNMALT_OCR = `
GUJARAT AMBUJA EXPORTS LIMITED
CERTIFICATE OF ANALYSIS
Product Name : SUNMALT (MALTODEXTRIN)
Batch Number MD/232
Quantity 216 Bags X 25 Kg
Date of Manufacturing 23.08.2026
Date of Expiry 22.08.2028
Date of Analysis 25.08.2026
Total Quantity 5.400 MT
Dispatched date 26.08.2026
Remarks: The above product, Maltodextrin complies with the specification.
`;

const DEXTROSE_OCR = `
GUJARAT AMBUJA EXPORTS LIMITED
CERTIFICATE OF ANALYSIS
Product Name: DEXTROSE ANHYDROUS – IP GRADE
Batch No DAH/30
Manufacturing Date: 08.06.2026
Expiry Date: 07.06.2031
Analysis Date: 13.06.2026
Dispatch Qty: 6.000 MT
Batch Size: 50.000 MT
PARTY NAME: SRI SAI KRUPA ENTERPRISES.
`;

describe("Ambuja photographed COA samples", () => {
  it("extracts Sunmalt batch and bag quantity", () => {
    const e = heuristicExtractFromText(SUNMALT_OCR);
    expect(e.productName.value).toMatch(/Sunmalt/i);
    expect(e.batchNumber.value).toBe("MD/232");
    expect(e.manufacturerName.value).toMatch(/Ambuja/i);
    expect(e.packageCount.value).toBe("216");
    expect(e.packageWeight.value).toBe("25");
    expect(normalizeDateValue(e.manufacturingDate.value)).toBe("2026-08-23");
    expect(normalizeDateValue(e.expiryDate.value)).toBe("2028-08-22");
    const qty = resolvedReceiveQuantity(e);
    expect(qty.quantity).toBe(5.4);
    expect(qty.unit.toUpperCase()).toBe("MT");
  });

  it("extracts Dextrose dispatch qty and party", () => {
    const e = heuristicExtractFromText(DEXTROSE_OCR);
    expect(e.productName.value).toMatch(/Dextrose/i);
    expect(e.productGrade.value).toMatch(/IP/i);
    expect(e.batchNumber.value).toBe("DAH/30");
    expect(e.supplierName.value).toMatch(/SRI SAI KRUPA/i);
    expect(normalizeDateValue(e.manufacturingDate.value)).toBe("2026-06-08");
    expect(e.dispatchQuantity.value).toBe("6");
    const qty = resolvedReceiveQuantity(e);
    expect(qty.quantity).toBe(6);
    expect(qty.unit.toUpperCase()).toBe("MT");
  });

  it("merges dual OCR passes", () => {
    const a = heuristicExtractFromText("Product Name: SUNMALT (MALTODEXTRIN)\nBatch Number MD/232");
    const b = heuristicExtractFromText("Total Quantity 5.400 MT\n216 Bags X 25 Kg");
    const merged = mergeCoaExtractions(a, b);
    expect(merged.productName.value).toMatch(/Sunmalt/i);
    expect(merged.batchNumber.value).toBe("MD/232");
    expect(merged.dispatchQuantity.value).toBe("5.400");
    expect(merged.packageCount.value).toBe("216");
  });

  it("finalizes noisy dextrose OCR into storeable form values", () => {
    const noisy = `
      GUJARAT AMBUJA EXPORTS LIMITED
      Product Name: DEXTROSE ANIVDROUS - IE GRADE id
      Batch No: DAH/30
      Manufacturing Date: 08.06.2026
      Expin Date: 07.06.2031
      Analysis Date: 13.06.2026
      Dispatch Qty: 6000 MT
      Batch Size: 50.000 MT
      PARTY NAME : : SRI SAI KRUPA ENTERPRISES.
    `;
    const finalized = finalizeCoaExtraction(heuristicExtractFromText(noisy), noisy);
    expect(finalized.productName.value).toBe("Dextrose Anhydrous – IP Grade");
    expect(finalized.batchNumber.value).toBe("DAH/30");
    expect(finalized.supplierName.value).toBe("SRI SAI KRUPA ENTERPRISES");
    expect(finalized.expiryDate.value).toBe("2031-06-07");
    expect(finalized.manufacturingDate.value).toBe("2026-06-08");
    expect(finalized.analysisDate.value).toBe("2026-06-13");
    expect(finalized.dispatchQuantity.value).toBe("6");
    expect(finalized.batchQuantity.value).toBe("50");
    expect(finalized.unit.value).toBe("MT");
    expect(resolvedReceiveQuantity(finalized)).toEqual({ quantity: 6, unit: "MT" });
  });

  it("finalizes sunmalt glued bags and total qty", () => {
    const noisy = `
      GUJARAT AMBUJA EXPORTS LIMITED
      Product Name : SUNMALT (MALTODEXTRIN)
      Batch Number: MD/I252
      Quantity. 216BagsX25Kg
      Towl Quantity: S400MT
      Date of Manufacturing 23.08.2026
      Date of Expiry 22.08.2028
      Date of Analysis 25.08.2026
      Dispatched date 26.08.2026
    `;
    const finalized = finalizeCoaExtraction(heuristicExtractFromText(noisy), noisy);
    expect(finalized.productName.value).toBe("Sunmalt (Maltodextrin)");
    expect(finalized.batchNumber.value).toBe("MD/232");
    expect(finalized.packageCount.value).toBe("216");
    expect(finalized.packageWeight.value).toBe("25");
    expect(finalized.dispatchQuantity.value).toBe("5.4");
    expect(finalized.unit.value).toBe("MT");
    expect(finalized.manufacturingDate.value).toBe("2026-08-23");
    expect(finalized.expiryDate.value).toBe("2028-08-22");
    expect(finalized.dispatchDate.value).toBe("2026-08-26");
  });
});
