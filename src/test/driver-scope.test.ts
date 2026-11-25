import { describe, expect, it } from "vitest";
import { rolesCreatorCanAssign } from "@/lib/auth-service";
import { scopeForDriver } from "@/lib/driver-scope";

describe("driver logins", () => {
  it("lets owner and supervisor assign fixed staff roles (accounts merged away)", () => {
    expect(rolesCreatorCanAssign("accounts")).toEqual([]);
    expect(rolesCreatorCanAssign("supervisor")).toEqual(
      expect.arrayContaining(["sales", "logistics", "supervisor"]),
    );
    expect(rolesCreatorCanAssign("supervisor")).not.toContain("accounts");
    expect(rolesCreatorCanAssign("super_admin")).toContain("supervisor");
    expect(rolesCreatorCanAssign("super_admin")).toEqual(
      expect.arrayContaining(["sales", "logistics", "supervisor"]),
    );
    expect(rolesCreatorCanAssign("super_admin")).not.toContain("accounts");
  });

  it("hides another driver's orders and collected revenue", () => {
    const scoped = scopeForDriver(
      { role: "logistics", name: "Suresh Driver" },
      {
        orders: [
          { id: "ORD-1", customer_name: "Nandini", assigned_driver: "Mahesh Patel" },
          {
            id: "ORD-2",
            customer_name: "Lakeside",
            assigned_driver: null,
            items_summary: "Malto Dextrin Powder · 50 kg · PO Ref: GI/PO/55/26-27",
          },
        ],
        deliveries: [
          { order_id: "ORD-2", driver_name: "Suresh Driver", vehicle_number: "KA-02-GH-4455" },
        ],
        invoices: [
          { id: "INV-1", order_id: "ORD-1" },
          { id: "INV-2", order_id: "ORD-2" },
        ],
        payments: [
          { invoice_id: "INV-1" },
          { invoice_id: "INV-2" },
        ],
        products: [
          { id: "P-1", name: "Malto Dextrin Powder", code: "MDP" },
          { id: "P-2", name: "Unrelated Starch", code: "ST" },
        ],
        purchaseOrders: [{ id: "GI/PO/55/26-27", product_name: "Malto Dextrin Powder" }],
      },
    );

    expect(scoped.orders?.map((order) => order.id)).toEqual(["ORD-2"]);
    expect(scoped.invoices?.map((invoice) => invoice.id)).toEqual(["INV-2"]);
    expect(scoped.payments?.map((payment) => payment.invoice_id)).toEqual(["INV-2"]);
    expect(scoped.products?.map((p) => p.id)).toEqual(["P-1"]);
    expect(scoped.purchaseOrders).toEqual([
      { id: "GI/PO/55/26-27", product_name: "Malto Dextrin Powder" },
    ]);
  });
});

