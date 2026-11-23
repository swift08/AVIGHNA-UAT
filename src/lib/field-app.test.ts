import { describe, expect, it } from "vitest";
import { FIELD_ROLES, isFieldAdminNavUrl, isFieldRole } from "./field-app";

describe("field-app roles", () => {
  it("accepts sales, logistics, and super_admin", () => {
    expect(isFieldRole("sales")).toBe(true);
    expect(isFieldRole("logistics")).toBe(true);
    expect(isFieldRole("super_admin")).toBe(true);
    expect(isFieldRole("accounts")).toBe(false);
    expect(FIELD_ROLES).toEqual(["sales", "logistics", "super_admin"]);
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
