/**
 * Applies COA migration using the Supabase Postgres connection string if present,
 * otherwise attempts the Database REST query endpoint with a management token.
 *
 * Env (any one):
 * - DATABASE_URL / SUPABASE_DB_URL
 * - SUPABASE_ACCESS_TOKEN (+ project ref from SUPABASE_URL)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const sql = readFileSync(
  new URL("../supabase/migrations/20261115_product_batches_coa.sql", import.meta.url),
  "utf8",
);

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || env.DATABASE_URL || env.SUPABASE_DB_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
const ref = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (dbUrl) {
  const { default: pg } = await import("pg").catch(() => ({ default: null }));
  if (!pg) {
    console.error("Install pg to apply via DATABASE_URL: npm i -D pg");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Applied via DATABASE_URL");
  process.exit(0);
}

if (accessToken && ref) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("Management API failed:", res.status, body);
    process.exit(1);
  }
  console.log("Applied via Management API");
  process.exit(0);
}

// Last resort: probe whether service role can call an existing helper
const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await admin.rpc("exec_sql", { sql });
console.log(
  "No DATABASE_URL / SUPABASE_ACCESS_TOKEN. RPC exec_sql:",
  error?.message || "unexpected success",
);
console.log("Open Supabase SQL editor and run: supabase/migrations/20261115_product_batches_coa.sql");
process.exit(0);
