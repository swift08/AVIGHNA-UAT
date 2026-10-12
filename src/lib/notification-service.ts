import { supabase } from "./supabase";
import { toast } from "sonner";
import { type CompanyId } from "./workspace-data";

export interface DBNotification {
  id: string;
  user_id?: string | null;
  company_id?: string | null;
  title: string;
  message: string;
  type: "info" | "approval" | "shortage" | "dispatch" | "task" | "delivery";
  reference_type?:
    "order" | "invoice" | "product" | "visit" | "lead" | "task" | "delivery" | "customer" | null;
  reference_id?: string | null;
  is_read: boolean;
  created_at: string;
}

const STORAGE_KEY = "avighna_notifications_cache";

function getCachedNotifications(): DBNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setCachedNotifications(items: DBNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {
    // Ignore storage write failure (e.g. quota exceeded or disabled in private browsing)
  }
}

export function notifyClientUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("avighna:notifications_updated"));
  }
}

/**
 * Fetch notifications from Supabase with fallback to local cache
 */
export async function fetchNotifications(companyId?: CompanyId): Promise<DBNotification[]> {
  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (companyId && companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn("fetchNotifications warning:", error?.message);
      return filterByCompany(getCachedNotifications(), companyId);
    }

    const list = data as DBNotification[];
    setCachedNotifications(list);
    return filterByCompany(list, companyId);
  } catch (err) {
    console.warn("fetchNotifications exception:", err);
    return filterByCompany(getCachedNotifications(), companyId);
  }
}

function filterByCompany(items: DBNotification[], companyId?: CompanyId): DBNotification[] {
  if (!companyId || companyId === "all") return items;
  return items.filter((n) => !n.company_id || n.company_id === companyId);
}

/**
 * Create a new notification, persist to DB, trigger toast, and notify listeners
 */
export async function createNotification(payload: {
  title: string;
  message: string;
  type?: DBNotification["type"];
  company_id?: string | null;
  reference_type?: DBNotification["reference_type"];
  reference_id?: string | null;
  user_id?: string | null;
  showToast?: boolean;
}): Promise<DBNotification> {
  const notifType = payload.type || "info";
  let created: DBNotification;

  try {
    const insertObj = {
      title: payload.title,
      message: payload.message,
      type: notifType,
      company_id: payload.company_id || null,
      reference_type: payload.reference_type || null,
      reference_id: payload.reference_id || null,
      user_id: payload.user_id || null,
      is_read: false,
    };

    const { data, error } = await supabase
      .from("notifications")
      .insert(insertObj)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error("Failed to insert notification");
    }
    created = data as DBNotification;
  } catch (err) {
    console.warn("Falling back to local notification cache:", err);
    created = {
      id: crypto.randomUUID(),
      title: payload.title,
      message: payload.message,
      type: notifType,
      company_id: payload.company_id || null,
      reference_type: payload.reference_type || null,
      reference_id: payload.reference_id || null,
      user_id: payload.user_id || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
  }

  // Update cached list
  const current = getCachedNotifications();
  setCachedNotifications([created, ...current.filter((n) => n.id !== created.id)]);

  // Toast feedback
  if (payload.showToast !== false) {
    if (notifType === "shortage") {
      toast.warning(payload.title, { description: payload.message });
    } else if (notifType === "approval") {
      toast.info(payload.title, { description: payload.message });
    } else if (notifType === "delivery" || notifType === "dispatch") {
      toast.success(payload.title, { description: payload.message });
    } else {
      toast(payload.title, { description: payload.message });
    }
  }

  notifyClientUpdate();
  return created;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    if (!id.startsWith("local-")) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    }
  } catch (err) {
    console.warn("markNotificationAsRead DB error:", err);
  }

  const cached = getCachedNotifications();
  setCachedNotifications(cached.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  notifyClientUpdate();
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(companyId?: CompanyId): Promise<void> {
  try {
    let query = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    if (companyId && companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    await query;
  } catch (err) {
    console.warn("markAllNotificationsAsRead DB error:", err);
  }

  const cached = getCachedNotifications();
  const updated = cached.map((n) => {
    if (companyId && companyId !== "all" && n.company_id && n.company_id !== companyId) {
      return n;
    }
    return { ...n, is_read: true };
  });
  setCachedNotifications(updated);
  notifyClientUpdate();
  toast.success("All notifications marked as read");
}

/**
 * Delete a single notification
 */
export async function deleteNotification(id: string): Promise<void> {
  try {
    if (!id.startsWith("local-")) {
      await supabase.from("notifications").delete().eq("id", id);
    }
  } catch (err) {
    console.warn("deleteNotification DB error:", err);
  }

  const cached = getCachedNotifications();
  setCachedNotifications(cached.filter((n) => n.id !== id));
  notifyClientUpdate();
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(companyId?: CompanyId): Promise<void> {
  try {
    let query = supabase.from("notifications").delete();
    if (companyId && companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      query = query.neq("id", "00000000-0000-0000-0000-000000000000");
    }
    await query;
  } catch (err) {
    console.warn("clearAllNotifications DB error:", err);
  }

  if (companyId && companyId !== "all") {
    const cached = getCachedNotifications().filter(
      (n) => Boolean(n.company_id) && n.company_id !== companyId,
    );
    setCachedNotifications(cached);
  } else {
    setCachedNotifications([]);
  }
  notifyClientUpdate();
  toast.info("Notification feed cleared");
}

/**
 * Realtime and cross-tab listener for notifications
 */
export function subscribeToNotifications(callback: () => void): () => void {
  const channel = supabase
    .channel("public:notifications:realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
      callback();
    })
    .subscribe();

  const handleCustomEvent = () => callback();
  if (typeof window !== "undefined") {
    window.addEventListener("avighna:notifications_updated", handleCustomEvent);
  }

  return () => {
    supabase.removeChannel(channel);
    if (typeof window !== "undefined") {
      window.removeEventListener("avighna:notifications_updated", handleCustomEvent);
    }
  };
}

/**
 * Seed initial notifications (no-op: zero dummy data allowed)
 */
export async function seedInitialNotificationsIfEmpty(): Promise<void> {
  // Deliberate no-op: zero dummy data in DB
}
