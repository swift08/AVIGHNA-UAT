import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sql = readFileSync(
  new URL("../supabase/migrations/20261115_product_batches_coa.sql", import.meta.url),
  "utf8",
);

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Prefer rpc exec if available; otherwise create tables via REST is not possible for DDL.
const { error } = await admin.rpc("exec_sql", { query: sql }).maybeSingle?.() 
  ? await admin.rpc("exec_sql", { query: sql })
  : { error: { message: "rpc unavailable" } };

if (error) {
  console.log("Direct RPC unavailable; attempting statement-by-statement via pg REST is not supported.");
  console.log("Please run supabase/migrations/20261115_product_batches_coa.sql in the Supabase SQL editor.");
  console.log("RPC error:", error.message || error);
  process.exit(0);
}

console.log("Migration applied.");
