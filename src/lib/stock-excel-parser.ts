import * as XLSX from "xlsx";
import type { CompanyId } from "./workspace-data";

export interface ParsedStockRow {
  company_id: CompanyId;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  rate: number;
  value: number;
}

export interface ParsedStockWorkbook {
  detectedCompany: CompanyId | null;
  rows: ParsedStockRow[];
  skippedGroups: string[];
}

function detectCompanyFromText(text: string): CompanyId | null {
  const lower = text.toLowerCase();
  if (lower.includes("asian apex")) return "asian";
  if (lower.includes("avighna")) return "avighna";
  if (lower.includes("atharva")) return "atharva";
  if (lower.includes("ganesh")) return "ganesh";
  return null;
}

function parseQtyAndUnit(cell: XLSX.CellObject | undefined): { quantity: number; unit: string } {
  if (!cell) return { quantity: 0, unit: "" };
  const rawNum = typeof cell.v === "number" ? cell.v : Number(String(cell.v ?? "").replace(/,/g, ""));
  const formatted = String(cell.w ?? cell.v ?? "").trim();
  const unitMatch = formatted.match(/^[-+]?\d[\d,]*(?:\.\d+)?\s+([A-Za-z][A-Za-z0-9./-]*)$/);
  const unit = unitMatch?.[1]?.trim() || "";
  const quantity = Number.isFinite(rawNum) ? rawNum : 0;
  return { quantity, unit };
}

function parseNumber(cell: XLSX.CellObject | undefined): number {
  if (!cell) return 0;
  if (typeof cell.v === "number") return Number.isFinite(cell.v) ? cell.v : 0;
  const n = Number(String(cell.v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function cleanLabel(val: unknown): string {
  return String(val ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guessUnitFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\b(culture|dvs)\b/.test(n)) return "Pouch";
  if (/\b(swab|test|device|luminometer|etouch|calcheck|service|kit)\b/.test(n)) return "Nos";
  return "kg";
}

function guessCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\b(culture|dvs|chy-max|coagulant)\b/.test(n)) return "Cultures";
  if (/\b(swab|aqua\s*snap|ultrasnap|pro\s*clean|etouch|luminometer|calcheck|calibration)\b/.test(n)) {
    return "Testing & Hygiene";
  }
  if (/\b(flv\.?|flavour|flavor|seasoning|spice|cocoa)\b/.test(n)) return "Flavours";
  if (/\b(starch|glucose|dextrin|dextrose|sorbitol|acid|percarbonate)\b/.test(n)) return "Ingredients";
  if (/\b(xtendra|improver|ezential|ezentail|bake|mithai)\b/.test(n)) return "Bakery & Dairy Aids";
  return "General";
}

const KNOWN_GROUP_NAMES = new Set([
  "cultures",
  "dairy cultures",
  "commodities",
  "ingredients",
  "chemicals",
  "flavours",
  "equipments",
  "equipment",
  "testing & hygiene",
  "primary",
]);

/**
 * Parse a Tally Stock Summary / Stock Group Summary (.xls or .xlsx) workbook.
 * Reads `Particulars`, `Closing Balance -> Quantity (with unit from Excel format), Rate, Value`.
 */
export function parseTallyStockWorkbook(
  workbook: XLSX.WorkBook,
  fallbackCompany: CompanyId = "asian",
): ParsedStockWorkbook {
  let detectedCompany: CompanyId | null = null;
  const rows: ParsedStockRow[] = [];
  const skippedGroups: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);

    // First scan top header lines to detect company
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 12); r++) {
      for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 3); c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        const found = detectCompanyFromText(cleanLabel(cell.w ?? cell.v));
        if (found) {
          detectedCompany = found;
          break;
        }
      }
      if (detectedCompany) break;
    }

    // Track section group headings (e.g. "Chemicals", "Dairy Cultures", etc.)
    let currentGroup = sheetName && sheetName.toLowerCase() !== "stock summary" ? sheetName : "";
    let inTable = false;
    let partCol = range.s.c;
    let qtyCol = range.s.c + 1;
    let rateCol = range.s.c + 2;
    let valCol = range.s.c + 3;

    // Collect section headers that appear before "Particulars" so we can skip top-level group summary rows
    const sectionTitles = new Set<string>();
    for (let r = range.s.r; r <= range.e.r; r++) {
      const a = cleanLabel(ws[XLSX.utils.encode_cell({ r, c: range.s.c })]?.v);
      const b = cleanLabel(ws[XLSX.utils.encode_cell({ r, c: range.s.c + 1 })]?.v);
      if (a && !b && r + 1 <= range.e.r) {
        const nextB = cleanLabel(ws[XLSX.utils.encode_cell({ r: r + 1, c: range.s.c + 1 })]?.v);
        if (nextB.toLowerCase() === a.toLowerCase()) {
          sectionTitles.add(a.toLowerCase());
        }
      }
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      // Scan the row for "Particulars" or "Quantity" / "Rate" / "Value" headers at any column offset
      let foundParticularsCol = -1;
      let foundQtyCol = -1;
      let foundRateCol = -1;
      let foundValCol = -1;
      let firstNonEmptyCol = -1;
      let firstNonEmptyText = "";
      let nonEmptyCount = 0;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        const text = cleanLabel(cell?.w ?? cell?.v);
        if (!text) continue;
        nonEmptyCount += 1;
        if (firstNonEmptyCol === -1) {
          firstNonEmptyCol = c;
          firstNonEmptyText = text;
        }
        const lower = text.toLowerCase();
        if (lower === "particulars") foundParticularsCol = c;
        else if (lower === "quantity") foundQtyCol = c;
        else if (lower === "rate") foundRateCol = c;
        else if (lower === "value") foundValCol = c;
      }

      if (nonEmptyCount === 0) continue;

      if (foundParticularsCol !== -1) {
        partCol = foundParticularsCol;
        inTable = false;
        continue;
      }

      // Detect table header row: "Quantity | Rate | Value"
      if (foundQtyCol !== -1 && foundRateCol !== -1) {
        qtyCol = foundQtyCol;
        rateCol = foundRateCol;
        valCol = foundValCol !== -1 ? foundValCol : foundRateCol + 1;
        if (partCol >= qtyCol) partCol = Math.max(range.s.c, qtyCol - 1);
        inTable = true;
        continue;
      }

      // Detect new group heading between sections
      if (!inTable) {
        if (
          nonEmptyCount === 1 &&
          firstNonEmptyText &&
          !/stock summary|grand total|\d{1,2}-[a-z]{3}-\d{2}|e-mail|drug lic|bangalore|layout|road|private limited|company|associates|ganesh inc|formerly|consultancy|closing balance|new reg/i.test(
            firstNonEmptyText,
          )
        ) {
          currentGroup = firstNonEmptyText;
        }
        continue;
      }

      const aCell = ws[XLSX.utils.encode_cell({ r, c: partCol })];
      const a = cleanLabel(aCell?.w ?? aCell?.v);

      // End of section
      if (a.toLowerCase() === "grand total") {
        inTable = false;
        continue;
      }

      if (!a) continue;

      // Skip Tally group summary rows (no qty & no rate, only value — or known group subtotal row)
      const qCell = ws[XLSX.utils.encode_cell({ r, c: qtyCol })];
      const rCell = ws[XLSX.utils.encode_cell({ r, c: rateCol })];
      const vCell = ws[XLSX.utils.encode_cell({ r, c: valCol })];

      const { quantity, unit } = parseQtyAndUnit(qCell);
      const rate = parseNumber(rCell);
      const value = parseNumber(vCell);

      const lowerA = a.toLowerCase();
      const hasQty = qCell !== undefined && String(qCell.v ?? "").trim() !== "";
      const hasRate = rCell !== undefined && String(rCell.v ?? "").trim() !== "";

      if (
        (!hasQty && !hasRate && value !== 0) ||
        sectionTitles.has(lowerA) ||
        (KNOWN_GROUP_NAMES.has(lowerA) && rows.length === 0)
      ) {
        skippedGroups.push(a);
        if (!currentGroup || KNOWN_GROUP_NAMES.has(lowerA)) {
          currentGroup = a;
        }
        continue;
      }

      rows.push({
        company_id: detectedCompany || fallbackCompany,
        name: a,
        category: currentGroup || guessCategoryFromName(a),
        quantity,
        unit: unit || guessUnitFromName(a),
        rate,
        value,
      });
    }
  }

  // Deduplicate by normalized name per company (keep the later detailed row if duplicated)
  const dedup = new Map<string, ParsedStockRow>();
  for (const row of rows) {
    const key = `${row.company_id}::${row.name.toLowerCase()}`;
    dedup.set(key, row);
  }

  return {
    detectedCompany,
    rows: Array.from(dedup.values()),
    skippedGroups,
  };
}
