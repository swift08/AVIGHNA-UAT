/**
 * Set a staff login to role=sales (Field app gate).
 * Usage: node scripts/fix-sales-role.mjs email@example.com
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
const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/fix-sales-role.mjs email@example.com");
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error(error);
  process.exit(1);
}
const user = data.users.find((u) => (u.email || "").toLowerCase() === email);
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}

const features = Array.isArray(user.user_metadata?.features)
  ? user.user_metadata.features
  : ["leads", "customers", "field_visits", "orders", "collections", "tasks"];

const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
  user_metadata: {
    ...user.user_metadata,
    role: "sales",
    features,
    status: user.user_metadata?.status || "Active",
  },
});
if (updErr) {
  console.error(updErr);
  process.exit(1);
}

await admin.from("user_profiles").upsert({
  id: user.id,
  auth_user_id: user.id,
  email,
  full_name: user.user_metadata?.full_name || email,
  role_id: "sales",
  is_active: true,
});

console.log("Updated", email, "→ role=sales features=", features.join(","));
