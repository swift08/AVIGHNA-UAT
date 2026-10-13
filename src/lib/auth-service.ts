import { supabase } from "./supabase";
import { isDemoAuthEnabled } from "./demo-auth";

export type RoleType = "super_admin" | "sales" | "supervisor" | "accounts" | "logistics" | "custom";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RoleType;
  roleName: string;
  initials: string;
  company: string;
  permissions: string[];
  overrides?: {
    grant?: string[];
    deny?: string[];
  };
}

export const ROLE_NAMES: Record<RoleType, string> = {
  super_admin: "Owner / Super Admin",
  sales: "Sales Executive",
  supervisor: "Warehouse Supervisor",
  accounts: "Accounts Manager",
  logistics: "Logistics Driver",
  custom: "Custom access",
};

export type AccessFeature = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
};

/** Screens an owner can grant to a login. A login can have more than one. */
export const ACCESS_FEATURES: AccessFeature[] = [
  {
    id: "tasks",
    name: "My work",
    description: "View and assign tasks",
    permissions: ["tasks.view", "tasks.manage"],
  },
  {
    id: "leads",
    name: "Leads",
    description: "Pipeline, add leads, and convert customers",
    permissions: ["leads.view", "leads.manage", "leads.convert"],
  },
  {
    id: "customers",
    name: "Customers",
    description: "View and edit customers",
    permissions: ["customers.view", "customers.manage"],
  },
  {
    id: "field_visits",
    name: "Field visits",
    description: "Schedule visits and log GPS or audio",
    permissions: ["field_visits.view", "field_visits.schedule", "field_visits.conduct"],
  },
  {
    id: "orders",
    name: "Orders",
    description: "View, create, and edit orders",
    permissions: ["orders.view", "orders.create", "orders.edit"],
  },
  {
    id: "order_approval",
    name: "Order approval",
    description: "Approve orders for dispatch",
    permissions: ["orders.view", "orders.approve"],
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "View stock and approve adjustments",
    permissions: ["inventory.view", "inventory.adjust", "inventory.shortage_approve"],
  },
  {
    id: "purchases",
    name: "Purchases",
    description: "Create, approve, and receive purchase orders",
    permissions: ["purchases.view", "purchases.create", "purchases.approve", "purchases.receive"],
  },
  {
    id: "logistics",
    name: "Logistics",
    description: "Deliveries, dispatch, and proof of delivery",
    permissions: [
      "logistics.view",
      "logistics.dispatch",
      "logistics.deliver",
      "orders.view",
      "tasks.view",
      "customers.view",
    ],
  },
  {
    id: "invoices",
    name: "Invoices",
    description: "Invoices and payment collection",
    permissions: ["invoices.view", "invoices.generate", "payments.record", "orders.view", "customers.view"],
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Revenue and performance charts",
    permissions: ["analytics.view"],
  },
  {
    id: "credit",
    name: "Credit control",
    description: "Limits, days, and credit or debit notes",
    permissions: ["credit.view"],
  },
  {
    id: "administration",
    name: "Administration",
    description: "Companies, team logins, and fleet",
    permissions: ["admin.manage", "audit.view"],
  },
];

const FEATURE_IDS = new Set(ACCESS_FEATURES.map((feature) => feature.id));

export function parseFeatureIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && FEATURE_IDS.has(id));
}

export function permissionsForFeatures(featureIds: string[]): string[] {
  const granted = new Set<string>();
  for (const id of parseFeatureIds(featureIds)) {
    const feature = ACCESS_FEATURES.find((item) => item.id === id);
    feature?.permissions.forEach((permission) => granted.add(permission));
  }
  return [...granted];
}

export function featureLabel(featureIds: string[]) {
  const names = parseFeatureIds(featureIds).map(
    (id) => ACCESS_FEATURES.find((feature) => feature.id === id)?.name || id,
  );
  return names.join(", ");
}

/** Logistics-only IDs stay scoped to work assigned to that person. */
export function roleForFeatures(featureIds: string[]): RoleType {
  const features = parseFeatureIds(featureIds);
  if (features.length > 0 && features.every((id) => id === "logistics" || id === "tasks")) {
    return "logistics";
  }
  return "custom";
}

export function featuresCreatorCanAssign(role: RoleType | undefined): string[] {
  if (role === "super_admin") return ACCESS_FEATURES.map((feature) => feature.id);
  if (role === "supervisor") {
    return ["tasks", "leads", "customers", "field_visits", "orders", "logistics"];
  }
  return [];
}

export function rolesCreatorCanAssign(role: RoleType | undefined): RoleType[] {
  if (role === "super_admin") {
    return ["super_admin", "sales", "supervisor", "accounts", "logistics"];
  }
  if (role === "supervisor") return ["sales", "logistics"];
  return [];
}

export function profileFromAuth(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): UserProfile | null {
  const role = user.user_metadata?.["role"];
  const features = parseFeatureIds(user.user_metadata?.["features"]);
  const typed =
    typeof role === "string" && role in ROLE_PERMISSIONS
      ? (role as RoleType)
      : features.length
        ? roleForFeatures(features)
        : null;
  if (!typed) return null;
  const name = String(user.user_metadata?.["full_name"] || user.email || "User");
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NA";
  return {
    id: user.id,
    name,
    email: user.email || "",
    phone: String(user.user_metadata?.["phone"] || ""),
    role: features.length ? roleForFeatures(features) : typed,
    roleName: features.length ? featureLabel(features) : ROLE_NAMES[typed],
    initials,
    company: String(user.user_metadata?.["company"] || "all"),
    permissions: features.length ? permissionsForFeatures(features) : [...ROLE_PERMISSIONS[typed]],
  };
}

export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  super_admin: ["*"],
  sales: [
    "orders.view",
    "orders.create",
    "leads.view",
    "leads.manage",
    "leads.convert",
    "customers.view",
    "customers.manage",
    "field_visits.view",
    "field_visits.schedule",
    "field_visits.conduct",
    "tasks.view",
    "tasks.manage",
    "inventory.view",
  ],
  supervisor: [
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.approve",
    "leads.view",
    "leads.manage",
    "leads.convert",
    "inventory.view",
    "inventory.adjust",
    "inventory.shortage_approve",
    "purchases.view",
    "purchases.create",
    "purchases.receive",
    "logistics.view",
    "tasks.view",
    "tasks.manage",
    "field_visits.view",
    "customers.view",
    "analytics.view",
  ],
  accounts: [
    "invoices.view",
    "invoices.generate",
    "payments.record",
    "orders.view",
    "tasks.view",
    "customers.view",
    "analytics.view",
  ],
  logistics: [
    "logistics.view",
    "logistics.dispatch",
    "logistics.deliver",
    "orders.view",
    "tasks.view",
    "customers.view",
  ],
  custom: [],
};

export const PERMISSION_LABELS: Record<string, { name: string; module: string }> = {
  "orders.view": { name: "View Orders", module: "Orders" },
  "orders.create": { name: "Create Orders", module: "Orders" },
  "orders.edit": { name: "Edit Orders", module: "Orders" },
  "orders.approve": { name: "Approve Orders", module: "Orders" },
  "inventory.view": { name: "View Inventory", module: "Inventory" },
  "inventory.adjust": { name: "Add / Adjust Stock", module: "Inventory" },
  "inventory.shortage_approve": { name: "Approve Stock Shortages", module: "Inventory" },
  "purchases.view": { name: "View Purchase Orders", module: "Procurement" },
  "purchases.create": { name: "Create Purchase Order", module: "Procurement" },
  "purchases.approve": { name: "Approve Purchase Order", module: "Procurement" },
  "purchases.receive": { name: "Receive Goods to Stock", module: "Procurement" },
  "invoices.view": { name: "View Invoices", module: "Finance" },
  "invoices.generate": { name: "Generate Invoices", module: "Finance" },
  "payments.record": { name: "Record Payments", module: "Finance" },
  "logistics.view": { name: "View Deliveries", module: "Logistics" },
  "logistics.dispatch": { name: "Assign & Dispatch Vehicles", module: "Logistics" },
  "logistics.deliver": { name: "Complete & Confirm Deliveries", module: "Logistics" },
  "leads.view": { name: "View Lead Pipeline", module: "CRM" },
  "leads.manage": { name: "Add & Manage Leads", module: "CRM" },
  "leads.convert": { name: "Convert Leads to Customers", module: "CRM" },
  "customers.view": { name: "View Customers", module: "CRM" },
  "customers.manage": { name: "Add & Edit Customers", module: "CRM" },
  "field_visits.view": { name: "View Field Visits", module: "Field Operations" },
  "field_visits.schedule": { name: "Schedule Field Visits", module: "Field Operations" },
  "field_visits.conduct": { name: "Log Visits & Record Audio/GPS", module: "Field Operations" },
  "tasks.view": { name: "View Tasks", module: "Work" },
  "tasks.manage": { name: "Assign & Create Tasks", module: "Work" },
  "analytics.view": { name: "View Analytics", module: "Analytics" },
  "credit.view": { name: "Credit Control", module: "Credit" },
  "admin.manage": { name: "System Administration", module: "Admin" },
  "audit.view": { name: "View Audit Trail", module: "Audit" },
};

/** Public demo user directory (no passwords). Used for role labels / switcher UI. */
export const SYSTEM_USERS: UserProfile[] = [
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Harshith (Owner)",
    email: "owner@avighna.com",
    phone: "+91 98450 55667",
    role: "super_admin",
    roleName: "Owner / Super Admin",
    initials: "HA",
    company: "all",
    permissions: ["*"],
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ravi Kumar",
    email: "sales@avighna.com",
    phone: "+91 98450 11223",
    role: "sales",
    roleName: "Sales Executive",
    initials: "RK",
    company: "asian",
    permissions: ROLE_PERMISSIONS.sales,
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Arun Nair",
    email: "supervisor@avighna.com",
    phone: "+91 98450 44556",
    role: "supervisor",
    roleName: "Warehouse Supervisor",
    initials: "AN",
    company: "atharva",
    permissions: ROLE_PERMISSIONS.supervisor,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Suresh Rao",
    email: "accounts@avighna.com",
    phone: "+91 98450 22334",
    role: "accounts",
    roleName: "Accounts Manager",
    initials: "SR",
    company: "avighna",
    permissions: ROLE_PERMISSIONS.accounts,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Mahesh Patel",
    email: "logistics@avighna.com",
    phone: "+91 98450 33445",
    role: "logistics",
    roleName: "Logistics Driver",
    initials: "MP",
    company: "ganesh",
    permissions: ROLE_PERMISSIONS.logistics,
  },
];

/** @deprecated passwords removed from public profile — use demo credential store when enabled */
export type SystemUserWithPassword = UserProfile & { defaultPassword?: string };

function demoCredentialStore(): Record<
  string,
  { role: RoleType; defaultPass: string; name: string }
> {
  if (!isDemoAuthEnabled()) return {};
  return {
    "admin@avighnya.local": { role: "super_admin", defaultPass: "admin123", name: "Super Admin" },
    "owner@avighnya.local": {
      role: "super_admin",
      defaultPass: "owner123",
      name: "Harshith (Owner)",
    },
    "sales@avighnya.local": { role: "sales", defaultPass: "sales123", name: "Ravi Kumar" },
    "accounts@avighnya.local": {
      role: "accounts",
      defaultPass: "accounts123",
      name: "Suresh Rao",
    },
    "supervisor@avighnya.local": {
      role: "supervisor",
      defaultPass: "super123",
      name: "Arun Nair",
    },
    "logistics@avighnya.local": {
      role: "logistics",
      defaultPass: "logistics123",
      name: "Mahesh Patel",
    },
    "ravi@avighnya.local": { role: "logistics", defaultPass: "driver123", name: "Ravi (Driver)" },
    "suresh@avighnya.local": {
      role: "logistics",
      defaultPass: "driver123",
      name: "Suresh (Driver)",
    },
  };
}

/** Demo aliases — empty in production unless VITE_ALLOW_DEMO_AUTH=true. */
export const DEMO_CREDENTIALS: Record<
  string,
  { role: RoleType; defaultPass: string; name: string }
> = new Proxy({} as Record<string, { role: RoleType; defaultPass: string; name: string }>, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") return undefined;
    return demoCredentialStore()[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(demoCredentialStore());
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop !== "string") return undefined;
    const value = demoCredentialStore()[prop];
    if (!value) return undefined;
    return { configurable: true, enumerable: true, value };
  },
});

// In-memory passwords for demo/local auth only (never populated in production builds).
const userPasswords: Record<string, string> = isDemoAuthEnabled()
  ? {
      "owner@avighna.com": "Password@123",
      "admin@avighnaone.com": "Password@123",
      "sales@avighna.com": "Password@123",
      "ravi.kumar@avighnaone.com": "Password@123",
      "supervisor@avighna.com": "Password@123",
      "arun.nair@avighnaone.com": "Password@123",
      "accounts@avighna.com": "Password@123",
      "suresh.rao@avighnaone.com": "Password@123",
      "logistics@avighna.com": "Password@123",
      "mahesh.patel@avighnaone.com": "Password@123",
      "admin@avighnya.local": "admin123",
      "owner@avighnya.local": "owner123",
      "sales@avighnya.local": "sales123",
      "accounts@avighnya.local": "accounts123",
      "supervisor@avighnya.local": "super123",
      "logistics@avighnya.local": "logistics123",
      "ravi@avighnya.local": "driver123",
      "suresh@avighnya.local": "driver123",
    }
  : {};

const PERMISSION_ALIASES: Record<string, string[]> = {
  "orders.view": ["sales.view", "quotations.view"],
  "sales.view": ["orders.view"],
  "quotations.view": ["orders.view"],
  "orders.create": ["sales.create", "quotations.create"],
  "sales.create": ["orders.create"],
  "quotations.create": ["orders.create"],
  "orders.edit": ["sales.edit", "quotations.edit"],
  "sales.edit": ["orders.edit"],
  "quotations.edit": ["orders.edit"],
  "invoices.generate": ["invoices.create"],
  "invoices.create": ["invoices.generate"],
  "payments.record": ["payments.create"],
  "payments.create": ["payments.record"],
  "field_visits.conduct": ["visits.create"],
  "visits.create": ["field_visits.conduct"],
  "field_visits.view": ["visits.view"],
  "visits.view": ["field_visits.view"],
  "field_visits.schedule": ["visits.schedule"],
  "visits.schedule": ["field_visits.schedule"],
  "inventory.adjust": ["inventory.edit"],
  "inventory.edit": ["inventory.adjust"],
  "leads.manage": ["leads.create", "leads.edit"],
  "customers.manage": ["customers.create", "customers.edit"],
};

export function hasUserPermission(user: UserProfile | null, permission: string): boolean {
  if (!user) return false;

  // 1. Explicit individual user override: Deny takes absolute precedence
  if (user.overrides?.deny?.includes(permission)) return false;

  // 2. Explicit individual user override: Grant takes precedence over default role limits
  if (user.overrides?.grant?.includes(permission)) return true;

  // 3. Super Admin universal access
  if (user.role === "super_admin" || user.permissions.includes("*")) return true;

  // 3b. Supervisor operations oversight for logistics queue view
  if (user.role === "supervisor" && permission === "logistics.view") {
    return true;
  }

  // 4. Direct check
  if (user.permissions.includes(permission)) return true;

  // 5. Wildcard check (e.g., "customers.*" grants "customers.view")
  const [targetPrefix] = permission.split(".");
  if (user.permissions.includes(`${targetPrefix}.*`)) return true;

  // 6. Canonical aliases check
  const aliases = PERMISSION_ALIASES[permission] || [];
  for (const alias of aliases) {
    if (user.overrides?.deny?.includes(alias)) return false;
    if (user.overrides?.grant?.includes(alias)) return true;
    if (user.permissions.includes(alias)) return true;
    const [aliasPrefix] = alias.split(".");
    if (user.permissions.includes(`${aliasPrefix}.*`)) return true;
  }

  return false;
}

/**
 * Convenient shorthand for hasUserPermission:
 * can(user, "orders.create")
 */
export const can = hasUserPermission;

export function authenticateUser(
  emailOrRole: string,
  password?: string,
): { user: UserProfile | null; error?: string } {
  if (!isDemoAuthEnabled()) {
    return {
      user: null,
      error: "No user found with the provided credentials.",
    };
  }

  const normalized = emailOrRole.trim().toLowerCase();
  const store = demoCredentialStore();

  // Match demo credential alias (@avighnya.local)
  const demoEntry = store[normalized];
  if (demoEntry) {
    const baseUser = SYSTEM_USERS.find((u) => u.role === demoEntry.role) || SYSTEM_USERS[0];
    if (!baseUser) {
      return { user: null, error: "System user not found." };
    }
    const expectedPass = userPasswords[normalized] || demoEntry.defaultPass;

    if (password === undefined || password !== expectedPass) {
      return { user: null, error: "Incorrect password. Please try again." };
    }

    return {
      user: {
        id: baseUser.id,
        name: demoEntry.name || baseUser.name,
        email: normalized,
        phone: baseUser.phone,
        role: demoEntry.role,
        roleName: baseUser.roleName,
        initials: (demoEntry.name || baseUser.name)
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        company: baseUser.company,
        permissions: [...baseUser.permissions],
      },
    };
  }

  // Match by role or email in SYSTEM_USERS (password required — no passwordless role switch)
  const found = SYSTEM_USERS.find(
    (u) =>
      u.email.toLowerCase() === normalized ||
      u.role.toLowerCase() === normalized ||
      u.name.toLowerCase().includes(normalized),
  );

  if (!found) {
    return { user: null, error: "No user found with the provided credentials." };
  }

  const validPass = userPasswords[found.email];
  if (!validPass || password === undefined || password !== validPass) {
    return { user: null, error: "Incorrect password. Please try again." };
  }

  return {
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
      phone: found.phone,
      role: found.role,
      roleName: found.roleName,
      initials: found.initials,
      company: found.company,
      permissions: [...found.permissions],
    },
  };
}

/** Passwordless role switch — DEV/demo only. */
export function authenticateAsRole(role: RoleType): { user: UserProfile | null; error?: string } {
  if (!isDemoAuthEnabled()) {
    return { user: null, error: "Role switching is disabled." };
  }
  const found = SYSTEM_USERS.find((u) => u.role === role);
  if (!found) return { user: null, error: "Unknown role." };
  return {
    user: {
      ...found,
      permissions: [...found.permissions],
    },
  };
}

export async function changeUserPassword(
  user: UserProfile,
  currentPass: string,
  newPass: string,
): Promise<{ success: boolean; message: string }> {
  if (!newPass || newPass.length < 6) {
    return { success: false, message: "New password must be at least 6 characters long." };
  }

  // Prefer Supabase Auth password change for real sessions.
  const { data: sessionData } = await supabase.auth.getUser();
  if (sessionData.user) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: sessionData.user.email || user.email,
      password: currentPass,
    });
    if (reauthError) {
      return { success: false, message: "Current password is incorrect." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return { success: false, message: error.message };
  } else if (isDemoAuthEnabled()) {
    const validPass = userPasswords[user.email];
    if (!validPass || currentPass !== validPass) {
      return { success: false, message: "Current password is incorrect." };
    }
    userPasswords[user.email] = newPass;
  } else {
    return { success: false, message: "Authentication required to change password." };
  }

  // Record audit log to Supabase
  try {
    await supabase.from("audit_logs").insert({
      user_name: user.name,
      company_id: user.company === "all" ? null : user.company,
      module: "security",
      action: "password_change",
      record_id: user.id,
      description: `User ${user.name} (${user.roleName}) successfully changed their account password.`,
    });
  } catch (err) {
    console.warn("Security audit log write notice:", err);
  }

  return { success: true, message: "Password updated successfully!" };
}
