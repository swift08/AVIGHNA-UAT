import { readFileSync } from "fs";
import { createRequire } from "module";

// Use vitest-transformed path via dynamic import of compiled helpers by inlining logic
const { heuristicExtractFromText, resolvedReceiveQuantity } = await import("../src/lib/coa-ocr.ts");

for (const name of ["dextrose-coa.pdf", "sunmalt-coa.pdf"]) {
  const bytes = readFileSync(new URL(`../tmp-coa-samples/${name}`, import.meta.url));
  const text = bytes.toString("latin1").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  const extracted = heuristicExtractFromText(text);
  const qty = resolvedReceiveQuantity(extracted);
  console.log(
    name,
    "=>",
    extracted.productName.value,
    extracted.batchNumber.value,
    qty.quantity,
    qty.unit,
  );
}
