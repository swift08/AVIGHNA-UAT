/**
 * Sync products catalog from Inventory_Segregated_By_Company.xlsx into Supabase.
 * Adds missing stock items per company. Does not delete existing products or overwrite stock/prices.
 *
 * Usage:
 *   node scripts/sync-inventory-from-xlsx.mjs "C:\path\to\file.xlsx"
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
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
    out[key] = val;
  }
  return out;
}

const SHEET_TO_COMPANY = {
  Avighna: "avighna",
  "Asian Apex": "asian",
  "Atharva Ass.": "atharva",
  "Ganesh Inc.": "ganesh",
};

const COMPANY_PREFIX = {
  avighna: "AVG",
  asian: "ASA",
  atharva: "ATH",
  ganesh: "GAN",
};

function slugCode(name) {
  return String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function guessUnit(name) {
  const n = name.toLowerCase();
  if (/\b(freezer|device|system|service|calibration|instrument|kit)\b/.test(n)) {
    return "pcs";
  }
  if (/\b(culture|snap|aller|test|sticks?)\b/.test(n)) return "pcs";
  if (/\b(powder|starch|glucose|acid|dextrin|oil|flavour|flavor|seasoning)\b/.test(n)) {
    return "kg";
  }
  return "kg";
}

function guessCategory(name) {
  const n = name.toLowerCase();
  if (/\bculture|dvs|chy-max|coagulant\b/.test(n)) return "Cultures & Enzymes";
  if (/\b(aller|aqua snap|test|calcheck|calibration|system sure)\b/.test(n)) {
    return "Testing & Hygiene";
  }
  if (/\b(freezer|device|instrument)\b/.test(n)) return "Equipment";
  if (/\b(seasoning|flavour|flavor|spice|pepper|cocoa)\b/.test(n)) return "Flavours & Seasonings";
  if (/\b(starch|glucose|dextrin|dextrose|acid|hydroxy|oil)\b/.test(n)) {
    return "Ingredients";
  }
  if (/\b(improver|xtendra|bake|paneer)\b/.test(n)) return "Bakery & Dairy Aids";
  return "General";
}

async function readExcel(xlsxPath) {
  // Prefer exceljs if available; otherwise shell out to python+openpyxl
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const byCompany = {};
    for (const [sheetName, companyId] of Object.entries(SHEET_TO_COMPANY)) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;
      const items = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(3).value || "").trim();
        if (name) items.push(name);
      });
      byCompany[companyId] = items;
    }
    return byCompany;
  } catch {
    // fallback via python
  }

  const py = `
import openpyxl, json
wb=openpyxl.load_workbook(r'''${xlsxPath.replace(/\\/g, "\\\\")}''', data_only=True)
mapping=${JSON.stringify(SHEET_TO_COMPANY)}
out={}
for sheet,cid in mapping.items():
  ws=wb[sheet]
  items=[]
  for i,row in enumerate(ws.iter_rows(values_only=True),1):
    if i==1: continue
    name=(str(row[2]).strip() if row[2] is not None else '')
    if name and name != 'None': items.append(name)
  out[cid]=items
print(json.dumps(out))
`;
  const { execFileSync } = await import("node:child_process");
  const raw = execFileSync("python", ["-c", py], { encoding: "utf8" });
  return JSON.parse(raw.trim().split(/\r?\n/).pop());
}

const env = {
  ...loadEnv(path.resolve(".env")),
  ...loadEnv(path.resolve(".env.local")),
  ...process.env,
};

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env (SUPABASE_URL / SERVICE_ROLE or ANON key).");
  process.exit(1);
}

const xlsxPath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "Inventory_Segregated_By_Company (1).xlsx",
  );

if (!fs.existsSync(xlsxPath)) {
  console.error("Excel file not found:", xlsxPath);
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const byCompany = await readExcel(xlsxPath);
console.log(
  "Parsed:",
  Object.fromEntries(Object.entries(byCompany).map(([k, v]) => [k, v.length])),
);

const { data: existing, error: fetchErr } = await supabase
  .from("products")
  .select("id, company_id, code, name, on_hand, unit_price");
if (fetchErr) {
  console.error("Failed to fetch products:", fetchErr.message);
  process.exit(1);
}

const existingList = existing || [];
console.log("Existing products in DB:", existingList.length);

const byCompanyName = new Map();
const codesUsed = new Set(existingList.map((p) => String(p.code || "").toUpperCase()));
for (const p of existingList) {
  byCompanyName.set(`${p.company_id}::${normalizeName(p.name)}`, p);
}

const toInsert = [];
const already = [];

for (const [companyId, names] of Object.entries(byCompany)) {
  const seenInSheet = new Set();
  for (const name of names) {
    const key = `${companyId}::${normalizeName(name)}`;
    if (seenInSheet.has(key)) continue;
    seenInSheet.add(key);
    if (byCompanyName.has(key)) {
      already.push({ companyId, name });
      continue;
    }
    const prefix = COMPANY_PREFIX[companyId] || "SKU";
    let base = `${prefix}-${slugCode(name) || "ITEM"}`;
    if (base.length < 6) base = `${prefix}-${String(toInsert.length + 1).padStart(4, "0")}`;
    let code = base.slice(0, 24);
    let n = 1;
    while (codesUsed.has(code.toUpperCase())) {
      code = `${base.slice(0, 20)}-${n++}`.slice(0, 24);
    }
    codesUsed.add(code.toUpperCase());
    toInsert.push({
      company_id: companyId,
      code,
      name,
      category: guessCategory(name),
      unit: guessUnit(name),
      unit_price: 0,
      wholesale_price: 0,
      on_hand: 0,
      reserved: 0,
      reorder_level: 20,
    });
  }
}

console.log(`Matched existing: ${already.length}`);
console.log(`To insert: ${toInsert.length}`);

if (toInsert.length === 0) {
  console.log("Inventory already up to date — nothing to insert.");
  process.exit(0);
}

const chunkSize = 50;
let inserted = 0;
for (let i = 0; i < toInsert.length; i += chunkSize) {
  const chunk = toInsert.slice(i, i + chunkSize);
  const { data, error } = await supabase.from("products").insert(chunk).select("id, code, name, company_id");
  if (error) {
    // Retry without wholesale_price if column missing
    if (error.message?.includes("wholesale_price") || error.code === "PGRST204") {
      const fallback = chunk.map(({ wholesale_price, ...rest }) => ({
        ...rest,
        category: `${rest.category} #ws:0`,
      }));
      const { data: fbData, error: fbErr } = await supabase
        .from("products")
        .insert(fallback)
        .select("id, code, name, company_id");
      if (fbErr) {
        console.error("Insert failed:", fbErr.message);
        process.exit(1);
      }
      inserted += fbData?.length || 0;
      console.log(`Inserted chunk ${i / chunkSize + 1}:`, fbData?.length || 0);
    } else {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
  } else {
    inserted += data?.length || 0;
    console.log(`Inserted chunk ${i / chunkSize + 1}:`, data?.length || 0);
  }
}

const orphans = existingList.filter((p) => {
  const sheet = byCompany[p.company_id];
  if (!sheet) return false;
  const names = new Set(sheet.map(normalizeName));
  return !names.has(normalizeName(p.name));
});

console.log("---");
console.log(`Done. Inserted ${inserted} products.`);
console.log(
  `DB products not in Excel (left unchanged): ${orphans.length}`,
);
if (orphans.length && orphans.length <= 30) {
  for (const o of orphans) {
    console.log(`  - [${o.company_id}] ${o.name} (${o.code})`);
  }
}
