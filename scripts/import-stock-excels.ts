/**
 * Import Tally Stock Summary / Stock Group Summary (.xls / .xlsx) files into Supabase `products`.
 *
 * Usage:
 *   npx tsx scripts/import-stock-excels.ts --dry-run "C:\path\to\file1.xls" "C:\path\to\file2.xlsx"
 *   npx tsx scripts/import-stock-excels.ts "C:\path\to\file1.xls" ...
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { parseTallyStockWorkbook, type ParsedStockRow } from "../src/lib/stock-excel-parser";
import type { CompanyId } from "../src/lib/workspace-data";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.resolve(process.cwd(), name);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const i = trimmed.indexOf("=");
      const key = trimmed.slice(0, i).trim();
      let val = trimmed.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const COMPANY_PREFIX: Record<string, string> = {
  avighna: "AVG",
  asian: "ASA",
  atharva: "ATH",
  ganesh: "GAN",
};

function makeProductCode(companyId: string, name: string, usedCodes: Set<string>): string {
  const prefix = COMPANY_PREFIX[companyId] || "PRD";
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 10) || "ITEM";
  let code = `${prefix}-${slug}`;
  let idx = 2;
  while (usedCodes.has(code)) {
    code = `${prefix}-${slug.slice(0, 8)}${idx}`;
    idx += 1;
  }
  usedCodes.add(code);
  return code;
}

function guessCompanyFromFilename(filePath: string): CompanyId {
  const lower = path.basename(filePath).toLowerCase();
  if (lower.includes("asian")) return "asian";
  if (lower.includes("avighna")) return "avighna";
  if (lower.includes("atharva")) return "atharva";
  if (lower.includes("ganesh")) return "ganesh";
  return "asian";
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = args.filter((a) => !a.startsWith("--"));

  if (files.length === 0) {
    console.error("Usage: npx tsx scripts/import-stock-excels.ts [--dry-run] <file1> [file2 ...]");
    process.exit(1);
  }

  const allRows: ParsedStockRow[] = [];
  for (const f of files) {
    const wb = XLSX.readFile(f);
    const fallback = guessCompanyFromFilename(f);
    const parsed = parseTallyStockWorkbook(wb, fallback);
    console.log(
      `\n=== ${path.basename(f)} (company: ${parsed.detectedCompany || fallback}) -> ${parsed.rows.length} items ===`,
    );
    if (parsed.skippedGroups.length > 0) {
      console.log(`  Skipped group subtotals: ${parsed.skippedGroups.join(", ")}`);
    }
    for (const r of parsed.rows.slice(0, 5)) {
      console.log(
        `  [${r.category}] ${r.name} | qty: ${r.quantity} ${r.unit} | rate: ₹${r.rate} | val: ₹${r.value}`,
      );
    }
    if (parsed.rows.length > 5) {
      console.log(`  ... (+${parsed.rows.length - 5} more)`);
    }
    allRows.push(...parsed.rows);
  }

  console.log(`\nTotal parsed items: ${allRows.length}`);
  if (dryRun) {
    console.log("Dry run complete. No database changes made.");
    return;
  }

  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing } = await sb.from("products").select("id, company_id, code, name");
  const usedCodes = new Set((existing || []).map((p) => String(p.code || "").toUpperCase()));
  const existingByKey = new Map(
    (existing || []).map((p) => [`${p.company_id}::${String(p.name || "").trim().toLowerCase()}`, p]),
  );

  let inserted = 0;
  let updated = 0;

  for (const row of allRows) {
    const keyName = `${row.company_id}::${row.name.trim().toLowerCase()}`;
    const match = existingByKey.get(keyName);
    if (match) {
      const { error } = await sb
        .from("products")
        .update({
          category: row.category,
          unit: row.unit,
          unit_price: row.rate,
          on_hand: row.quantity,
        })
        .eq("id", match.id);
      if (error) console.error(`ERR update ${row.name}:`, error.message);
      else updated += 1;
    } else {
      const code = makeProductCode(row.company_id, row.name, usedCodes);
      const { error } = await sb.from("products").insert({
        company_id: row.company_id,
        code,
        name: row.name,
        category: row.category,
        unit: row.unit,
        unit_price: row.rate,
        wholesale_price: 0,
        on_hand: row.quantity,
        reserved: 0,
        reorder_level: 10,
      });
      if (error) console.error(`ERR insert ${row.name}:`, error.message);
      else inserted += 1;
    }
  }

  console.log(`\nDONE: inserted=${inserted}, updated=${updated}, total=${inserted + updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
