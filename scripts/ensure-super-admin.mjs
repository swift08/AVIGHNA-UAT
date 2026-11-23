/**
 * Ensure production Super Admin exists in Supabase Auth + user_profiles.
 * Email/password from env or defaults below.
 *
 * Usage: node scripts/ensure-super-admin.mjs
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

const email = (process.env.SUPER_ADMIN_EMAIL || "Asianapex15@gmail.com").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || "Superadmin@12";
const fullName = process.env.SUPER_ADMIN_NAME || "Super Admin";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (!data.users.length || data.users.length < 200) return null;
    page += 1;
  }
}

const meta = {
  full_name: fullName,
  role: "super_admin",
  features: [],
  phone: "",
  company: "all",
  status: "Active",
};

const existing = await findUserByEmail(email);
let userId;

if (existing) {
  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: { ...existing.user_metadata, ...meta },
  });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Updated Super Admin: ${email} (${userId})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created Super Admin: ${email} (${userId})`);
}

const initials =
  fullName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SA";

const profileAttempts = [
  {
    id: userId,
    auth_user_id: userId,
    full_name: fullName,
    email,
    phone: "",
    role_id: "super_admin",
    initials,
    default_company_id: "asian",
  },
  {
    id: userId,
    full_name: fullName,
    email,
    phone: "",
    role_id: "super_admin",
    initials,
    default_company_id: "asian",
  },
  {
    id: userId,
    name: fullName,
    email,
    role_id: "super_admin",
    initials,
    company_id: "asian",
  },
];

let profileOk = false;
for (const row of profileAttempts) {
  const { error } = await admin.from("user_profiles").upsert(row, { onConflict: "id" });
  if (!error) {
    console.log("Synced user_profiles.");
    profileOk = true;
    break;
  }
  console.warn(`user_profiles attempt failed: ${error.message}`);
}
if (!profileOk) {
  console.warn("Could not sync user_profiles — Auth user is still usable if JWT role metadata is set.");
}

console.log("Done. Sign in with that email/password (demo auth must be off).");
