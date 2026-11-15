import { readFileSync } from "fs";
import pg from "pg";

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const ref = "giditbshjmonrzurkaus";
const sql = readFileSync(
  new URL("../supabase/migrations/20261115_product_batches_coa.sql", import.meta.url),
  "utf8",
);

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
      host: `aws-0-ap-south-1.pooler.supabase.com`,
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
      host: `aws-0-ap-south-1.pooler.supabase.com`,
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
  const client = new pg.Client(candidate.config);
  try {
    console.log(`Trying ${candidate.name}…`);
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log(`Migration applied via ${candidate.name}`);
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
