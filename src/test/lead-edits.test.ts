import { describe, expect, it } from "vitest";
import { canEditLead, leadEditCounts } from "@/lib/erp-service";

describe("lead edits", () => {
  it("lets the owner edit freely and sales or supervisor only twice", () => {
    const fresh = leadEditCounts("Notes: hello");
    expect(canEditLead("super_admin", fresh)).toBe(true);
    expect(canEditLead("sales", fresh)).toBe(true);
    expect(canEditLead("supervisor", fresh)).toBe(true);
    expect(canEditLead("accounts", fresh)).toBe(false);

    const used = leadEditCounts("Notes: hello [[lead-edits:sales=2|supervisor=1]]");
    expect(used).toEqual({ sales: 2, supervisor: 1 });
    expect(canEditLead("sales", used)).toBe(false);
    expect(canEditLead("supervisor", used)).toBe(true);
    expect(canEditLead("super_admin", used)).toBe(true);
  });
});
