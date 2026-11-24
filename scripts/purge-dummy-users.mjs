/**
 * Delete old demo/dummy Auth users. Keeps real accounts (Super Admin + real staff).
 * Usage: node scripts/purge-dummy-users.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const KEEP_EMAILS = new Set(
  [
    process.env.SUPER_ADMIN_EMAIL || "Asianapex15@gmail.com",
    "malipatilharshith@gmail.com",
  ].map((e) => e.trim().toLowerCase()),
);

const DUMMY_EMAILS = new Set(
  [
    "admin@avighnaone.com",
    "owner@avighna.com",
    "sales@avighna.com",
    "ravi.kumar@avighnaone.com",
    "supervisor@avighna.com",
    "arun.nair@avighnaone.com",
    "accounts@avighna.com",
    "suresh.rao@avighnaone.com",
    "logistics@avighna.com",
    "mahesh.patel@avighnaone.com",
    "suresh.driver@avighna.com",
    "admin@avighnya.local",
    "owner@avighnya.local",
    "sales@avighnya.local",
    "accounts@avighnya.local",
    "supervisor@avighnya.local",
    "logistics@avighnya.local",
    "ravi@avighnya.local",
    "suresh@avighnya.local",
  ].map((e) => e.toLowerCase()),
);

const DUMMY_ID_PREFIXES = [
  "11111111-1111-1111-1111-",
  "22222222-2222-2222-2222-",
  "33333333-3333-3333-3333-",
  "44444444-4444-4444-4444-",
  "55555555-5555-5555-5555-",
];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isDummy(user) {
  const email = (user.email || "").toLowerCase();
  if (KEEP_EMAILS.has(email)) return false;
  if (DUMMY_EMAILS.has(email)) return true;
  if (DUMMY_ID_PREFIXES.some((p) => String(user.id).startsWith(p))) return true;
  if (email.endsWith("@avighnaone.com") || email.endsWith("@avighnya.local")) return true;
  if (email.endsWith("@avighna.com") && email !== (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase()) {
    // legacy role mailboxes used for demo
    return ["owner@", "sales@", "supervisor@", "accounts@", "logistics@", "suresh.driver@"].some(
      (p) => email.startsWith(p),
    );
  }
  return false;
}

const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error(error);
  process.exit(1);
}

const toDelete = data.users.filter(isDummy);
const keep = data.users.filter((u) => !isDummy(u));

console.log("Keeping:");
for (const u of keep) console.log(`  ${u.email} (${u.user_metadata?.role || "—"})`);
console.log("Deleting:");
for (const u of toDelete) console.log(`  ${u.email} (${u.id})`);

for (const u of toDelete) {
  const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
  if (delErr) {
    console.error(`Failed ${u.email}:`, delErr.message);
    continue;
  }
  await admin.from("user_profiles").delete().eq("id", u.id);
  console.log(`Deleted ${u.email}`);
}

console.log(`Done. Deleted ${toDelete.length}, kept ${keep.length}.`);
