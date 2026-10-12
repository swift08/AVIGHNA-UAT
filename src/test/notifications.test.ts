import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchNotifications,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  type DBNotification,
} from "@/lib/notification-service";

describe("Notification System Unit Tests", () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it("creates a new notification with proper structure and fallback cache", async () => {
    const notif = await createNotification({
      title: "New Order #ORD-9999",
      message: "Order placed for Asian Apex & Co. (₹50,000)",
      type: "approval",
      company_id: "asian",
      reference_type: "order",
      reference_id: "ORD-9999",
      showToast: false,
    });

    expect(notif).toBeDefined();
    expect(notif.title).toBe("New Order #ORD-9999");
    expect(notif.type).toBe("approval");
    expect(notif.is_read).toBe(false);
    expect(notif.company_id).toBe("asian");

    const all = await fetchNotifications("asian");
    expect(all.some((n) => n.id === notif.id)).toBe(true);
  });

  it("filters notifications by company and includes global alerts", async () => {
    await createNotification({
      title: "Asian Apex Order",
      message: "Test Asian Apex",
      type: "info",
      company_id: "asian",
      showToast: false,
    });

    await createNotification({
      title: "Avighna Order",
      message: "Test Avighna",
      type: "info",
      company_id: "avighna",
      showToast: false,
    });

    await createNotification({
      title: "Global Alert",
      message: "System Maintenance Notice",
      type: "info",
      company_id: null,
      showToast: false,
    });

    const asianNotifs = await fetchNotifications("asian");
    expect(asianNotifs.some((n) => n.title === "Asian Apex Order")).toBe(true);
    expect(asianNotifs.some((n) => n.title === "Global Alert")).toBe(true);
    expect(asianNotifs.some((n) => n.title === "Avighna Order")).toBe(false);

    const allCompaniesNotifs = await fetchNotifications("all");
    expect(allCompaniesNotifs.some((n) => n.title === "Asian Apex Order")).toBe(true);
    expect(allCompaniesNotifs.some((n) => n.title === "Avighna Order")).toBe(true);
  });

  it("marks a notification as read and computes unread count correctly", async () => {
    const notif = await createNotification({
      title: "Stock Shortage Warning",
      message: "Milk powder is low on stock",
      type: "shortage",
      company_id: "asian",
      showToast: false,
    });

    expect(notif.is_read).toBe(false);

    await markNotificationAsRead(notif.id);

    const updated = await fetchNotifications("asian");
    const found = updated.find((n) => n.id === notif.id);
    expect(found?.is_read).toBe(true);
  });

  it("marks all notifications as read in bulk", async () => {
    await createNotification({
      title: "Notice 1",
      message: "Msg 1",
      company_id: "asian",
      showToast: false,
    });
    await createNotification({
      title: "Notice 2",
      message: "Msg 2",
      company_id: "asian",
      showToast: false,
    });

    let current = await fetchNotifications("asian");
    const unreadBefore = current.filter((n) => !n.is_read).length;
    expect(unreadBefore).toBeGreaterThanOrEqual(2);

    await markAllNotificationsAsRead("asian");

    current = await fetchNotifications("asian");
    const unreadAfter = current.filter((n) => !n.is_read).length;
    expect(unreadAfter).toBe(0);
  });

  it("deletes a single notification", async () => {
    const notif = await createNotification({
      title: "Temporary Alert",
      message: "To be deleted",
      company_id: "asian",
      showToast: false,
    });

    await deleteNotification(notif.id);

    const list = await fetchNotifications("asian");
    expect(list.some((n) => n.id === notif.id)).toBe(false);
  });

  it("clears all notifications for the current workspace", async () => {
    await createNotification({
      title: "Alert 1",
      message: "Msg 1",
      company_id: "asian",
      showToast: false,
    });

    await clearAllNotifications("asian");

    const list = await fetchNotifications("asian");
    expect(list.length).toBe(0);
  });
});
