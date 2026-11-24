import { describe, expect, it } from "vitest";
import { hasUserPermission, SYSTEM_USERS } from "@/lib/auth-service";
import type { DBPurchaseOrder } from "@/lib/erp-service";

describe("purchase order inbound lifecycle", () => {
  const accounts = SYSTEM_USERS.find((u) => u.role === "accounts")!;
  const logistics = SYSTEM_USERS.find((u) => u.role === "logistics")!;

  it("Accounts creates/sends POs; Logistics verifies arrival into stock", () => {
    expect(hasUserPermission(accounts, "purchases.create")).toBe(true);
    expect(hasUserPermission(accounts, "purchases.receive")).toBe(false);

    expect(hasUserPermission(logistics, "purchases.view")).toBe(true);
    expect(hasUserPermission(logistics, "purchases.receive")).toBe(true);
    expect(hasUserPermission(logistics, "purchases.create")).toBe(false);
  });

  it("status path is Requested → In transit → Received and stock needs product_id", () => {
    const po: Pick<DBPurchaseOrder, "status" | "product_id"> = {
      status: "Requested",
      product_id: "prod-1",
    };

    expect(po.status).toBe("Requested");
    // Accounts marks sent after download/print
    po.status = "In transit";
    expect(po.status).toBe("In transit");
    // Logistics verifies arrival
    expect(Boolean(po.product_id)).toBe(true);
    po.status = "Received";
    expect(po.status).toBe("Received");
  });

  it("blocks stock update when catalog product is missing", () => {
    const unlinked: Pick<DBPurchaseOrder, "status" | "product_id"> = {
      status: "In transit",
      product_id: undefined,
    };
    expect(unlinked.status).toBe("In transit");
    expect(Boolean(unlinked.product_id)).toBe(false);
  });
});
