import { describe, expect, it } from "vitest";
import {
  availableFromStock,
  orderCountsTowardOutbound,
  outboundOrderedQuantity,
  parseOrderItemsSummary,
  type DBOrder,
} from "@/lib/erp-service";

function order(partial: Partial<DBOrder> & Pick<DBOrder, "id" | "status" | "items_summary">): DBOrder {
  return {
    company_id: "avighna",
    customer_name: "Test Co",
    subtotal: 0,
    discount: 0,
    tax: 0,
    total_amount: 0,
    shortage_approved: true,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

const product = { name: "Zinc Oxide", code: "ZN-OX", company_id: "avighna" };

describe("inventory outbound from orders", () => {
  it("parses items_summary quantity", () => {
    expect(parseOrderItemsSummary("Zinc Oxide · 50 kg")).toEqual({
      productName: "Zinc Oxide",
      quantity: 50,
    });
  });

  it("releases outbound for cancelled, rejected, and delivered", () => {
    expect(orderCountsTowardOutbound("Pending approval")).toBe(true);
    expect(orderCountsTowardOutbound("Approved")).toBe(true);
    expect(orderCountsTowardOutbound("Partially Delivered")).toBe(true);
    expect(orderCountsTowardOutbound("Cancelled")).toBe(false);
    expect(orderCountsTowardOutbound("Rejected")).toBe(false);
    expect(orderCountsTowardOutbound("Delivered")).toBe(false);
  });

  it("aggregates active orders and computes available stock", () => {
    const orders = [
      order({ id: "1", status: "Pending approval", items_summary: "Zinc Oxide · 30 kg" }),
      order({ id: "2", status: "Approved", items_summary: "Zinc Oxide · 20 kg" }),
      order({ id: "3", status: "Delivered", items_summary: "Zinc Oxide · 40 kg" }),
      order({ id: "4", status: "Rejected", items_summary: "Zinc Oxide · 10 kg" }),
      order({ id: "5", status: "Approved", items_summary: "Other Product · 99 kg" }),
    ];
    const outbound = outboundOrderedQuantity(orders, product);
    expect(outbound).toBe(50);
    expect(availableFromStock(100, outbound)).toBe(50);
  });
});
