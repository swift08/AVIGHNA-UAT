import { describe, it, expect } from "vitest";
import {
  SYSTEM_USERS,
  authenticateUser,
  authenticateAsRole,
  changeUserPassword,
  featuresCreatorCanAssign,
  hasUserPermission,
  permissionsForFeatures,
  profileFromAuth,
  roleForFeatures,
  normalizeStaffRole,
  type RoleType,
} from "@/lib/auth-service";

describe("Avighna One — Authentication, Security & Granular Permissions Audit", () => {
  it("defines credentials and profiles for all business roles", () => {
    expect(SYSTEM_USERS.length).toBe(5);

    const roles = SYSTEM_USERS.map((u) => u.role);
    expect(roles).toContain("super_admin");
    expect(roles).toContain("sales");
    expect(roles).toContain("supervisor");
    expect(roles).toContain("accounts"); // legacy profile — normalizes to supervisor on login
    expect(roles).toContain("logistics");

    SYSTEM_USERS.forEach((user) => {
      expect((user as { defaultPassword?: string }).defaultPassword).toBeUndefined();
      expect(user.email).toBeTruthy();
      expect(user.initials).toBeTruthy();
      expect(user.roleName).toBeTruthy();
    });
  });

  describe("Role Permissions Matrix Coverage", () => {
    it("super_admin has universal permission (*)", () => {
      const owner = SYSTEM_USERS.find((u) => u.role === "super_admin")!;
      expect(hasUserPermission(owner, "orders.create")).toBe(true);
      expect(hasUserPermission(owner, "orders.approve")).toBe(true);
      expect(hasUserPermission(owner, "invoices.generate")).toBe(true);
      expect(hasUserPermission(owner, "payments.record")).toBe(true);
      expect(hasUserPermission(owner, "logistics.dispatch")).toBe(true);
      expect(hasUserPermission(owner, "admin.manage")).toBe(true);
      expect(hasUserPermission(owner, "non_existent_perm")).toBe(true);
    });

    it("sales role can create orders, manage leads, customers, field visits, and collect payments, but cannot approve orders or generate invoices", () => {
      const sales = SYSTEM_USERS.find((u) => u.role === "sales")!;
      expect(hasUserPermission(sales, "orders.create")).toBe(true);
      expect(hasUserPermission(sales, "leads.manage")).toBe(true);
      expect(hasUserPermission(sales, "leads.convert")).toBe(true);
      expect(hasUserPermission(sales, "customers.manage")).toBe(true);
      expect(hasUserPermission(sales, "field_visits.conduct")).toBe(true);
      expect(hasUserPermission(sales, "tasks.view")).toBe(true);
      expect(hasUserPermission(sales, "tasks.manage")).toBe(false);
      expect(hasUserPermission(sales, "invoices.view")).toBe(true);
      expect(hasUserPermission(sales, "payments.record")).toBe(true);

      expect(hasUserPermission(sales, "orders.approve")).toBe(false);
      expect(hasUserPermission(sales, "invoices.generate")).toBe(false);
      expect(hasUserPermission(sales, "finance.view_amounts")).toBe(false);
      expect(hasUserPermission(sales, "logistics.dispatch")).toBe(false);
      expect(hasUserPermission(sales, "admin.manage")).toBe(false);
    });

    it("supervisor has former supervisor + accounts features (merged role)", () => {
      const supervisor = SYSTEM_USERS.find((u) => u.role === "supervisor")!;
      expect(hasUserPermission(supervisor, "orders.approve")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.adjust")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.shortage_approve")).toBe(true);
      expect(hasUserPermission(supervisor, "field_visits.view")).toBe(true);
      expect(hasUserPermission(supervisor, "analytics.view")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.view")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.create")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.receive")).toBe(true);
      expect(hasUserPermission(supervisor, "invoices.view")).toBe(true);
      expect(hasUserPermission(supervisor, "invoices.generate")).toBe(true);
      expect(hasUserPermission(supervisor, "payments.record")).toBe(true);
      expect(hasUserPermission(supervisor, "finance.view_amounts")).toBe(true);
      expect(hasUserPermission(supervisor, "suppliers.view")).toBe(true);
      expect(hasUserPermission(supervisor, "suppliers.manage")).toBe(true);

      expect(hasUserPermission(supervisor, "logistics.dispatch")).toBe(false);
      expect(hasUserPermission(supervisor, "admin.manage")).toBe(false);
      expect(hasUserPermission(supervisor, "field_visits.conduct")).toBe(false);
      expect(hasUserPermission(supervisor, "field_visits.schedule")).toBe(false);
    });

    it("legacy accounts profile shares supervisor permission set", () => {
      const accounts = SYSTEM_USERS.find((u) => u.role === "accounts")!;
      expect(normalizeStaffRole("accounts")).toBe("supervisor");
      expect(hasUserPermission(accounts, "invoices.generate")).toBe(true);
      expect(hasUserPermission(accounts, "payments.record")).toBe(true);
      expect(hasUserPermission(accounts, "finance.view_amounts")).toBe(true);
      expect(hasUserPermission(accounts, "purchases.create")).toBe(true);
      expect(hasUserPermission(accounts, "purchases.receive")).toBe(true);
      expect(hasUserPermission(accounts, "orders.approve")).toBe(true);
      expect(hasUserPermission(accounts, "inventory.adjust")).toBe(true);
    });

    it("supervisor and super admin can view revenue amounts; sales/logistics cannot", () => {
      const owner = SYSTEM_USERS.find((u) => u.role === "super_admin")!;
      const accounts = SYSTEM_USERS.find((u) => u.role === "accounts")!;
      const sales = SYSTEM_USERS.find((u) => u.role === "sales")!;
      const supervisor = SYSTEM_USERS.find((u) => u.role === "supervisor")!;
      const logistics = SYSTEM_USERS.find((u) => u.role === "logistics")!;

      expect(hasUserPermission(owner, "finance.view_amounts")).toBe(true);
      expect(hasUserPermission(accounts, "finance.view_amounts")).toBe(true);
      expect(hasUserPermission(supervisor, "finance.view_amounts")).toBe(true);
      expect(hasUserPermission(sales, "finance.view_amounts")).toBe(false);
      expect(hasUserPermission(logistics, "finance.view_amounts")).toBe(false);
    });

    it("logistics role handles deliveries only — no purchases review or receive", () => {
      const logistics = SYSTEM_USERS.find((u) => u.role === "logistics")!;
      expect(hasUserPermission(logistics, "logistics.view")).toBe(true);
      expect(hasUserPermission(logistics, "logistics.dispatch")).toBe(true);
      expect(hasUserPermission(logistics, "logistics.deliver")).toBe(true);
      expect(hasUserPermission(logistics, "purchases.view")).toBe(false);
      expect(hasUserPermission(logistics, "purchases.receive")).toBe(false);

      expect(hasUserPermission(logistics, "purchases.create")).toBe(false);
      expect(hasUserPermission(logistics, "invoices.generate")).toBe(false);
      expect(hasUserPermission(logistics, "payments.record")).toBe(false);
      expect(hasUserPermission(logistics, "orders.approve")).toBe(false);
    });
  });

  describe("Authentication Flow & Login Validation", () => {
    it("successfully authenticates by email and correct password", () => {
      const res = authenticateUser("owner@avighna.com", "Password@123");
      expect(res.user).not.toBeNull();
      expect(res.user?.role).toBe("super_admin");
      expect(res.error).toBeUndefined();
    });

    it("authenticates by role shortcut for rapid switching", () => {
      const res = authenticateAsRole("supervisor");
      expect(res.user).not.toBeNull();
      expect(res.user?.name).toBe("Arun Nair");
      expect(res.user?.role).toBe("supervisor");
    });

    it("maps legacy accounts role switch to supervisor", () => {
      const res = authenticateAsRole("accounts");
      expect(res.user).not.toBeNull();
      expect(res.user?.role).toBe("supervisor");
    });

    it("fails with incorrect password", () => {
      const res = authenticateUser("owner@avighna.com", "WrongPassword!");
      expect(res.user).toBeNull();
      expect(res.error).toContain("Incorrect password");
    });

    it("returns null for non-existent user", () => {
      const res = authenticateUser("nonexistent@user.com", "Password@123");
      expect(res.user).toBeNull();
      expect(res.error).toContain("No user found");
    });
  });

  describe("Security: Change Password Workflow", () => {
    it("rejects password shorter than 6 characters", async () => {
      const user = SYSTEM_USERS[1]!; // Ravi Kumar
      const res = await changeUserPassword(user, "Password@123", "123");
      expect(res.success).toBe(false);
      expect(res.message).toContain("at least 6 characters");
    });

    it("rejects when current password does not match", async () => {
      const user = SYSTEM_USERS[1]!;
      const res = await changeUserPassword(user, "WrongCurrentPass", "NewSecretPass@123");
      expect(res.success).toBe(false);
      expect(res.message).toContain("Current password is incorrect");
    });

    it("successfully updates password when credentials are valid", async () => {
      const user = SYSTEM_USERS[1]!;
      const res = await changeUserPassword(user, "Password@123", "NewSecurePass@2026");
      expect(res.success).toBe(true);
      expect(res.message).toContain("Password updated successfully");

      const authNew = authenticateUser(user.email, "NewSecurePass@2026");
      expect(authNew.user).not.toBeNull();
      expect(authNew.user?.id).toBe(user.id);
    });
  });

  describe("Avighna Local Demo Role Credentials Verification", () => {
    it("authenticates role accounts; accounts@ becomes supervisor", () => {
      const rolesToTest: Array<{ email: string; pass: string; role: RoleType }> = [
        { email: "admin@avighnya.local", pass: "admin123", role: "super_admin" },
        { email: "owner@avighnya.local", pass: "owner123", role: "super_admin" },
        { email: "sales@avighnya.local", pass: "sales123", role: "sales" },
        { email: "accounts@avighnya.local", pass: "accounts123", role: "supervisor" },
        { email: "supervisor@avighnya.local", pass: "super123", role: "supervisor" },
        { email: "logistics@avighnya.local", pass: "logistics123", role: "logistics" },
        { email: "ravi@avighnya.local", pass: "driver123", role: "logistics" },
        { email: "suresh@avighnya.local", pass: "driver123", role: "logistics" },
      ];

      for (const item of rolesToTest) {
        const res = authenticateUser(item.email, item.pass);
        expect(res.user, `Failed login for ${item.email}`).not.toBeNull();
        expect(res.user?.role).toBe(item.role);
        expect(res.error).toBeUndefined();
      }
    });

    it("verifies aliased permission codes work for merged supervisor", () => {
      const sales = authenticateUser("sales@avighnya.local", "sales123").user!;
      expect(hasUserPermission(sales, "sales.create")).toBe(true);
      expect(hasUserPermission(sales, "visits.create")).toBe(true);
      expect(hasUserPermission(sales, "invoices.create")).toBe(false);
      expect(hasUserPermission(sales, "orders.approve")).toBe(false);

      const accounts = authenticateUser("accounts@avighnya.local", "accounts123").user!;
      expect(accounts.role).toBe("supervisor");
      expect(hasUserPermission(accounts, "invoices.create")).toBe(true);
      expect(hasUserPermission(accounts, "payments.create")).toBe(true);
      expect(hasUserPermission(accounts, "orders.approve")).toBe(true);

      const supervisor = authenticateUser("supervisor@avighnya.local", "super123").user!;
      expect(hasUserPermission(supervisor, "orders.approve")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.edit")).toBe(true);
      expect(hasUserPermission(supervisor, "invoices.create")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.create")).toBe(true);
    });

    it("keeps a sticky base role while features overlay permissions", () => {
      expect(permissionsForFeatures(["leads", "invoices"])).toEqual(
        expect.arrayContaining(["leads.manage", "invoices.generate", "payments.record"]),
      );
      expect(permissionsForFeatures(["leads"])).not.toContain("invoices.generate");
      expect(roleForFeatures(["logistics"])).toBe("logistics");
      expect(roleForFeatures(["leads", "orders"])).toBe("sales");
      expect(featuresCreatorCanAssign("supervisor").length).toBeGreaterThan(0);
      expect(featuresCreatorCanAssign("supervisor")).not.toContain("administration");
      expect(featuresCreatorCanAssign("super_admin")).toContain("administration");

      const salesWithExtra = profileFromAuth({
        id: "user-1",
        email: "sales@example.com",
        user_metadata: {
          role: "sales",
          full_name: "Sales User",
          features: ["leads", "orders", "invoices"],
        },
      });
      expect(salesWithExtra?.role).toBe("sales");
      expect(salesWithExtra?.permissions).toEqual(
        expect.arrayContaining(["leads.manage", "invoices.generate"]),
      );

      const legacyAccounts = profileFromAuth({
        id: "user-2",
        email: "accounts@example.com",
        user_metadata: {
          role: "accounts",
          full_name: "Legacy Accounts",
        },
      });
      expect(legacyAccounts?.role).toBe("supervisor");
      expect(legacyAccounts?.permissions).toEqual(
        expect.arrayContaining(["invoices.generate", "orders.approve", "purchases.receive"]),
      );
    });
  });
});
