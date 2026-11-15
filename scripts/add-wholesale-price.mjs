import pg from "pg";

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const client = new pg.Client({
  host: "db.giditbshjmonrzurkaus.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

const sql = `
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.unit_price IS 'Catalog Selling Price (Retail/Standard)';
COMMENT ON COLUMN public.products.wholesale_price IS 'Catalog Wholesale Price (Dealer/Bulk)';

-- Backfill: if wholesale was never set, mirror selling price for existing rows at 0.
UPDATE public.products
SET wholesale_price = unit_price
WHERE wholesale_price = 0 AND unit_price > 0;
`;

await client.connect();
await client.query(sql);
const { rows } = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name IN ('unit_price','wholesale_price')
  ORDER BY column_name
`);
console.log("OK", rows);
await client.end();
