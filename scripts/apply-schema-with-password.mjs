/**
 * Apply supabase/schema.sql (+ optional migrations) using the DB password.
 * Usage: node scripts/apply-schema-with-password.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import pg from "pg";

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

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD in .env");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ref = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "giditbshjmonrzurkaus";

// ponytail: apply master schema only; migrations are incremental and may already be applied.
const only = process.argv.includes("--with-migrations");
const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const files = [schemaPath];
if (only) {
  const migrationDir = resolve(process.cwd(), "supabase/migrations");
  if (existsSync(migrationDir)) {
    for (const name of readdirSync(migrationDir).sort()) {
      if (name.endsWith(".sql")) files.push(join(migrationDir, name));
    }
  }
}

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

async function applyAll(client) {
  for (const file of files) {
    const label = file.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", "");
    const sql = readFileSync(file, "utf8");
    console.log(`Applying ${label}…`);
    try {
      await client.query(sql);
      console.log(`  OK`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Idempotent re-runs: skip already-applied objects.
      if (/already exists|duplicate key/i.test(msg)) {
        console.log(`  skipped (${msg.split("\n")[0]})`);
        continue;
      }
      throw err;
    }
  }
}

let lastError = null;
for (const candidate of candidates) {
  const client = new pg.Client(candidate.config);
  try {
    console.log(`Trying ${candidate.name}…`);
    await client.connect();
    await applyAll(client);
    await client.end();
    console.log(`Schema updated via ${candidate.name}`);
    process.exit(0);
  } catch (err) {
    lastError = err;
    console.log(`${candidate.name} failed:`, err.message);
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

console.error("All connection attempts failed:", lastError?.message || lastError);
process.exit(1);
