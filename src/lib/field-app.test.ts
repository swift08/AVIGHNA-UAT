import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type UserProfile } from "./auth-service";
import { FIELD_ROLES, canUseFieldApp, isFieldAdminNavUrl, isFieldRole } from "./field-app";

function stub(role: UserProfile["role"], permissions: string[]): UserProfile {
  return {
    id: "1",
    name: "Test",
    email: "t@x.com",
    role,
    roleName: role,
    initials: "T",
    company: "all",
    permissions,
  };
}

describe("field-app roles", () => {
  it("accepts sales, logistics, and super_admin", () => {
    expect(isFieldRole("sales")).toBe(true);
    expect(isFieldRole("logistics")).toBe(true);
    expect(isFieldRole("super_admin")).toBe(true);
    expect(isFieldRole("accounts")).toBe(false);
    expect(FIELD_ROLES).toEqual(["sales", "logistics", "supervisor", "super_admin"]);
  });

  it("allows custom users with field visit or logistics permissions", () => {
    expect(canUseFieldApp(stub("custom", ["field_visits.conduct"]))).toBe(true);
    expect(canUseFieldApp(stub("custom", ["logistics.deliver"]))).toBe(true);
    expect(canUseFieldApp(stub("custom", ["invoices.view"]))).toBe(false);
    expect(canUseFieldApp(stub("sales", [...ROLE_PERMISSIONS.sales]))).toBe(true);
  });

  it("limits super-admin field nav to orders and field visits", () => {
    expect(isFieldAdminNavUrl("/orders")).toBe(true);
    expect(isFieldAdminNavUrl("/orders/abc")).toBe(true);
    expect(isFieldAdminNavUrl("/field-visits")).toBe(true);
    expect(isFieldAdminNavUrl("/field-visits/abc")).toBe(true);
    expect(isFieldAdminNavUrl("/administration")).toBe(false);
    expect(isFieldAdminNavUrl("/")).toBe(false);
    expect(isFieldAdminNavUrl("/inventory")).toBe(false);
  });
});
