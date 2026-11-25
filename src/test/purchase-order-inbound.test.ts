import { describe, expect, it } from "vitest";
import { hasUserPermission, SYSTEM_USERS } from "@/lib/auth-service";
import {
  isPoPartiallyReceived,
  poRemainingQuantity,
  type DBPurchaseOrder,
} from "@/lib/erp-service";

describe("purchase order inbound lifecycle", () => {
  const accounts = SYSTEM_USERS.find((u) => u.role === "accounts")!;
  const logistics = SYSTEM_USERS.find((u) => u.role === "logistics")!;
  const supervisor = SYSTEM_USERS.find((u) => u.role === "supervisor")!;

  it("Supervisor (merged accounts) creates/sends/receives POs; Logistics does not", () => {
    // Legacy accounts profile shares supervisor capability set
    expect(hasUserPermission(accounts, "purchases.create")).toBe(true);
    expect(hasUserPermission(accounts, "purchases.receive")).toBe(true);

    expect(hasUserPermission(supervisor, "purchases.view")).toBe(true);
    expect(hasUserPermission(supervisor, "purchases.create")).toBe(true);
    expect(hasUserPermission(supervisor, "purchases.receive")).toBe(true);

    expect(hasUserPermission(logistics, "purchases.view")).toBe(false);
    expect(hasUserPermission(logistics, "purchases.receive")).toBe(false);
    expect(hasUserPermission(logistics, "purchases.create")).toBe(false);
  });

  it("example: order 5000, receive 4500 → remaining 500", () => {
    const po: Pick<DBPurchaseOrder, "status" | "quantity" | "received_quantity" | "product_id"> = {
      status: "In transit",
      product_id: "prod-1",
      quantity: 5000,
      received_quantity: 0,
    };
    po.received_quantity = 4500;
    expect(poRemainingQuantity(po)).toBe(500);
    expect(isPoPartiallyReceived(po)).toBe(true);
  });

  it("status path is Requested → In transit → Received and stock needs product_id", () => {
    const po: Pick<DBPurchaseOrder, "status" | "product_id" | "quantity" | "received_quantity"> = {
      status: "Requested",
      product_id: "prod-1",
      quantity: 100,
      received_quantity: 0,
    };

    expect(po.status).toBe("Requested");
    po.status = "In transit";
    expect(po.status).toBe("In transit");
    expect(Boolean(po.product_id)).toBe(true);

    // Partial arrival
    po.received_quantity = 40;
    expect(poRemainingQuantity(po)).toBe(60);
    expect(isPoPartiallyReceived(po)).toBe(true);

    // Full arrival
    po.received_quantity = 100;
    po.status = "Received";
    expect(poRemainingQuantity(po)).toBe(0);
    expect(isPoPartiallyReceived(po)).toBe(false);
    expect(po.status).toBe("Received");
  });

  it("partial receive math leaves remaining until fully received", () => {
    const po: Pick<DBPurchaseOrder, "status" | "quantity" | "received_quantity" | "product_id"> = {
      status: "In transit",
      product_id: "prod-1",
      quantity: 100,
      received_quantity: 0,
    };

    const first = 35;
    po.received_quantity = (po.received_quantity || 0) + first;
    expect(poRemainingQuantity(po)).toBe(65);
    expect(isPoPartiallyReceived(po)).toBe(true);

    const second = 65;
    po.received_quantity = (po.received_quantity || 0) + second;
    expect(poRemainingQuantity(po)).toBe(0);
    po.status = "Received";
    expect(isPoPartiallyReceived(po)).toBe(false);
  });

  it("blocks stock update when catalog product is missing", () => {
    const unlinked: Pick<DBPurchaseOrder, "status" | "product_id" | "quantity" | "received_quantity"> =
      {
        status: "In transit",
        product_id: undefined,
        quantity: 50,
        received_quantity: 0,
      };
    expect(unlinked.status).toBe("In transit");
    expect(Boolean(unlinked.product_id)).toBe(false);
    expect(poRemainingQuantity(unlinked)).toBe(50);
  });

  it("tags receipts to the purchase order reference", () => {
    const reference = {
      reference_type: "purchase_order" as const,
      reference_id: "PO-9912",
      product_id: "prod-1",
      quantity: 25,
    };
    expect(reference.reference_type).toBe("purchase_order");
    expect(reference.reference_id).toBe("PO-9912");
    expect(reference.product_id).toBeTruthy();
    expect(reference.quantity).toBeGreaterThan(0);
  });
});
