import { describe, expect, it } from "vitest";
import { canManageStaff, staffPdfBytes, staffPdfName } from "@/lib/login-admin";

describe("staff admin", () => {
  it("lets only the owner manage employees", () => {
    expect(canManageStaff("super_admin")).toBe(true);
    expect(canManageStaff("supervisor")).toBe(false);
    expect(canManageStaff("sales")).toBe(false);
  });

  it("keeps stored files as pdf names", () => {
    expect(staffPdfName("../Licence scan.pdf")).toBe("Licence_scan.pdf");
    expect(staffPdfName("aadhaar")).toBe("aadhaar.pdf");
    const pdf = Buffer.from("%PDF-1.4 test").toString("base64");
    expect(staffPdfBytes(pdf).ok).toBe(true);
    expect(staffPdfBytes(Buffer.from("not a pdf").toString("base64")).ok).toBe(false);
  });
});