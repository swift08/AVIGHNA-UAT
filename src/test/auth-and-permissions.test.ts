import { describe, it, expect } from "vitest";
import {
  SYSTEM_USERS,
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  authenticateUser,
  authenticateAsRole,
  changeUserPassword,
  hasUserPermission,
  can,
  type RoleType,
} from "@/lib/auth-service";

describe("Avighna One — Authentication, Security & Granular Permissions Audit", () => {
  it("defines credentials and profiles for all 5 business roles", () => {
    expect(SYSTEM_USERS.length).toBe(5);

    const roles = SYSTEM_USERS.map((u) => u.role);
    expect(roles).toContain("super_admin");
    expect(roles).toContain("sales");
    expect(roles).toContain("supervisor");
    expect(roles).toContain("accounts");
    expect(roles).toContain("logistics");

    // Passwords are not exposed on public profiles (demo store only).
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

    it("sales role can create orders, manage leads, customers, and field visits, but cannot approve orders or generate invoices", () => {
      const sales = SYSTEM_USERS.find((u) => u.role === "sales")!;
      expect(hasUserPermission(sales, "orders.create")).toBe(true);
      expect(hasUserPermission(sales, "leads.manage")).toBe(true);
      expect(hasUserPermission(sales, "leads.convert")).toBe(true);
      expect(hasUserPermission(sales, "customers.manage")).toBe(true);
      expect(hasUserPermission(sales, "field_visits.conduct")).toBe(true);
      expect(hasUserPermission(sales, "tasks.manage")).toBe(true);

      // Must NOT have supervisor or accounts or admin permissions
      expect(hasUserPermission(sales, "orders.approve")).toBe(false);
      expect(hasUserPermission(sales, "invoices.generate")).toBe(false);
      expect(hasUserPermission(sales, "payments.record")).toBe(false);
      expect(hasUserPermission(sales, "logistics.dispatch")).toBe(false);
      expect(hasUserPermission(sales, "admin.manage")).toBe(false);
    });

    it("supervisor role can approve orders, adjust inventory, and manage purchases, but cannot generate invoices or dispatch", () => {
      const supervisor = SYSTEM_USERS.find((u) => u.role === "supervisor")!;
      expect(hasUserPermission(supervisor, "orders.approve")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.adjust")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.shortage_approve")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.create")).toBe(true);
      expect(hasUserPermission(supervisor, "purchases.receive")).toBe(true);

      // Must NOT have accounts or logistics permissions
      expect(hasUserPermission(supervisor, "invoices.generate")).toBe(false);
      expect(hasUserPermission(supervisor, "payments.record")).toBe(false);
      expect(hasUserPermission(supervisor, "logistics.dispatch")).toBe(false);
      expect(hasUserPermission(supervisor, "admin.manage")).toBe(false);
    });

    it("accounts role can view & generate invoices and record payments, but cannot approve orders or dispatch logistics", () => {
      const accounts = SYSTEM_USERS.find((u) => u.role === "accounts")!;
      expect(hasUserPermission(accounts, "invoices.view")).toBe(true);
      expect(hasUserPermission(accounts, "invoices.generate")).toBe(true);
      expect(hasUserPermission(accounts, "payments.record")).toBe(true);

      // Must NOT have operations actions
      expect(hasUserPermission(accounts, "orders.approve")).toBe(false);
      expect(hasUserPermission(accounts, "inventory.adjust")).toBe(false);
      expect(hasUserPermission(accounts, "purchases.receive")).toBe(false);
      expect(hasUserPermission(accounts, "logistics.dispatch")).toBe(false);
    });

    it("logistics role can view deliveries, dispatch vehicles, and deliver goods, but cannot alter financials or approve stock", () => {
      const logistics = SYSTEM_USERS.find((u) => u.role === "logistics")!;
      expect(hasUserPermission(logistics, "logistics.view")).toBe(true);
      expect(hasUserPermission(logistics, "logistics.dispatch")).toBe(true);
      expect(hasUserPermission(logistics, "logistics.deliver")).toBe(true);

      // Must NOT have accounts or order approval actions
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

      // Verify user can now authenticate with the new password
      const authNew = authenticateUser(user.email, "NewSecurePass@2026");
      expect(authNew.user).not.toBeNull();
      expect(authNew.user?.id).toBe(user.id);
    });
  });

  describe("Avighna Local Demo Role Credentials Verification", () => {
    it("authenticates all five role accounts using exact specs", () => {
      const rolesToTest = [
        { email: "admin@avighnya.local", pass: "admin123", role: "super_admin" },
        { email: "owner@avighnya.local", pass: "owner123", role: "super_admin" },
        { email: "sales@avighnya.local", pass: "sales123", role: "sales" },
        { email: "accounts@avighnya.local", pass: "accounts123", role: "accounts" },
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

    it("verifies aliased permission codes work seamlessly across specs", () => {
      const sales = authenticateUser("sales@avighnya.local", "sales123").user!;
      expect(hasUserPermission(sales, "sales.create")).toBe(true);
      expect(hasUserPermission(sales, "visits.create")).toBe(true);
      expect(hasUserPermission(sales, "invoices.create")).toBe(false);
      expect(hasUserPermission(sales, "orders.approve")).toBe(false);

      const accounts = authenticateUser("accounts@avighnya.local", "accounts123").user!;
      expect(hasUserPermission(accounts, "invoices.create")).toBe(true);
      expect(hasUserPermission(accounts, "payments.create")).toBe(true);
      expect(hasUserPermission(accounts, "orders.approve")).toBe(false);

      const supervisor = authenticateUser("supervisor@avighnya.local", "super123").user!;
      expect(hasUserPermission(supervisor, "orders.approve")).toBe(true);
      expect(hasUserPermission(supervisor, "inventory.edit")).toBe(true);
      expect(hasUserPermission(supervisor, "invoices.create")).toBe(false);
      // Supervisor cannot approve purchases (Owner gate)
      expect(hasUserPermission(supervisor, "purchases.approve")).toBe(false);
    });

    it("enforces effective permissions with individual user overrides (can helper)", () => {
      const sales = authenticateUser("sales@avighnya.local", "sales123").user!;

      // Default: Sales cannot approve orders
      expect(can(sales, "orders.approve")).toBe(false);

      // Grant override: specific Sales user given orders.approve
      sales.overrides = { grant: ["orders.approve"] };
      expect(can(sales, "orders.approve")).toBe(true);

      // Deny override: specific user denied orders.create despite sales role
      sales.overrides = { deny: ["orders.create"] };
      expect(can(sales, "orders.create")).toBe(false);
    });
  });
});
