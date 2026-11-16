import pg from "pg";
import { readFileSync } from "fs";

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const sql = readFileSync(
  new URL("../supabase/migrations/20261116_coa_content_hash.sql", import.meta.url),
  "utf8",
);

const client = new pg.Client({
  host: "db.giditbshjmonrzurkaus.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
console.log("coa_content_hash ready");
await client.end();
