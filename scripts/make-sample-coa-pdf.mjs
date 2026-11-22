import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/** Minimal valid PDF with extractable text for heuristic OCR smoke tests. */
function textPdf(lines) {
  const content = lines.map((line, i) => `BT /F1 12 Tf 50 ${750 - i * 18} Td (${line.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
  const stream = Buffer.from(content, "utf8");
  const objects = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(`4 0 obj<< /Length ${stream.length} >>stream\n${content}\nendstream\nendobj\n`);
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

const outDir = join(process.cwd(), "tmp-coa-samples");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "dextrose-coa.pdf"),
  textPdf([
    "Certificate of Analysis",
    "Product Name: Dextrose Anhydrous - IP Grade",
    "Manufacturer: Sample Pharma Labs",
    "Batch No: DAH/30",
    "Mfg Date: 08-06-2026",
    "Expiry Date: 07-06-2031",
    "Dispatch Quantity: 6 MT",
    "Appearance  White crystalline  Complies  Pass",
    "Assay  99.0-101.0%  99.8%  Pass",
  ]),
);

writeFileSync(
  join(outDir, "sunmalt-coa.pdf"),
  textPdf([
    "Certificate of Analysis",
    "Product Name: Sunmalt (Maltodextrin)",
    "Manufacturer: Grain Processors Ltd",
    "Batch No: MD/232",
    "Mfg Date: 23-08-2026",
    "Expiry Date: 22-08-2028",
    "216 Bags x 25 KG",
    "Moisture  NMT 5.0%  3.2%  Pass",
    "DE Value  10-20  15  Pass",
  ]),
);

console.log(`Wrote samples to ${outDir}`);
