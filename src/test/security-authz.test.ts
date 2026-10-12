import { describe, expect, it } from "vitest";
import { SYSTEM_USERS } from "@/lib/auth-service";
import { isDemoAuthEnabled, requirePermission, setDemoActor } from "@/lib/security";

describe("security authz", () => {
  it("enables demo auth under vitest", () => {
    expect(isDemoAuthEnabled()).toBe(true);
  });

  it("blocks order approval without permission", async () => {
    const sales = SYSTEM_USERS.find((u) => u.role === "sales")!;
    setDemoActor(sales);
    await expect(requirePermission("orders.approve")).rejects.toThrow(/Not authorized/);
    setDemoActor(SYSTEM_USERS.find((u) => u.role === "super_admin") ?? null);
  });

  it("does not treat display names as super-admin proof", async () => {
    const supervisor = SYSTEM_USERS.find((u) => u.role === "supervisor")!;
    setDemoActor(supervisor);
    // Supervisor can approve normal orders, but is not super_admin by name spoofing.
    expect(supervisor.role).toBe("supervisor");
    expect(supervisor.name.toLowerCase()).not.toContain("harshith");
    const actor = await requirePermission("orders.approve");
    expect(actor.role).not.toBe("super_admin");
    setDemoActor(SYSTEM_USERS.find((u) => u.role === "super_admin") ?? null);
  });
});
