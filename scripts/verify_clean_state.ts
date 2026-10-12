/**
 * Wipe transactional / dummy business data from Supabase.
 * Preserves companies, roles, permissions, and user_profiles.
 *
 * Usage: npx tsx scripts/verify_clean_state.ts
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** FK-safe wipe order (children first). */
const businessTables = [
  "payments",
  "invoices",
  "deliveries",
  "order_items",
  "orders",
  "field_visits",
  "leads",
  "customers",
  "tasks",
  "purchase_orders",
  "inventory_logs",
  "products",
  "credit_notes",
  "vehicles",
  "audit_logs",
  "notifications",
];

async function wipeTable(table: string) {
  // Prefer deleting all rows; fall back to created_at filter if id filter fails.
  let { error } = await supabase.from(table).delete().neq("id", "___never___");
  if (error) {
    ({ error } = await supabase.from(table).delete().gte("created_at", "1970-01-01"));
  }
  if (error) {
    // Some tables use UUID ids — delete with a always-true predicate via filter.
    ({ error } = await supabase.from(table).delete().not("id", "is", null));
  }
  return error;
}

async function countTable(table: string) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return { count: -1, error: error.message };
  return { count: count ?? 0, error: null as string | null };
}

async function resetAndVerify() {
  console.log("=== WIPING DUMMY / BUSINESS DATA ===\n");

  for (const table of businessTables) {
    const error = await wipeTable(table);
    if (error) {
      console.warn(`  ${table}: ${error.message}`);
    } else {
      console.log(`  cleared ${table}`);
    }
  }

  console.log("\n=== VERIFYING COUNTS ===\n");
  let allZero = true;
  for (const table of businessTables) {
    const { count, error } = await countTable(table);
    if (error) {
      console.log(`  ${table}: ERROR ${error}`);
      allZero = false;
    } else {
      console.log(`  ${table}: ${count}`);
      if (count !== 0) allZero = false;
    }
  }

  const companies = await countTable("companies");
  const roles = await countTable("roles");
  const profiles = await countTable("user_profiles");
  console.log(
    `\nPreserved: companies=${companies.count}, roles=${roles.count}, user_profiles=${profiles.count}`,
  );

  if (allZero) {
    console.log("\nSUCCESS: all business tables are empty.");
    process.exit(0);
  }
  console.error("\nWARNING: some tables still have rows.");
  process.exit(2);
}

resetAndVerify().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
