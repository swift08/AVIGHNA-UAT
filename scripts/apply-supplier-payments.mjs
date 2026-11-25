/**
 * Apply only supabase/migrations/20261125_supplier_payments.sql
 * Needs SUPABASE_DB_PASSWORD or DATABASE_URL / SUPABASE_ACCESS_TOKEN in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  for (const name of [".env.production", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
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
}

loadEnvFile();

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261125_supplier_payments.sql"),
  "utf8",
);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ref = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "giditbshjmonrzurkaus";
const password = process.env.SUPABASE_DB_PASSWORD;
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

async function applyViaPg(config, label) {
  const client = new pg.Client(config);
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log(`Applied supplier_payments SQL via ${label}`);
}

if (dbUrl) {
  await applyViaPg(
    { connectionString: dbUrl, ssl: { rejectUnauthorized: false } },
    "DATABASE_URL",
  );
  process.exit(0);
}

if (password) {
  const candidates = [
    {
      name: "direct",
      config: {
        host: `db.${ref}.supabase.co`,
        port: 5432,
        database: "postgres",
        user: "postgres",
        password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      },
    },
    {
      name: "pooler-session",
      config: {
        host: "aws-0-ap-south-1.pooler.supabase.com",
        port: 5432,
        database: "postgres",
        user: `postgres.${ref}`,
        password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      },
    },
    {
      name: "pooler-transaction",
      config: {
        host: "aws-0-ap-south-1.pooler.supabase.com",
        port: 6543,
        database: "postgres",
        user: `postgres.${ref}`,
        password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      },
    },
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      console.log(`Trying ${candidate.name}…`);
      await applyViaPg(candidate.config, candidate.name);
      process.exit(0);
    } catch (err) {
      lastError = err;
      console.log(`${candidate.name} failed:`, err.message);
    }
  }
  console.error("All DB password attempts failed:", lastError?.message || lastError);
  process.exit(1);
}

if (accessToken) {
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
  console.log("Applied supplier_payments SQL via Management API");
  process.exit(0);
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceKey && supabaseUrl) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const args of [{ sql }, { query: sql }]) {
    const { error } = await admin.rpc("exec_sql", args);
    if (!error) {
      console.log("Applied via exec_sql RPC");
      process.exit(0);
    }
    console.log("exec_sql", Object.keys(args)[0], "→", error.message);
  }
}

console.error(
  "Missing DB credentials. Add SUPABASE_DB_PASSWORD (or DATABASE_URL / SUPABASE_ACCESS_TOKEN) to .env, then re-run:\n  node scripts/apply-supplier-payments.mjs",
);
process.exit(1);
