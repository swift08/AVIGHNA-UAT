import { describe, expect, it } from "vitest";
import { rolesCreatorCanAssign } from "@/lib/auth-service";
import { scopeForDriver } from "@/lib/driver-scope";

describe("driver logins", () => {
  it("lets a supervisor create only sales and logistics logins", () => {
    expect(rolesCreatorCanAssign("supervisor").sort()).toEqual(["logistics", "sales"]);
    expect(rolesCreatorCanAssign("accounts")).toEqual([]);
    expect(rolesCreatorCanAssign("super_admin")).toContain("supervisor");
  });

  it("hides another driver's orders and collected revenue", () => {
    const scoped = scopeForDriver(
      { role: "logistics", name: "Suresh Driver" },
      {
        orders: [
          { id: "ORD-1", customer_name: "Nandini", assigned_driver: "Mahesh Patel" },
          { id: "ORD-2", customer_name: "Lakeside", assigned_driver: null },
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
      },
    );

    expect(scoped.orders?.map((order) => order.id)).toEqual(["ORD-2"]);
    expect(scoped.invoices?.map((invoice) => invoice.id)).toEqual(["INV-2"]);
    expect(scoped.payments?.map((payment) => payment.invoice_id)).toEqual(["INV-2"]);
  });
});
