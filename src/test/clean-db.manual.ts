import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase";

describe("Database Cleanup — Zero Dummy Data Reset", () => {
  it("deletes all business transaction records and verifies 0 rows across all tables", async () => {
    // 1. Foreign-key ordered deletion
    await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("field_visits").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("purchase_orders")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("inventory_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Count verification for each table
    const tables = [
      "payments",
      "invoices",
      "deliveries",
      "order_items",
      "orders",
      "field_visits",
      "leads",
      "customers",
      "tasks",
      "products",
      "purchase_orders",
      "inventory_logs",
      "audit_logs",
      "notifications",
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      expect(error, `Error querying ${table}`).toBeNull();
      expect(count, `Table ${table} still has records`).toBe(0);
    }

    // 3. System tables verification (must remain intact)
    const { count: companyCount } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true });
    expect(companyCount).toBe(4);

    const { count: roleCount } = await supabase
      .from("roles")
      .select("*", { count: "exact", head: true });
    expect(roleCount).toBe(5);

    const { count: permCount } = await supabase
      .from("permissions")
      .select("*", { count: "exact", head: true });
    expect(permCount).toBe(31);
  }, 30000);
});
