import { supabase } from "./supabase";
import { type CompanyId, companies, money } from "./workspace-data";
import { createNotification } from "./notification-service";
import {
  requireAnyPermission,
  requirePermission,
  requireRole,
  requireSuperAdmin,
} from "./security";

export type VehicleStatus =
  "Available / At Godown" | "Dispatched / On Delivery" | "Returned to Godown" | "Assigned / Booked";

export interface DBVehicle {
  id: string;
  company_id?: string | undefined;
  name: string;
  plate_number: string;
  status: VehicleStatus;
  driver_name?: string | undefined;
  driver_phone?: string | undefined;
  capacity?: string | undefined;
  // Aliases for convenience / backward compat
  make_model?: string | undefined;
  assigned_driver_name?: string | undefined;
  assigned_driver_phone?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface DBOrder {
  id: string;
  company_id: string;
  customer_id?: string | undefined;
  customer_name: string;
  contact_person?: string | undefined;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  items_summary?: string | undefined;
  items_count?: number | undefined;
  delivery_address?: string | undefined;
  destination_city?: string | undefined;
  expected_delivery?: string | undefined;
  notes?: string | undefined;
  rejection_reason?: string | undefined;
  shortage_approved: boolean;
  assigned_to?: string | undefined;
  transport_mode?: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle" | undefined;
  assigned_vehicle?: string | undefined;
  assigned_driver?: string | undefined;
  assigned_driver_phone?: string | undefined;
  created_at: string;
}

export interface DBProduct {
  id?: string | undefined;
  company_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unit_price: number; // Selling Price
  wholesale_price: number; // Wholesale Price
  on_hand: number;
  reserved: number;
  reorder_level: number;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface DBCustomer {
  id?: string | undefined;
  company_id: string;
  name: string;
  initials: string;
  contact_person?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  status: "Active" | "Inactive";
  notes?: string | undefined;
  credit_limit?: number | undefined;
  credit_days?: number | undefined;
  created_at?: string | undefined;
}

export interface DBCreditNote {
  id: string;
  company_id: string;
  customer_name: string;
  invoice_id?: string | undefined;
  type: "Credit note" | "Debit note";
  reason: string;
  amount: number;
  status: "Posted" | "Settled";
  created_by?: string | undefined;
  created_at?: string | undefined;
}

export interface DBLead {
  id?: string | undefined;
  company_id: string;
  business_name: string;
  contact_person: string;
  phone?: string | undefined;
  email?: string | undefined;
  requirement: string;
  expected_quantity?: string | undefined;
  source?: string | undefined;
  stage: "New" | "Contacted" | "Qualified" | "Follow-up" | "Converted";
  assigned_to?: string | undefined;
  city?: string | undefined;
  product_interest?: string | undefined;
  gstin?: string | undefined;
  estimated_value?: number | undefined;
  priority?: string | undefined;
  notes?: string | undefined;
  referred_by?: string | undefined;
  sales_edits?: number | undefined;
  supervisor_edits?: number | undefined;
  converted_customer_id?: string | undefined;
  created_at?: string | undefined;
}

export interface DBFieldVisit {
  id?: string | undefined;
  company_id: string;
  customer_id?: string | undefined;
  customer_name: string;
  purpose: string;
  scheduled_date: string;
  scheduled_time: string;
  assigned_to?: string | undefined;
  assigned_to_name: string;
  creator_name?: string | undefined;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
  gps_latitude?: number | undefined;
  gps_longitude?: number | undefined;
  outcome_notes?: string | undefined;
  photos?: string[] | undefined;
  voice_recording_path?: string | undefined;
  created_at?: string | undefined;
}

export interface DBTask {
  id?: string | undefined;
  company_id: string;
  title: string;
  description?: string | undefined;
  customer_id?: string | undefined;
  assigned_to?: string | undefined;
  assigned_to_name: string;
  due_date: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "In Progress" | "Completed" | "Overdue" | "Cancelled";
  done: boolean;
  attachments?: string[] | undefined;
  created_at?: string | undefined;
}

export interface DBPurchaseOrder {
  id: string;
  company_id: string;
  supplier_name: string;
  product_id?: string | undefined;
  product_name: string;
  quantity: number;
  received_quantity?: number | undefined;
  unit: string;
  unit_price: number;
  total_amount: number;
  total_price?: number | undefined;
  status: "Requested" | "Approval" | "In transit" | "Received" | "Rejected";
  eta?: string | undefined;
  warehouse?: string | undefined;
  notes?: string | undefined;
  created_at?: string | undefined;
}

export interface DBInvoice {
  id: string;
  company_id: string;
  order_id: string;
  customer_id?: string | undefined;
  customer_name: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: "Generated" | "Partially Paid" | "Paid" | "Overdue";
  created_at?: string | undefined;
}

export interface DBDelivery {
  id?: string | undefined;
  company_id: string;
  order_id: string;
  invoice_id?: string | undefined;
  customer_name?: string | undefined;
  lr_number?: string | undefined;
  transport_mode?: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle" | undefined;
  vehicle_id?: string | undefined;
  vehicle_number: string;
  driver_name: string;
  driver_phone?: string | undefined;
  status: "Queued" | "Out for delivery" | "Delivered" | "Partially Delivered" | "Failed";
  delivered_quantity?: number | undefined;
  remaining_quantity?: number | undefined;
  delivery_date?: string | undefined;
  time_window?: string | undefined;
  gps_latitude?: number | undefined;
  gps_longitude?: number | undefined;
  signature_path?: string | undefined;
  photos?: string[] | undefined;
  remarks?: string | undefined;
  failure_reason?: string | undefined;
  started_at?: string | undefined;
  completed_at?: string | undefined;
  created_at?: string | undefined;
}

export interface DBAuditLog {
  id?: string | undefined;
  user_name: string;
  company_id?: string | undefined;
  module: string;
  action: string;
  record_id: string;
  description: string;
  before_data?: unknown;
  after_data?: unknown;
  created_at?: string | undefined;
}

// ----------------------------------------------------------------------------
// AUDIT LOGGING HELPER
// ----------------------------------------------------------------------------
export async function logAudit(entry: {
  userName: string;
  companyId?: string | undefined;
  module: string;
  action: string;
  recordId: string;
  description: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  try {
    await supabase.from("audit_logs").insert({
      user_name: entry.userName,
      company_id: entry.companyId,
      module: entry.module,
      action: entry.action,
      record_id: entry.recordId,
      description: entry.description,
      before_data: entry.beforeData,
      after_data: entry.afterData,
    });
  } catch (err) {
    console.warn("Audit log notice:", err);
  }
}

export async function fetchAuditLogs(companyId?: string): Promise<DBAuditLog[]> {
  try {
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
    if (companyId && companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data as DBAuditLog[];
  } catch {
    return [];
  }
}

export function parseTransportFromNotes(notes?: string) {
  if (!notes) return {};
  const match = notes.match(
    /\[Transport:\s*([^·\]]+)(?:\s*·\s*Vehicle:\s*([^·\]]+))?(?:\s*·\s*Driver:\s*([^·\]]+))?(?:\s*·\s*Phone:\s*([^·\]]+))?\]/,
  );
  if (!match) return {};
  return {
    transport_mode: match[1]?.trim() as "Manufacturer Vehicle" | "Logistics / Assigned Vehicle",
    assigned_vehicle: match[2]?.trim(),
    assigned_driver: match[3]?.trim(),
    assigned_driver_phone: match[4]?.trim(),
  };
}

// ----------------------------------------------------------------------------
// ORDERS SERVICE
// ----------------------------------------------------------------------------
export async function fetchOrders(companyId: CompanyId): Promise<DBOrder[]> {
  try {
    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) {
      throw error;
    }
    const mapped = (data as Array<DBOrder & { notes?: string }>).map((ord) => {
      if (!ord.transport_mode && ord.notes) {
        const parsed = parseTransportFromNotes(ord.notes);
        return { ...ord, ...parsed };
      }
      return ord;
    });
    return mapped as DBOrder[];
  } catch {
    return [];
  }
}

export async function createOrder(payload: {
  companyId: string;
  customerName: string;
  customerId?: string | undefined;
  contactPerson?: string | undefined;
  productId?: string | undefined;
  productName: string;
  quantity: number;
  unit?: string | undefined;
  unitPrice: number;
  catalogPrice?: number | undefined;
  wholesalePrice?: number | undefined;
  discount?: number | undefined;
  tax?: number | undefined;
  deliveryAddress?: string | undefined;
  expectedDelivery?: string | undefined;
  notes?: string | undefined;
  createdBy?: string | undefined;
  creatorName: string;
  transportMode?: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle" | undefined;
  assignedVehicle?: string | undefined;
  assignedDriver?: string | undefined;
  assignedDriverPhone?: string | undefined;
}): Promise<{
  success: boolean;
  orderId?: string;
  order?: DBOrder;
  shortage?: boolean;
  shortageQty?: number;
  priceOverride?: boolean;
  error?: string;
}> {
  try {
    await requirePermission("orders.create");
    const subtotal = payload.quantity * payload.unitPrice;
    const discount = payload.discount || 0;
    const tax = payload.tax || 0;
    const total = subtotal - discount + tax;
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const transportMode = payload.transportMode || "Logistics / Assigned Vehicle";
    let assignedVehicle = payload.assignedVehicle?.trim();
    let assignedDriver = payload.assignedDriver?.trim();
    const assignedPhone = payload.assignedDriverPhone?.trim();

    if (transportMode === "Manufacturer Vehicle") {
      assignedVehicle = "Manufacturer Arranged";
      if (!assignedDriver) assignedDriver = "Manufacturer Driver";
    } else if (assignedVehicle) {
      const allVehicles = await fetchVehicles();
      const matched = allVehicles.find(
        (v) =>
          v.plate_number.toUpperCase() === assignedVehicle!.toUpperCase() ||
          v.id.toUpperCase() === assignedVehicle!.toUpperCase(),
      );
      if (matched && matched.status === "Dispatched / On Delivery") {
        throw new Error(
          `Vehicle "${matched.name} (${matched.plate_number})" is currently Dispatched / On Delivery and cannot be assigned to another order.`,
        );
      }
      if (matched) {
        await updateVehicleStatus(
          matched.id,
          "Assigned / Booked",
          payload.creatorName,
          `Assigned to Order #${orderId}`,
        );
      }
    }

    // Inventory check & catalog price verification
    let shortage = false;
    let shortageQty = 0;
    let catalogSellingPrice = payload.catalogPrice || 0;

    let resolvedProductId = payload.productId;
    if (resolvedProductId) {
      const { data: prod } = await supabase
        .from("products")
        .select("unit_price, on_hand, reserved")
        .eq("id", resolvedProductId)
        .single();
      if (prod) {
        if (!catalogSellingPrice) {
          catalogSellingPrice = Number(prod.unit_price) || 0;
        }
        const available = Number(prod.on_hand) - Number(prod.reserved);
        if (payload.quantity > available) {
          shortage = true;
          shortageQty = payload.quantity - available;
        }
      }
    } else if (payload.productName) {
      const { data: prod } = await supabase
        .from("products")
        .select("id, unit_price, on_hand, reserved")
        .eq("company_id", payload.companyId)
        .ilike("name", payload.productName.trim())
        .maybeSingle();
      if (prod) {
        resolvedProductId = prod.id;
        if (!catalogSellingPrice) {
          catalogSellingPrice = Number(prod.unit_price) || 0;
        }
        const available = Number(prod.on_hand) - Number(prod.reserved);
        if (payload.quantity > available) {
          shortage = true;
          shortageQty = payload.quantity - available;
        }
      }
    }

    // Check if entered price is strictly below the catalog Selling Price
    const isPriceOverride = catalogSellingPrice > 0 && payload.unitPrice < catalogSellingPrice;

    let finalNotes = payload.notes || "";
    if (isPriceOverride) {
      const overrideTag = `[PRICE OVERRIDE: Entered ₹${payload.unitPrice} < Selling Price ₹${catalogSellingPrice} · Super Admin Approval Required]`;
      finalNotes = finalNotes ? `${overrideTag} ${finalNotes}` : overrideTag;
    }

    let customerId = payload.customerId;
    if (!customerId && payload.customerName.trim()) {
      let lookup = supabase
        .from("customers")
        .select("id")
        .ilike("name", payload.customerName.trim())
        .limit(1);
      if (payload.companyId && payload.companyId !== "all") {
        lookup = lookup.eq("company_id", payload.companyId);
      }
      const { data: found } = await lookup;
      customerId = found?.[0]?.id;
    }

    const initialStatus = shortage ? "Procuring" : "Pending approval";
    const finalUnit = payload.unit || "Bags";
    const transportTag = `[Transport: ${transportMode}${assignedVehicle ? ` · Vehicle: ${assignedVehicle}` : ""}${assignedDriver ? ` · Driver: ${assignedDriver}` : ""}${assignedPhone ? ` · Phone: ${assignedPhone}` : ""}]`;
    const notesWithTransport = finalNotes ? `${finalNotes} ${transportTag}`.trim() : transportTag;

    let { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      company_id: payload.companyId,
      customer_id: customerId,
      customer_name: payload.customerName,
      contact_person: payload.contactPerson,
      status: initialStatus,
      subtotal,
      discount,
      tax,
      total_amount: total,
      items_summary: `${payload.productName} · ${payload.quantity} ${finalUnit}`,
      delivery_address: payload.deliveryAddress,
      expected_delivery: payload.expectedDelivery,
      notes: notesWithTransport,
      shortage_approved: !shortage,
      transport_mode: transportMode,
      assigned_vehicle: assignedVehicle,
      assigned_driver: assignedDriver,
      assigned_driver_phone: assignedPhone,
    });

    if (orderError && (orderError.code === "PGRST204" || orderError.message?.includes("column"))) {
      const retry = await supabase.from("orders").insert({
        id: orderId,
        company_id: payload.companyId,
        customer_id: customerId,
        customer_name: payload.customerName,
        contact_person: payload.contactPerson,
        status: initialStatus,
        subtotal,
        discount,
        tax,
        total_amount: total,
        items_summary: `${payload.productName} · ${payload.quantity} ${finalUnit}`,
        delivery_address: payload.deliveryAddress,
        expected_delivery: payload.expectedDelivery,
        notes: notesWithTransport,
        shortage_approved: !shortage,
      });
      orderError = retry.error;
    }

    if (orderError) throw orderError;

    // Insert line item
    try {
      await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: payload.productId,
        product_name: payload.productName,
        quantity: payload.quantity,
        remaining_quantity: payload.quantity,
        unit: finalUnit,
        unit_price: payload.unitPrice,
        discount,
        tax,
        total_price: total,
        shortage_quantity: shortageQty,
      });
    } catch (e) {
      console.warn("Order item insert notice:", e);
    }

    const createdOrder: DBOrder = {
      id: orderId,
      company_id: payload.companyId,
      customer_id: customerId,
      customer_name: payload.customerName,
      contact_person: payload.contactPerson,
      status: initialStatus,
      subtotal,
      discount,
      tax,
      total_amount: total,
      items_summary: `${payload.productName} · ${payload.quantity} ${payload.unit}`,
      delivery_address: payload.deliveryAddress,
      expected_delivery: payload.expectedDelivery,
      notes: finalNotes,
      shortage_approved: !shortage,
      transport_mode: transportMode,
      assigned_vehicle: assignedVehicle,
      assigned_driver: assignedDriver,
      assigned_driver_phone: assignedPhone,
      created_at: new Date().toISOString(),
    };

    if (isPriceOverride) {
      // Super Admin Approval Required Notification
      createNotification({
        title: "Super Admin Approval Required: Price Override",
        message: `Order #${orderId} for ${payload.customerName} entered at ₹${payload.unitPrice}/${payload.unit} (Catalog Selling Price: ₹${catalogSellingPrice}). Requires Super Admin price approval.`,
        type: "approval",
        company_id: payload.companyId,
        reference_type: "order",
        reference_id: orderId,
      }).catch(console.warn);

      await logAudit({
        userName: payload.creatorName,
        companyId: payload.companyId,
        module: "orders",
        action: "order_price_override",
        recordId: orderId,
        description: `${payload.creatorName} submitted Order #${orderId} with discounted unit price (Entered ₹${payload.unitPrice} < Catalog Selling Price ₹${catalogSellingPrice}) requiring Super Admin authorization.`,
      });
    } else if (shortage) {
      createNotification({
        title: "Order Shortage Alert",
        message: `Order #${orderId} for ${payload.customerName} requires replenishment (${shortageQty} ${payload.unit} short).`,
        type: "shortage",
        company_id: payload.companyId,
        reference_type: "order",
        reference_id: orderId,
      }).catch(console.warn);
    } else {
      createNotification({
        title: "New Order Placed",
        message: `Order #${orderId} created for ${payload.customerName} (${money(total)}).`,
        type: "approval",
        company_id: payload.companyId,
        reference_type: "order",
        reference_id: orderId,
      }).catch(console.warn);
    }

    await logAudit({
      userName: payload.creatorName,
      companyId: payload.companyId,
      module: "orders",
      action: "order_created",
      recordId: orderId,
      description: `${payload.creatorName} created Order #${orderId} for ${payload.customerName} (${transportMode})`,
    });

    return {
      success: true,
      orderId,
      order: createdOrder,
      shortage,
      shortageQty,
      priceOverride: isPriceOverride,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object"
          ? JSON.stringify(err)
          : String(err);
    return { success: false, error: msg };
  }
}

export async function approveOrder(
  orderId: string,
  approverName: string,
  companyId: string,
  isSuperAdmin = false,
) {
  const actor = await requirePermission("orders.approve");

  // Guard: If this order has a price override, verify that Super Admin is approving
  const { data: ord } = await supabase
    .from("orders")
    .select("notes, status")
    .eq("id", orderId)
    .maybeSingle();

  const isPriceOverride = Boolean(
    ord?.notes?.includes("PRICE OVERRIDE") || ord?.notes?.includes("Super Admin Approval Required"),
  );

  // Never trust display name — only Auth/demo session role (or explicit override when provided).
  const isSuperAdminApprover =
    typeof isSuperAdmin === "boolean"
      ? isSuperAdmin && actor.role === "super_admin"
        ? true
        : isSuperAdmin
      : actor.role === "super_admin";

  if (isPriceOverride && !isSuperAdminApprover) {
    throw new Error(
      `Order #${orderId} was placed below catalog Selling Price and strictly requires Super Admin approval. Supervisor cannot approve price overrides.`,
    );
  }
  approverName = actor.name || approverName;

  const { error } = await supabase
    .from("orders")
    .update({ status: "Approved", shortage_approved: true })
    .eq("id", orderId);

  if (error) throw error;

  await logAudit({
    userName: approverName,
    companyId,
    module: "orders",
    action: isPriceOverride ? "approve_price_override" : "approve",
    recordId: orderId,
    description: `${approverName} approved Order #${orderId}${isPriceOverride ? " (Authorized Price Discount)" : ""}`,
  });

  createNotification({
    title: "Order Approved",
    message: `Order #${orderId} was approved by ${approverName} and queued for fulfillment.`,
    type: "approval",
    company_id: companyId,
    reference_type: "order",
    reference_id: orderId,
  }).catch(console.warn);
}

export async function rejectOrder(
  orderId: string,
  approverName: string,
  companyId: string,
  reason: string,
) {
  const actor = await requirePermission("orders.approve");
  approverName = actor.name || approverName;
  const { error } = await supabase
    .from("orders")
    .update({ status: "Rejected", rejection_reason: reason })
    .eq("id", orderId);

  if (error) throw error;

  await logAudit({
    userName: approverName,
    companyId,
    module: "orders",
    action: "reject",
    recordId: orderId,
    description: `${approverName} rejected Order #${orderId}: ${reason}`,
  });

  createNotification({
    title: "Order Rejected",
    message: `Order #${orderId} was rejected by ${approverName}: ${reason}`,
    type: "info",
    company_id: companyId,
    reference_type: "order",
    reference_id: orderId,
  }).catch(console.warn);
}

// ----------------------------------------------------------------------------
// INVENTORY INTELLIGENCE SERVICE
// ----------------------------------------------------------------------------

/** Order statuses that no longer commit product stock as outbound. */
const OUTBOUND_RELEASED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "delivered",
]);

/** Active/valid orders still reserve stock until cancelled, rejected, or delivered. */
export function orderCountsTowardOutbound(status: string): boolean {
  return !OUTBOUND_RELEASED_STATUSES.has(String(status || "").trim().toLowerCase());
}

/** Parse `Product Name · 50 kg` style summaries written on createOrder. */
export function parseOrderItemsSummary(itemsSummary?: string | null): {
  productName: string;
  quantity: number;
} | null {
  if (!itemsSummary?.trim()) return null;
  const match = itemsSummary.trim().match(/^(.+?)\s*·\s*([\d.]+)\b/);
  if (!match?.[1] || match[2] === undefined) return null;
  const quantity = Number(match[2]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { productName: match[1].trim(), quantity };
}

/** Aggregate ordered qty for a product across active/valid orders. */
export function outboundOrderedQuantity(
  orders: DBOrder[],
  product: Pick<DBProduct, "name" | "code" | "company_id">,
): number {
  const nameKey = product.name.trim().toLowerCase();
  const codeKey = product.code.trim().toLowerCase();
  let total = 0;
  for (const order of orders) {
    if (!orderCountsTowardOutbound(order.status)) continue;
    if (
      product.company_id !== "all" &&
      order.company_id !== "all" &&
      order.company_id !== product.company_id
    ) {
      continue;
    }
    const line = parseOrderItemsSummary(order.items_summary);
    if (!line) continue;
    const lineName = line.productName.toLowerCase();
    if (lineName === nameKey || lineName === codeKey) {
      total += line.quantity;
    }
  }
  return total;
}

export function availableFromStock(onHand: number, outbound: number): number {
  return Number(onHand) - Number(outbound);
}

export async function fetchProducts(companyId: CompanyId): Promise<DBProduct[]> {
  try {
    let query = supabase.from("products").select("*").order("name");
    if (companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.eq.all`);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return (data as DBProduct[]).map((p) => {
      let ws = Number(p.wholesale_price);
      let cat = String(p.category || "");
      if (isNaN(ws) || ws <= 0) {
        const match = cat.match(/#ws:([\d.]+)/);
        if (match && match[1]) {
          ws = parseFloat(match[1]);
        } else {
          ws = Number(p.unit_price) || 0;
        }
      }
      cat = cat.replace(/#ws:[\d.]+/, "").trim();
      return {
        ...p,
        category: cat,
        unit_price: Number(p.unit_price) || 0,
        wholesale_price: ws,
        on_hand: Number(p.on_hand) || 0,
        reserved: Number(p.reserved) || 0,
        reorder_level: Number(p.reorder_level) || 0,
      };
    });
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// INVOICES SERVICE
// ----------------------------------------------------------------------------
export function invoiceDueDate(creditDays: number, from = new Date()): string {
  const days = Number.isFinite(creditDays) && creditDays > 0 ? Math.floor(creditDays) : 30;
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

export function creditFromNotes(notes?: string | null) {
  const days = notes?.match(/Credit:\s*(\d+)\s*days/i);
  const limit = notes?.match(/Credit Limit:\s*₹?([\d,]+)/i);
  return {
    credit_days: days ? Number(days[1]) : undefined,
    credit_limit: limit ? Number(limit[1].replace(/,/g, "")) : undefined,
  };
}

function notesWithCredit(notes: string | undefined, limit: number, days: number) {
  const rest = (notes || "")
    .split(/\s*·\s*/)
    .filter((part) => part && !/^Credit Limit:/i.test(part) && !/^Credit:/i.test(part));
  rest.push(`Credit Limit: ₹${limit.toLocaleString("en-IN")}`);
  rest.push(`Credit: ${days} days`);
  return rest.join(" · ");
}

function columnMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "PGRST204" || /column/i.test(error.message || "")));
}

export async function generateInvoice(
  order: DBOrder,
  generatorName: string,
  customDetails?: {
    invoiceId?: string;
    dueDate?: string;
    notes?: string;
  },
) {
  const actor = await requirePermission("invoices.generate");
  generatorName = actor.name || generatorName;
  if (!["Approved", "Ready to dispatch", "Out for delivery", "Delivered"].includes(order.status)) {
    throw new Error(
      `Cannot generate invoice for Order #${order.id} with status "${order.status}". Order must be approved first.`,
    );
  }
  const invoiceId = customDetails?.invoiceId?.trim() || `INV-${order.id.replace("ORD-", "")}`;
  let customerId = order.customer_id;
  let creditDays = 30;
  const applyCustomer = (cust: { id?: string; credit_days?: number | null; notes?: string | null }) => {
    if (cust.id) customerId = cust.id;
    creditDays = Number(cust.credit_days) || creditFromNotes(cust.notes).credit_days || 30;
  };
  if (customerId) {
    const { data: cust } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();
    if (cust) applyCustomer(cust);
  } else if (order.customer_name) {
    let lookup = supabase
      .from("customers")
      .select("*")
      .ilike("name", order.customer_name.trim())
      .limit(1);
    if (order.company_id && order.company_id !== "all") {
      lookup = lookup.eq("company_id", order.company_id);
    }
    const { data: found } = await lookup;
    if (found?.[0]) applyCustomer(found[0]);
  }
  const finalDueDate = customDetails?.dueDate?.trim() || invoiceDueDate(creditDays);

  const { error } = await supabase.from("invoices").insert({
    id: invoiceId,
    company_id: order.company_id,
    order_id: order.id,
    customer_id: customerId,
    customer_name: order.customer_name,
    amount: order.total_amount,
    paid_amount: 0,
    remaining_amount: order.total_amount,
    due_date: finalDueDate,
    status: "Generated",
  });

  if (error) throw error;

  // Order is now ready for dispatch
  await supabase.from("orders").update({ status: "Ready to dispatch" }).eq("id", order.id);

  await logAudit({
    userName: generatorName,
    companyId: order.company_id,
    module: "finance",
    action: "invoice_generated",
    recordId: invoiceId,
    description: `${generatorName} generated Invoice #${invoiceId} for ${order.customer_name} (₹${order.total_amount.toLocaleString("en-IN")})`,
  });

  createNotification({
    title: "Invoice Generated",
    message: `Tax Invoice #${invoiceId} generated for ${order.customer_name} (₹${order.total_amount.toLocaleString("en-IN")}). Ready for dispatch.`,
    type: "info",
    company_id: order.company_id,
    reference_type: "invoice",
    reference_id: invoiceId,
  }).catch(console.warn);

  return invoiceId;
}

export async function fetchInvoices(companyId: CompanyId): Promise<DBInvoice[]> {
  try {
    let query = supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBInvoice[];
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// LOGISTICS & DISPATCH SERVICE
// ----------------------------------------------------------------------------
export async function fetchDeliveries(companyId: CompanyId): Promise<DBDelivery[]> {
  try {
    let query = supabase.from("deliveries").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBDelivery[];
  } catch {
    return [];
  }
}

export async function dispatchDelivery(payload: {
  orderId: string;
  companyId: string;
  invoiceId?: string | undefined;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string | undefined;
  deliveryDate?: string | undefined;
  timeWindow?: string | undefined;
  dispatcherName: string;
  dispatcherRole?: string | undefined;
}) {
  // Order desk (sales/supervisor) assigns trips; drivers must never self-assign.
  const actor = await requireAnyPermission([
    "logistics.dispatch",
    "orders.create",
    "orders.approve",
    "admin.manage",
  ]);
  if (actor.role === "logistics" || payload.dispatcherRole === "logistics") {
    throw new Error(
      "Logistics drivers cannot self-assign vehicles or trips. Trip assignment must be performed by Order Desk or authorized personnel.",
    );
  }

  // CRITICAL RULE: A commercial invoice must exist before assigning/dispatching
  let invoiceId = payload.invoiceId;
  if (!invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id")
      .eq("order_id", payload.orderId)
      .maybeSingle();
    if (inv?.id) {
      invoiceId = inv.id;
    } else {
      throw new Error(
        `Cannot dispatch Order #${payload.orderId}. Commercial Invoice must be generated by Accounts before vehicle assignment.`,
      );
    }
  }

  const remarks = [
    payload.deliveryDate ? `Date: ${payload.deliveryDate}` : null,
    payload.timeWindow ? `Time Window: ${payload.timeWindow}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Check vehicle availability if company vehicle
  const isManufacturerTransport =
    payload.vehicleNumber === "Manufacturer Arranged" ||
    payload.vehicleNumber.toLowerCase().includes("manufacturer");

  if (!isManufacturerTransport && payload.vehicleNumber) {
    const allVehicles = await fetchVehicles();
    const matched = allVehicles.find(
      (v) =>
        v.plate_number.toUpperCase() === payload.vehicleNumber.trim().toUpperCase() ||
        v.id.toUpperCase() === payload.vehicleNumber.trim().toUpperCase(),
    );
    if (matched && matched.status === "Dispatched / On Delivery") {
      throw new Error(
        `Cannot dispatch: Vehicle "${matched.name} (${matched.plate_number})" is currently Dispatched / On Delivery and cannot be dispatched to another trip.`,
      );
    }
    await updateVehicleStatus(
      payload.vehicleNumber,
      "Dispatched / On Delivery",
      payload.dispatcherName,
      `Dispatched for Order #${payload.orderId}`,
    );
  }

  let { data: delivery, error } = await supabase
    .from("deliveries")
    .insert({
      company_id: payload.companyId,
      order_id: payload.orderId,
      invoice_id: invoiceId,
      transport_mode: isManufacturerTransport
        ? "Manufacturer Vehicle"
        : "Logistics / Assigned Vehicle",
      vehicle_number: payload.vehicleNumber,
      driver_name: payload.driverName,
      driver_phone: payload.driverPhone,
      status: "Out for delivery",
      remarks: remarks || undefined,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
    const retry = await supabase
      .from("deliveries")
      .insert({
        company_id: payload.companyId,
        order_id: payload.orderId,
        invoice_id: invoiceId,
        vehicle_number: payload.vehicleNumber,
        driver_name: payload.driverName,
        driver_phone: payload.driverPhone,
        status: "Out for delivery",
        remarks: remarks || undefined,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    delivery = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  await supabase.from("orders").update({ status: "Out for delivery" }).eq("id", payload.orderId);

  await logAudit({
    userName: payload.dispatcherName,
    companyId: payload.companyId,
    module: "logistics",
    action: "dispatch",
    recordId: payload.orderId,
    description: `${payload.dispatcherName} assigned Vehicle ${payload.vehicleNumber} & Driver ${payload.driverName} to Order #${payload.orderId} (Invoice: #${invoiceId}${remarks ? `, ${remarks}` : ""})`,
  });

  createNotification({
    title: "Trip Assigned & Dispatched",
    message: `Order #${payload.orderId} assigned to Driver ${payload.driverName} (Vehicle: ${payload.vehicleNumber}). Ready for delivery.`,
    type: "dispatch",
    company_id: payload.companyId,
    reference_type: "delivery",
    reference_id: payload.orderId,
  }).catch(console.warn);

  return delivery;
}

export function deliveryProofReady(
  gps: { lat: number; lng: number } | null | undefined,
  photos: readonly string[] | undefined,
) {
  return Boolean(
    gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng) && photos && photos.length > 0,
  );
}

export async function completeDelivery(payload: {
  deliveryId: string;
  orderId: string;
  companyId: string;
  outcome?: "Delivered" | "Partially Delivered" | "Failed" | undefined;
  deliveredQuantity: number;
  remainingQuantity: number;
  receiverName?: string | undefined;
  receiverPhone?: string | undefined;
  failureReason?: string | undefined;
  returnGoodsNotes?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  signatureFile?: File | undefined;
  photos?: File[] | undefined;
  photoDataUrls?: string[] | undefined;
  remarks?: string | undefined;
  completedByName: string;
}) {
  await requirePermission("logistics.deliver");
  let signaturePath: string | undefined;
  const photoPaths: string[] = [];

  // Upload signature if provided
  if (payload.signatureFile) {
    const ext = payload.signatureFile.name.split(".").pop();
    const path = `${payload.deliveryId}-sig.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("delivery-signatures")
      .upload(path, payload.signatureFile, { upsert: true });
    if (!upErr) signaturePath = path;
  }

  // Upload photos if provided. Data URLs follow the field-visit photo store.
  if (payload.photos && payload.photos.length > 0 && !payload.photoDataUrls?.length) {
    for (let i = 0; i < payload.photos.length; i++) {
      const file = payload.photos[i];
      if (!file) continue;
      const ext = file.name.split(".").pop();
      const path = `${payload.deliveryId}-p${i + 1}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("delivery-photos")
        .upload(path, file, { upsert: true });
      if (!upErr) photoPaths.push(path);
    }
  }

  const outcome =
    payload.outcome || (payload.remainingQuantity <= 0 ? "Delivered" : "Partially Delivered");

  const orderStatus =
    outcome === "Delivered"
      ? "Delivered"
      : outcome === "Partially Delivered"
        ? "Partially Delivered"
        : "Failed Delivery";

  const remarksParts = [
    payload.remarks,
    payload.receiverName ? `Receiver: ${payload.receiverName}` : null,
    payload.receiverPhone ? `Phone: ${payload.receiverPhone}` : null,
    payload.returnGoodsNotes ? `Returns: ${payload.returnGoodsNotes}` : null,
  ].filter(Boolean);

  const finalRemarks = remarksParts.join(" | ");

  await supabase
    .from("deliveries")
    .update({
      status: outcome,
      delivered_quantity: payload.deliveredQuantity,
      remaining_quantity: payload.remainingQuantity,
      gps_latitude: payload.latitude,
      gps_longitude: payload.longitude,
      gps_captured_at: new Date().toISOString(),
      signature_path: signaturePath,
      photos: payload.photoDataUrls?.length ? payload.photoDataUrls : photoPaths,
      remarks: finalRemarks || undefined,
      failure_reason: payload.failureReason || undefined,
      completed_at: new Date().toISOString(),
    })
    .eq("id", payload.deliveryId);

  await supabase.from("orders").update({ status: orderStatus }).eq("id", payload.orderId);

  await logAudit({
    userName: payload.completedByName,
    companyId: payload.companyId,
    module: "logistics",
    action:
      outcome === "Delivered"
        ? "delivery_completed"
        : outcome === "Partially Delivered"
          ? "partial_delivery"
          : "delivery_failed",
    recordId: payload.orderId,
    description: `${payload.completedByName} submitted POD for Order #${payload.orderId}: ${outcome}${payload.failureReason ? ` (Reason: ${payload.failureReason})` : ""}`,
  });

  createNotification({
    title:
      outcome === "Delivered"
        ? "Order Delivered"
        : outcome === "Partially Delivered"
          ? "Partial Delivery Recorded"
          : "Delivery Failed",
    message: `Order #${payload.orderId} was updated to ${orderStatus} by ${payload.completedByName}.${payload.failureReason ? ` Reason: ${payload.failureReason}` : ""}`,
    type: "delivery",
    company_id: payload.companyId,
    reference_type: "delivery",
    reference_id: payload.orderId,
  }).catch(console.warn);
}

// ----------------------------------------------------------------------------
// GENERAL WORK / TASKS SERVICE
// ----------------------------------------------------------------------------
export async function fetchTasks(companyId: CompanyId): Promise<DBTask[]> {
  try {
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBTask[];
  } catch {
    return [];
  }
}

export async function createTask(payload: {
  title: string;
  companyId: string;
  assignedToName: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  creatorName: string;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: payload.title,
      company_id: payload.companyId,
      assigned_to_name: payload.assignedToName,
      due_date: payload.dueDate,
      priority: payload.priority,
      status: "Pending",
      done: false,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId,
    module: "tasks",
    action: "create",
    recordId: data?.id || "TASK",
    description: `${payload.creatorName} created Task: ${payload.title}`,
  });

  return data;
}

export async function toggleTask(taskId: string, done: boolean) {
  const { error } = await supabase
    .from("tasks")
    .update({ done, status: done ? "Completed" : "Pending" })
    .eq("id", taskId);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// LEADS SERVICE
// ----------------------------------------------------------------------------

const LEAD_EDIT_MARK = /\[\[lead-edits:sales=(\d+)\|supervisor=(\d+)\]\]/;

export function leadEditCounts(requirement?: string | null) {
  const match = requirement?.match(LEAD_EDIT_MARK);
  return {
    sales: match ? Number(match[1]) || 0 : 0,
    supervisor: match ? Number(match[2]) || 0 : 0,
  };
}

export function stripLeadEditMark(requirement?: string | null) {
  return (requirement || "").replace(LEAD_EDIT_MARK, "").trim();
}

/** Owner edits freely. Sales and supervisor each get two saves per lead. */
export function canEditLead(
  role: string | undefined,
  counts: { sales: number; supervisor: number },
) {
  if (role === "super_admin") return true;
  if (role === "sales") return counts.sales < 2;
  if (role === "supervisor") return counts.supervisor < 2;
  return false;
}

function requirementField(requirement: string, label: string) {
  const part = requirement.split(" · ").find((item) => item.startsWith(`${label}:`));
  return part ? part.slice(label.length + 1).trim() : undefined;
}

function buildLeadRequirement(payload: {
  productInterest?: string | undefined;
  estimatedValue?: number | undefined;
  city?: string | undefined;
  gstin?: string | undefined;
  leadType?: string | undefined;
  priority?: string | undefined;
  referredBy?: string | undefined;
  notes?: string | undefined;
  requirement?: string | undefined;
}) {
  return (
    payload.requirement ||
    [
      payload.productInterest ? `Product Interest: ${payload.productInterest}` : "",
      payload.estimatedValue ? `Est: ₹${payload.estimatedValue.toLocaleString("en-IN")}` : "",
      payload.city ? `City: ${payload.city}` : "",
      payload.gstin ? `GSTIN: ${payload.gstin}` : "",
      payload.leadType ? `Type: ${payload.leadType}` : "",
      payload.priority ? `Priority: ${payload.priority}` : "",
      payload.referredBy ? `Referred by: ${payload.referredBy}` : "",
      payload.notes ? `Notes: ${payload.notes}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Inquiry recorded"
  );
}
export async function fetchLeads(companyId: CompanyId): Promise<DBLead[]> {
  try {
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return (data as DBLead[]).map((l) => {
      let estimatedVal = Number(l.estimated_value) || 0;
      let city = typeof l.city === "string" ? l.city : undefined;
      let productInterest = typeof l.product_interest === "string" ? l.product_interest : undefined;
      let priority = typeof l.priority === "string" ? l.priority : undefined;
      const reqStr = typeof l.requirement === "string" ? l.requirement : "";
      const expQty = typeof l.expected_quantity === "string" ? l.expected_quantity : "";
      if (!estimatedVal && reqStr) {
        const estMatch = reqStr.match(/Est:\s*₹?([\d,]+)/);
        if (estMatch && estMatch[1]) {
          estimatedVal = parseFloat(estMatch[1].replace(/,/g, ""));
        }
      }
      if (!estimatedVal && expQty) {
        const estMatch = expQty.match(/₹?([\d,]+)/);
        if (estMatch && estMatch[1]) {
          estimatedVal = parseFloat(estMatch[1].replace(/,/g, ""));
        }
      }
      if (!productInterest && reqStr) {
        const prodMatch = reqStr.match(/Product Interest:\s*([^·]+)/);
        if (prodMatch && prodMatch[1]) productInterest = prodMatch[1].trim();
      }
      if (!city && reqStr) {
        const cityMatch = reqStr.match(/City:\s*([^·]+)/);
        if (cityMatch && cityMatch[1]) city = cityMatch[1].trim();
      }
      if (!priority && reqStr) {
        const priMatch = reqStr.match(/Priority:\s*([^·]+)/);
        if (priMatch && priMatch[1]) priority = priMatch[1].trim();
      }
      const counts = leadEditCounts(reqStr);
      const cleanReq = stripLeadEditMark(reqStr);
      return {
        ...l,
        requirement: cleanReq,
        estimated_value: estimatedVal,
        city: city || (typeof l.city === "string" ? l.city : undefined),
        product_interest:
          productInterest ||
          (typeof l.product_interest === "string" ? l.product_interest : undefined),
        priority: priority || (typeof l.priority === "string" ? l.priority : "Medium"),
        referred_by: requirementField(cleanReq, "Referred by"),
        notes:
          (typeof l.notes === "string" && l.notes) || requirementField(cleanReq, "Notes") || undefined,
        sales_edits: counts.sales,
        supervisor_edits: counts.supervisor,
      };
    });
  } catch {
    return [];
  }
}

export async function updateLeadStage(
  leadId: string,
  newStage: "New" | "Qualified" | "Follow-up" | "Converted",
  userName?: string,
) {
  const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
  if (error) throw error;

  await logAudit({
    userName: userName || "Sales Executive",
    module: "crm",
    action: "lead_stage_updated",
    recordId: leadId,
    description: `${userName || "Sales"} moved lead to stage: ${newStage}`,
  });

  // If stage changed to Converted, automatically ensure customer profile is created
  if (newStage === "Converted") {
    try {
      const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (lead && !lead.converted_customer_id) {
        await convertLeadToCustomer(
          lead.id,
          lead.company_id || "asian",
          lead.business_name || "New Customer",
          lead.contact_person || "Contact Person",
          userName || "Sales Executive",
          {
            phone: lead.phone || undefined,
            email: lead.email || undefined,
            address: lead.city || undefined,
            notes: lead.requirement || undefined,
          },
        );
      }
    } catch (err) {
      console.warn("Auto-convert lead on stage update notice:", err);
    }
  }
}

export async function createLead(payload: {
  companyId: string;
  businessName: string;
  contactPerson: string;
  phone?: string | undefined;
  email?: string | undefined;
  requirement?: string | undefined;
  expectedQuantity?: string | undefined;
  source?: string | undefined;
  creatorName: string;
  city?: string | undefined;
  gstin?: string | undefined;
  productInterest?: string | undefined;
  estimatedValue?: number | undefined;
  leadType?: string | undefined;
  priority?: string | undefined;
  notes?: string | undefined;
  referredBy?: string | undefined;
}) {
  const reqSummary = buildLeadRequirement(payload);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_id: payload.companyId || "asian",
      business_name: payload.businessName,
      contact_person: payload.contactPerson,
      phone: payload.phone,
      email: payload.email,
      requirement: reqSummary,
      expected_quantity: payload.estimatedValue
        ? `₹${payload.estimatedValue.toLocaleString("en-IN")}`
        : payload.expectedQuantity,
      source: payload.source || "WhatsApp",
      stage: "New",
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId || "asian",
    module: "crm",
    action: "lead_created",
    recordId: data?.id || "LEAD",
    description: `${payload.creatorName} added Lead for ${payload.businessName} (${payload.source || "WhatsApp"})`,
  });

  return data;
}

export async function updateLead(
  leadId: string,
  payload: {
    companyId: string;
    businessName: string;
    contactPerson: string;
    phone?: string | undefined;
    email?: string | undefined;
    city?: string | undefined;
    gstin?: string | undefined;
    productInterest?: string | undefined;
    estimatedValue?: number | undefined;
    source?: string | undefined;
    leadType?: string | undefined;
    priority?: string | undefined;
    notes?: string | undefined;
    referredBy?: string | undefined;
  },
  editor: { role: string; name: string },
) {
  const { data: existing, error: readError } = await supabase
    .from("leads")
    .select("requirement")
    .eq("id", leadId)
    .single();
  if (readError) throw readError;

  const counts = leadEditCounts(existing?.requirement);
  if (!canEditLead(editor.role, counts)) {
    throw new Error("You can edit this lead only twice.");
  }
  if (editor.role === "sales") counts.sales += 1;
  if (editor.role === "supervisor") counts.supervisor += 1;

  const requirement = `${buildLeadRequirement(payload)} [[lead-edits:sales=${counts.sales}|supervisor=${counts.supervisor}]]`;
  const { error } = await supabase
    .from("leads")
    .update({
      company_id: payload.companyId || "asian",
      business_name: payload.businessName,
      contact_person: payload.contactPerson,
      phone: payload.phone,
      email: payload.email,
      requirement,
      expected_quantity: payload.estimatedValue
        ? `₹${payload.estimatedValue.toLocaleString("en-IN")}`
        : null,
      source: payload.source || "WhatsApp",
    })
    .eq("id", leadId);
  if (error) throw error;

  await logAudit({
    userName: editor.name,
    companyId: payload.companyId || "asian",
    module: "crm",
    action: "lead_updated",
    recordId: leadId,
    description: `${editor.name} edited lead ${payload.businessName}`,
  });
}

export async function convertLeadToCustomer(
  leadId: string,
  companyId: string,
  businessName: string,
  contactPerson: string,
  convertedByName: string,
  extra?: {
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    notes?: string | undefined;
  },
): Promise<DBCustomer> {
  const safeCompanyId = !companyId || companyId === "all" ? "asian" : companyId;
  const safeName = (businessName || "").trim() || "Customer Account";
  const initials =
    safeName
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CU";

  let phone = extra?.phone;
  let email = extra?.email;
  let address = extra?.address;
  let notes = extra?.notes;

  try {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (lead) {
      if (!phone && lead.phone) phone = lead.phone;
      if (!email && lead.email) email = lead.email;
      if (!address && lead.city) address = lead.city;
      if (!notes && lead.requirement) {
        notes = [
          lead.requirement ? `Requirement: ${lead.requirement}` : "",
          lead.source ? `Source: ${lead.source}` : "",
          lead.expected_quantity ? `Expected: ${lead.expected_quantity}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
      }
    }
  } catch {
    // Ignore lead lookup error and fallback to direct customer creation
  }

  // Check if a customer already exists with this name for the company
  let cust: DBCustomer | null = null;
  const { data: existingCust } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", safeCompanyId)
    .ilike("name", safeName)
    .maybeSingle();

  if (existingCust) {
    const { data: updatedCust, error: updateErr } = await supabase
      .from("customers")
      .update({
        contact_person: contactPerson || existingCust.contact_person,
        phone: phone || existingCust.phone,
        email: email || existingCust.email,
        address: address || existingCust.address,
        notes: notes || existingCust.notes,
        status: "Active",
      })
      .eq("id", existingCust.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    cust = (updatedCust as DBCustomer) || (existingCust as DBCustomer);
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from("customers")
      .insert({
        company_id: safeCompanyId,
        name: safeName,
        initials,
        contact_person: contactPerson || "Key Contact",
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        status: "Active",
      })
      .select()
      .single();

    if (custErr) {
      console.error("Failed to insert customer during lead conversion:", custErr);
      throw custErr;
    }
    cust = newCust as DBCustomer;
  }

  // Mark lead converted and associate customer ID
  await supabase
    .from("leads")
    .update({ stage: "Converted", converted_customer_id: cust.id })
    .eq("id", leadId);

  await logAudit({
    userName: convertedByName,
    companyId: safeCompanyId,
    module: "crm",
    action: "lead_converted",
    recordId: cust.id || "",
    description: `${convertedByName} converted Lead ${safeName} into Customer #${cust.id || ""}`,
  });

  createNotification({
    title: "Lead Converted to Customer",
    message: `${convertedByName} converted lead "${safeName}" into an active customer account.`,
    type: "info",
    company_id: safeCompanyId,
    reference_type: "customer",
    reference_id: cust.id ?? null,
  }).catch(console.warn);

  return cust;
}

// ----------------------------------------------------------------------------
// FIELD VISITS SERVICE
// ----------------------------------------------------------------------------
export async function fetchFieldVisits(companyId: CompanyId): Promise<DBFieldVisit[]> {
  try {
    let query = supabase
      .from("field_visits")
      .select("*")
      .order("scheduled_date", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBFieldVisit[];
  } catch {
    return [];
  }
}

export async function scheduleFieldVisit(payload: {
  companyId: string;
  customerName: string;
  customerId?: string | undefined;
  purpose: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedTo?: string | undefined;
  assignedToName: string;
  creatorName: string;
  gpsLatitude?: number | undefined;
  gpsLongitude?: number | undefined;
  outcomeNotes?: string | undefined;
  photos?: string[] | undefined;
  voiceRecordingPath?: string | undefined;
  status?: "Scheduled" | "In Progress" | "Completed" | "Cancelled" | undefined;
}) {
  const { data, error } = await supabase
    .from("field_visits")
    .insert({
      company_id: payload.companyId,
      customer_name: payload.customerName,
      customer_id: payload.customerId,
      purpose: payload.purpose,
      scheduled_date: payload.scheduledDate,
      scheduled_time: payload.scheduledTime,
      assigned_to: payload.assignedTo || null,
      assigned_to_name: payload.assignedToName,
      status: payload.status || "Scheduled",
      gps_latitude: payload.gpsLatitude,
      gps_longitude: payload.gpsLongitude,
      gps_captured_at: payload.gpsLatitude ? new Date().toISOString() : null,
      outcome_notes: payload.outcomeNotes,
      photos: payload.photos || [],
      voice_recording_path: payload.voiceRecordingPath,
      completed_at: payload.status === "Completed" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId,
    module: "operations",
    action: "field_visit_scheduled",
    recordId: data?.id || "VISIT",
    description: `${payload.creatorName} logged Field Visit to ${payload.customerName} (${payload.purpose})`,
  });

  createNotification({
    title: "Field Visit Scheduled",
    message: `${payload.creatorName} scheduled visit with ${payload.customerName} (${payload.purpose}) on ${payload.scheduledDate}.`,
    type: "task",
    company_id: payload.companyId,
    reference_type: "visit",
    reference_id: data?.id,
  }).catch(console.warn);

  return data;
}

// ----------------------------------------------------------------------------
// PURCHASES & PROCUREMENT SERVICE
// ----------------------------------------------------------------------------
export async function fetchPurchaseOrders(companyId: CompanyId): Promise<DBPurchaseOrder[]> {
  try {
    let query = supabase
      .from("purchase_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBPurchaseOrder[];
  } catch {
    return [];
  }
}

export async function receivePurchaseGoods(poId: string, companyId: string, receiverName: string) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "Received" })
    .eq("id", poId);

  if (error) throw error;

  await logAudit({
    userName: receiverName,
    companyId,
    module: "procurement",
    action: "goods_received",
    recordId: poId,
    description: `${receiverName} confirmed Goods Received for PO #${poId} (Inventory inbound updated)`,
  });
}

export async function createPurchaseOrder(payload: {
  companyId: string;
  supplierName: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes?: string;
  creatorName: string;
}): Promise<DBPurchaseOrder> {
  const poId = `PO-${Date.now().toString().slice(-4)}`;
  const totalAmount = payload.quantity * payload.unitPrice;
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      id: poId,
      company_id: payload.companyId,
      supplier_name: payload.supplierName,
      product_id: payload.productId,
      product_name: payload.productName,
      quantity: payload.quantity,
      unit: payload.unit,
      unit_price: payload.unitPrice,
      total_amount: totalAmount,
      status: "Requested",
      notes: payload.notes,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId,
    module: "procurement",
    action: "po_created",
    recordId: poId,
    description: `${payload.creatorName} created PO #${poId} for ${payload.quantity} ${payload.unit} of ${payload.productName}`,
  });

  return data as DBPurchaseOrder;
}

// ----------------------------------------------------------------------------
// CUSTOMERS SERVICE
// ----------------------------------------------------------------------------
const fallbackCustomers: DBCustomer[] = [];

export async function fetchCustomers(companyId: CompanyId): Promise<DBCustomer[]> {
  try {
    let query = supabase.from("customers").select("*").order("name");
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return (data as DBCustomer[]).map((customer) => {
      const parsed = creditFromNotes(customer.notes);
      return {
        ...customer,
        credit_days: customer.credit_days ?? parsed.credit_days,
        credit_limit: customer.credit_limit ?? parsed.credit_limit,
      };
    });
  } catch {
    return [];
  }
}

export async function createCustomer(payload: {
  companyId: string;
  name: string;
  tradeName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  billingAddress?: string;
  shippingAddress?: string;
  address?: string;
  customerType?: string;
  creditLimit?: number;
  creditDays?: number;
  notes?: string;
  creatorName: string;
}): Promise<DBCustomer> {
  const initials = payload.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const combinedAddress =
    payload.address ||
    [
      payload.billingAddress ? `Billing: ${payload.billingAddress}` : "",
      payload.shippingAddress ? `Shipping: ${payload.shippingAddress}` : "",
    ]
      .filter(Boolean)
      .join("\n") ||
    "Address not specified";

  const combinedNotes =
    payload.notes ||
    [
      payload.tradeName ? `Trade Name: ${payload.tradeName}` : "",
      payload.gstin ? `GSTIN: ${payload.gstin}` : "",
      payload.customerType ? `Type: ${payload.customerType}` : "",
      payload.creditLimit !== undefined
        ? `Credit Limit: ₹${payload.creditLimit.toLocaleString("en-IN")}`
        : "",
      payload.creditDays ? `Credit: ${payload.creditDays} days` : "",
    ]
      .filter(Boolean)
      .join(" · ");

  const row = {
    company_id: payload.companyId,
    name: payload.name,
    initials,
    contact_person: payload.contactPerson,
    phone: payload.phone,
    email: payload.email,
    address: combinedAddress,
    notes: combinedNotes,
    status: "Active" as const,
    credit_limit: payload.creditLimit ?? 0,
    credit_days: payload.creditDays ?? 30,
  };
  let { data, error } = await supabase.from("customers").insert(row).select().single();
  if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
    const { credit_limit: _limit, credit_days: _days, ...withoutCredit } = row;
    const retry = await supabase.from("customers").insert(withoutCredit).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) throw error;

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId,
    module: "crm",
    action: "customer_created",
    recordId: data.id,
    description: `${payload.creatorName} created Customer: ${payload.name} (${payload.gstin || "Direct"})`,
  });

  return data as DBCustomer;
}

export async function updateCustomer(payload: {
  id: string;
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status?: "Active" | "Inactive";
  creditDays?: number;
  creditLimit?: number;
  companyId?: string;
  userName?: string;
}): Promise<DBCustomer> {
  const updateFields: Partial<DBCustomer> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (payload.name !== undefined) updateFields.name = payload.name;
  if (payload.contactPerson !== undefined) updateFields.contact_person = payload.contactPerson;
  if (payload.phone !== undefined) updateFields.phone = payload.phone;
  if (payload.email !== undefined) updateFields.email = payload.email;
  if (payload.address !== undefined) updateFields.address = payload.address;
  if (payload.notes !== undefined) updateFields.notes = payload.notes;
  if (payload.status !== undefined) updateFields.status = payload.status;
  if (payload.creditDays !== undefined) updateFields.credit_days = payload.creditDays;
  if (payload.creditLimit !== undefined) updateFields.credit_limit = payload.creditLimit;

  let { data, error } = await supabase
    .from("customers")
    .update(updateFields)
    .eq("id", payload.id)
    .select()
    .single();

  if (columnMissing(error)) {
    const { credit_days: _days, credit_limit: _limit, ...rest } = updateFields;
    if (payload.creditDays !== undefined || payload.creditLimit !== undefined) {
      const { data: current } = await supabase
        .from("customers")
        .select("notes")
        .eq("id", payload.id)
        .maybeSingle();
      rest.notes = notesWithCredit(
        payload.notes ?? current?.notes,
        payload.creditLimit ?? creditFromNotes(current?.notes).credit_limit ?? 0,
        payload.creditDays ?? creditFromNotes(current?.notes).credit_days ?? 30,
      );
    }
    const retry = await supabase.from("customers").update(rest).eq("id", payload.id).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) throw error;

  await logAudit({
    userName: payload.userName || "Supervisor",
    companyId: payload.companyId || data.company_id || "asian",
    module: "crm",
    action: "customer_updated",
    recordId: payload.id,
    description: `${payload.userName || "Supervisor"} updated Customer profile for ${data.name} (Phone: ${data.phone || "—"}, Email: ${data.email || "—"}, Address: ${data.address || "—"})`,
  });

  return data as DBCustomer;
}

// ----------------------------------------------------------------------------
// PRODUCTS SERVICE
// ----------------------------------------------------------------------------
export async function createProduct(payload: {
  companyId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number; // Selling Price
  wholesalePrice: number; // Wholesale Price
  onHand: number;
  reorderLevel: number;
  creatorName: string;
}): Promise<DBProduct> {
  const sellingPrice = Number(payload.unitPrice) || 0;
  const wholesalePrice = Number(payload.wholesalePrice) || sellingPrice;

  if (payload.companyId === "all") {
    const allCompanies = ["asian", "avighna", "ganesh", "atharva"];
    const baseRows = allCompanies.map((cId) => ({
      company_id: cId,
      code: payload.code,
      name: payload.name,
      category: payload.category,
      unit: payload.unit,
      unit_price: sellingPrice,
      wholesale_price: wholesalePrice,
      on_hand: payload.onHand,
      reserved: 0,
      reorder_level: payload.reorderLevel,
    }));

    let insertedData: DBProduct[] | null = null;
    const { data, error } = await supabase.from("products").insert(baseRows).select();
    if (error) {
      // If wholesale_price column is not yet migrated in database, encode gracefully in category
      if (error.code === "PGRST204" || error.message?.includes("wholesale_price")) {
        const fallbackRows = baseRows.map((r) => {
          const { wholesale_price, ...rest } = r;
          return {
            ...rest,
            category: `${payload.category} #ws:${wholesalePrice}`,
          };
        });
        const { data: fbData, error: fbError } = await supabase
          .from("products")
          .insert(fallbackRows)
          .select();
        if (fbError) throw fbError;
        insertedData = fbData as DBProduct[];
      } else {
        throw error;
      }
    } else {
      insertedData = data as DBProduct[];
    }

    const firstProduct = insertedData?.[0];
    await logAudit({
      userName: payload.creatorName,
      companyId: "all",
      module: "inventory",
      action: "product_created",
      recordId: firstProduct?.id ? String(firstProduct.id) : payload.code,
      description: `${payload.creatorName} created Product: ${payload.name} (${payload.code}) across All Companies · Selling: ₹${sellingPrice}/${payload.unit}, Wholesale: ₹${wholesalePrice}/${payload.unit}`,
    });

    return {
      ...(insertedData?.[0] || {}),
      category: payload.category,
      unit_price: sellingPrice,
      wholesale_price: wholesalePrice,
    } as DBProduct;
  }

  const baseRow: Partial<DBProduct> = {
    company_id: payload.companyId,
    code: payload.code,
    name: payload.name,
    category: payload.category,
    unit: payload.unit,
    unit_price: sellingPrice,
    wholesale_price: wholesalePrice,
    on_hand: payload.onHand,
    reserved: 0,
    reorder_level: payload.reorderLevel,
  };

  let createdProduct: DBProduct | null = null;
  const { data, error } = await supabase.from("products").insert(baseRow).select().single();
  if (error) {
    if (error.code === "PGRST204" || error.message?.includes("wholesale_price")) {
      delete baseRow.wholesale_price;
      baseRow.category = `${payload.category} #ws:${wholesalePrice}`;
      const { data: fbData, error: fbError } = await supabase
        .from("products")
        .insert(baseRow)
        .select()
        .single();
      if (fbError) throw fbError;
      createdProduct = fbData as DBProduct;
    } else {
      throw error;
    }
  } else {
    createdProduct = data as DBProduct;
  }

  await logAudit({
    userName: payload.creatorName,
    companyId: payload.companyId,
    module: "inventory",
    action: "product_created",
    recordId: createdProduct?.id ? String(createdProduct.id) : payload.code,
    description: `${payload.creatorName} created Product: ${payload.name} (${payload.code}) · Selling: ₹${sellingPrice}/${payload.unit}, Wholesale: ₹${wholesalePrice}/${payload.unit}`,
  });

  return {
    ...createdProduct,
    category: payload.category,
    unit_price: sellingPrice,
    wholesale_price: wholesalePrice,
  } as DBProduct;
}

export async function inboundStock(payload: {
  productId: string;
  additionalQuantity: number;
  newReorderLevel?: number | undefined;
  notes?: string | undefined;
  userName: string;
}): Promise<DBProduct> {
  await requirePermission("inventory.adjust");
  const { data: prod, error: fetchErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", payload.productId)
    .single();
  if (fetchErr || !prod) throw fetchErr || new Error("Product not found");

  const newOnHand = (Number(prod.on_hand) || 0) + Number(payload.additionalQuantity);
  const updates: Record<string, unknown> = { on_hand: newOnHand };
  if (payload.newReorderLevel !== undefined && !isNaN(payload.newReorderLevel)) {
    updates["reorder_level"] = payload.newReorderLevel;
  }

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", payload.productId)
    .select()
    .single();
  if (error) throw error;

  await logAudit({
    userName: payload.userName,
    companyId: prod.company_id,
    module: "inventory",
    action: "inbound_stock",
    recordId: prod.id,
    description: `${payload.userName} added Inbound Stock +${payload.additionalQuantity} ${prod.unit} to ${prod.name} (New on-hand: ${newOnHand}${payload.newReorderLevel !== undefined ? `, Min Reorder Level: ${payload.newReorderLevel}` : ""})`,
  });

  createNotification({
    title: "Inbound Stock Added",
    message: `+${payload.additionalQuantity} ${prod.unit} added to ${prod.name} by ${payload.userName} (On-hand: ${newOnHand}).`,
    type: "info",
    company_id: prod.company_id,
    reference_type: "product",
    reference_id: prod.id,
  }).catch(console.warn);

  return data as DBProduct;
}

export async function updateProductStock(payload: {
  productId: string;
  onHand: number;
  reorderLevel?: number | undefined;
  unitPrice?: number | undefined; // Selling Price
  wholesalePrice?: number | undefined; // Wholesale Price
  unit?: string | undefined;
  name?: string | undefined;
  reason?: string | undefined;
  userName: string;
}): Promise<DBProduct> {
  await requirePermission("inventory.adjust");
  const { data: prod, error: fetchErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", payload.productId)
    .single();
  if (fetchErr || !prod) throw fetchErr || new Error("Product not found");

  const prevOnHand = Number(prod.on_hand) || 0;
  const newOnHand = Number(payload.onHand);
  const delta = newOnHand - prevOnHand;

  const updates: Partial<DBProduct> = {
    on_hand: newOnHand,
    updated_at: new Date().toISOString(),
  };
  if (payload.reorderLevel !== undefined && !isNaN(payload.reorderLevel)) {
    updates.reorder_level = payload.reorderLevel;
  }
  if (payload.unitPrice !== undefined && !isNaN(payload.unitPrice)) {
    updates.unit_price = payload.unitPrice;
  }
  if (payload.wholesalePrice !== undefined && !isNaN(payload.wholesalePrice)) {
    updates.wholesale_price = payload.wholesalePrice;
  }
  if (payload.unit !== undefined && payload.unit.trim()) {
    updates.unit = payload.unit.trim();
  }
  if (payload.name !== undefined && payload.name.trim()) {
    updates.name = payload.name.trim();
  }

  let updatedData: DBProduct | null = null;
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", payload.productId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST204" || error.message?.includes("wholesale_price")) {
      delete updates.wholesale_price;
      if (payload.wholesalePrice !== undefined && !isNaN(payload.wholesalePrice)) {
        const cleanCat = String(prod.category || "")
          .replace(/#ws:[\d.]+/, "")
          .trim();
        updates.category = `${cleanCat} #ws:${payload.wholesalePrice}`;
      }
      const { data: fbData, error: fbError } = await supabase
        .from("products")
        .update(updates)
        .eq("id", payload.productId)
        .select()
        .single();
      if (fbError) throw fbError;
      updatedData = fbData as DBProduct;
    } else {
      throw error;
    }
  } else {
    updatedData = data as DBProduct;
  }

  // Insert inventory_log entry
  try {
    await supabase.from("inventory_logs").insert({
      company_id: prod.company_id,
      product_id: prod.id,
      transaction_type: "ADJUSTMENT",
      quantity: delta,
      previous_on_hand: prevOnHand,
      new_on_hand: newOnHand,
      previous_reserved: Number(prod.reserved) || 0,
      new_reserved: Number(prod.reserved) || 0,
      reference_type: "MANUAL_STOCK_EDIT",
      notes:
        payload.reason ||
        `Physical stock count updated from ${prevOnHand} to ${newOnHand} ${prod.unit}`,
    });
  } catch {
    // Ignore ledger write failure if table does not exist
  }

  const effectiveUnit = updates.unit ?? prod.unit;
  const effectiveReorder = updates.reorder_level ?? prod.reorder_level ?? 0;

  // Log audit
  await logAudit({
    userName: payload.userName,
    companyId: prod.company_id,
    module: "inventory",
    action: "stock_adjusted",
    recordId: prod.id,
    description: `${payload.userName} adjusted stock for ${prod.name} (${prod.code}): on-hand ${prevOnHand} -> ${newOnHand} ${effectiveUnit}${payload.reason ? ` (${payload.reason})` : ""}`,
  });

  if (newOnHand <= effectiveReorder) {
    createNotification({
      title: "Low Stock Alert",
      message: `${prod.name} is down to ${newOnHand} ${effectiveUnit} (At or below minimum threshold).`,
      type: "shortage",
      company_id: prod.company_id,
      reference_type: "product",
      reference_id: prod.id,
    }).catch(console.warn);
  }

  return {
    ...updatedData,
    category: String(updatedData?.category ?? prod.category ?? "")
      .replace(/#ws:[\d.]+/, "")
      .trim(),
    unit_price:
      Number(updatedData?.unit_price) || Number(payload.unitPrice) || Number(prod.unit_price) || 0,
    wholesale_price:
      payload.wholesalePrice !== undefined
        ? Number(payload.wholesalePrice)
        : Number(updatedData?.wholesale_price) || Number(prod.wholesale_price) || 0,
  } as DBProduct;
}

// ----------------------------------------------------------------------------
// PAYMENTS SERVICE
// ----------------------------------------------------------------------------
export async function recordPayment(payload: {
  invoiceId: string;
  companyId: string;
  customerId?: string | undefined;
  amount: number;
  paymentMethod: "Bank Transfer" | "Cheque" | "Cash" | "UPI";
  referenceNumber?: string | undefined;
  notes?: string | undefined;
  recordedByName: string;
}) {
  await requirePermission("payments.record");
  const { error: payErr } = await supabase.from("payments").insert({
    company_id: payload.companyId,
    invoice_id: payload.invoiceId,
    customer_id: payload.customerId,
    amount: payload.amount,
    payment_method: payload.paymentMethod,
    reference_number: payload.referenceNumber,
    notes: payload.notes,
  });

  if (payErr) throw payErr;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", payload.invoiceId)
    .single();

  if (!invErr && inv) {
    const newPaid = Number(inv.paid_amount || 0) + payload.amount;
    const newRemaining = Math.max(0, Number(inv.amount || 0) - newPaid);
    const newStatus = newRemaining <= 0 ? "Paid" : "Partially Paid";
    await supabase
      .from("invoices")
      .update({
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        status: newStatus,
      })
      .eq("id", payload.invoiceId);
  }

  await logAudit({
    userName: payload.recordedByName,
    companyId: payload.companyId,
    module: "finance",
    action: "payment_recorded",
    recordId: payload.invoiceId,
    description: `${payload.recordedByName} recorded payment of ₹${payload.amount.toLocaleString("en-IN")} via ${payload.paymentMethod} for Invoice #${payload.invoiceId}`,
  });

  createNotification({
    title: "Payment Received",
    message: `Received ₹${payload.amount.toLocaleString("en-IN")} (${payload.paymentMethod}) for Invoice #${payload.invoiceId}.`,
    type: "info",
    company_id: payload.companyId,
    reference_type: "invoice",
    reference_id: payload.invoiceId,
  }).catch(console.warn);
}

export interface DBPayment {
  id?: string;
  company_id: string;
  invoice_id: string;
  customer_id?: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at?: string;
}

export async function fetchPayments(companyId: CompanyId): Promise<DBPayment[]> {
  try {
    let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) throw error;
    return data as DBPayment[];
  } catch {
    return [];
  }
}

export async function completeFieldVisit(
  visitId: string,
  outcomeNotes: string,
  completedByName: string,
  companyId: string,
) {
  const { error } = await supabase
    .from("field_visits")
    .update({ status: "Completed", outcome_notes: outcomeNotes })
    .eq("id", visitId);

  if (error) throw error;

  await logAudit({
    userName: completedByName,
    companyId,
    module: "operations",
    action: "field_visit_completed",
    recordId: visitId,
    description: `${completedByName} completed Field Visit #${visitId}: ${outcomeNotes}`,
  });

  createNotification({
    title: "Field Visit Completed",
    message: `${completedByName} completed visit #${visitId}. Notes: ${outcomeNotes || "Completed"}`,
    type: "task",
    company_id: companyId,
    reference_type: "visit",
    reference_id: visitId,
  }).catch(console.warn);
}

// ----------------------------------------------------------------------------
// SUPER ADMIN DELETE OPERATIONS
// ----------------------------------------------------------------------------
export async function deleteFieldVisit(visitId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("field_visits").delete().eq("id", visitId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "operations",
    action: "field_visit_deleted",
    recordId: visitId,
    description: `${adminName} permanently deleted Field Visit #${visitId}`,
  });
  return { success: true };
}

export async function deleteCustomer(customerId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "sales",
    action: "customer_deleted",
    recordId: customerId,
    description: `${adminName} permanently deleted Customer #${customerId}`,
  });
  return { success: true };
}

export async function deleteLead(leadId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "sales",
    action: "lead_deleted",
    recordId: leadId,
    description: `${adminName} permanently deleted Lead #${leadId}`,
  });
  return { success: true };
}

export async function deleteOrder(orderId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  try {
    await supabase.from("payments").delete().eq("invoice_id", orderId);
    await supabase.from("deliveries").delete().eq("order_id", orderId);
    await supabase.from("invoices").delete().eq("order_id", orderId);
    await supabase.from("order_items").delete().eq("order_id", orderId);
  } catch {
    // Ignore cascade cleanup error if child records do not exist
  }
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "orders",
    action: "order_deleted",
    recordId: orderId,
    description: `${adminName} permanently deleted Order #${orderId}`,
  });
  return { success: true };
}

export async function deleteProduct(productIdentifier: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  let query = supabase.from("products").delete();
  if (productIdentifier.includes("-") && productIdentifier.length > 20) {
    query = query.eq("id", productIdentifier);
  } else {
    query = query.eq("code", productIdentifier);
  }
  const { error } = await query;
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "inventory",
    action: "product_deleted",
    recordId: productIdentifier,
    description: `${adminName} permanently deleted Product ${productIdentifier}`,
  });
  return { success: true };
}

export async function updatePurchaseOrder(payload: {
  id: string;
  supplierName?: string | undefined;
  productName?: string | undefined;
  quantity?: number | undefined;
  unit?: string | undefined;
  unitPrice?: number | undefined;
  companyId?: string | undefined;
  updaterName?: string | undefined;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.supplierName !== undefined) updates["supplier_name"] = payload.supplierName;
  if (payload.productName !== undefined) updates["product_name"] = payload.productName;
  if (payload.quantity !== undefined) updates["quantity"] = payload.quantity;
  if (payload.unit !== undefined) updates["unit"] = payload.unit;
  if (payload.unitPrice !== undefined) updates["unit_price"] = payload.unitPrice;
  if (payload.quantity !== undefined && payload.unitPrice !== undefined) {
    updates["total_amount"] = payload.quantity * payload.unitPrice;
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", payload.id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.updaterName || "Supervisor",
    companyId: payload.companyId || "all",
    module: "procurement",
    action: "purchase_order_updated",
    recordId: payload.id,
    description: `${payload.updaterName || "Supervisor"} updated Purchase Order #${payload.id}`,
  });

  return data as DBPurchaseOrder;
}

export async function updateFieldVisit(payload: {
  id: string;
  outcomeNotes?: string | undefined;
  purpose?: string | undefined;
  scheduledDate?: string | undefined;
  scheduledTime?: string | undefined;
  updaterName?: string | undefined;
  companyId?: string | undefined;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.outcomeNotes !== undefined) updates["outcome_notes"] = payload.outcomeNotes;
  if (payload.purpose !== undefined) updates["purpose"] = payload.purpose;
  if (payload.scheduledDate !== undefined) updates["scheduled_date"] = payload.scheduledDate;
  if (payload.scheduledTime !== undefined) updates["scheduled_time"] = payload.scheduledTime;

  const { data, error } = await supabase
    .from("field_visits")
    .update(updates)
    .eq("id", payload.id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userName: payload.updaterName || "Sales Executive",
    companyId: payload.companyId || "all",
    module: "operations",
    action: "field_visit_edited",
    recordId: payload.id,
    description: `${payload.updaterName || "Sales Executive"} updated Field Visit log #${payload.id}`,
  });

  return data as DBFieldVisit;
}

export async function deletePurchaseOrder(poId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("purchase_orders").delete().eq("id", poId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "procurement",
    action: "purchase_order_deleted",
    recordId: poId,
    description: `${adminName} permanently deleted Purchase Order #${poId}`,
  });
  return { success: true };
}

export async function deleteInvoice(invoiceId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  try {
    await supabase.from("payments").delete().eq("invoice_id", invoiceId);
  } catch {
    // Ignore payment cleanup error if no payment record exists
  }
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "finance",
    action: "invoice_deleted",
    recordId: invoiceId,
    description: `${adminName} permanently deleted Invoice #${invoiceId}`,
  });
  return { success: true };
}

export async function deleteDelivery(deliveryId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "logistics",
    action: "delivery_deleted",
    recordId: deliveryId,
    description: `${adminName} permanently deleted Delivery Dispatch #${deliveryId}`,
  });
  return { success: true };
}

export async function deleteTask(taskId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
  await logAudit({
    userName: adminName,
    companyId: "all",
    module: "tasks",
    action: "task_deleted",
    recordId: taskId,
    description: `${adminName} permanently deleted Task #${taskId}`,
  });
  return { success: true };
}

// ----------------------------------------------------------------------------
// CREDIT CONTROL SERVICE (Super Admin Only)
// ----------------------------------------------------------------------------
const fallbackCreditNotes: DBCreditNote[] = [];
const missingTables = new Set<string>();

function tableMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /schema cache|does not exist/i.test(error.message || "")
  );
}

export async function fetchCreditNotes(companyId: CompanyId): Promise<DBCreditNote[]> {
  if (missingTables.has("credit_notes")) {
    return companyId === "all"
      ? [...fallbackCreditNotes]
      : fallbackCreditNotes.filter((n) => n.company_id === companyId);
  }
  try {
    let query = supabase.from("credit_notes").select("*").order("created_at", { ascending: false });
    if (companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;
    if (error || !data) {
      if (tableMissing(error)) missingTables.add("credit_notes");
      throw error;
    }
    return data as DBCreditNote[];
  } catch {
    return companyId === "all"
      ? [...fallbackCreditNotes]
      : fallbackCreditNotes.filter((n) => n.company_id === companyId);
  }
}

export async function createCreditNote(payload: {
  companyId: string;
  customerName: string;
  invoiceId?: string | undefined;
  type: "Credit note" | "Debit note";
  reason: string;
  amount: number;
  userName: string;
}): Promise<DBCreditNote> {
  await requireRole(["accounts", "super_admin"]);
  const noteId = `${payload.type === "Credit note" ? "CN" : "DN"}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newNote: DBCreditNote = {
    id: noteId,
    company_id: payload.companyId,
    customer_name: payload.customerName,
    invoice_id: payload.invoiceId,
    type: payload.type,
    reason: payload.reason,
    amount: payload.amount,
    status: "Posted",
    created_by: payload.userName,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from("credit_notes").insert(newNote).select().single();
    if (!error && data) {
      await logAudit({
        userName: payload.userName,
        companyId: payload.companyId,
        module: "credit_control",
        action: "credit_note_posted",
        recordId: noteId,
        description: `${payload.userName} posted ${payload.type} #${noteId} for ${payload.customerName} (₹${payload.amount.toLocaleString("en-IN")}) - ${payload.reason}`,
      });
      return data as DBCreditNote;
    }
  } catch (err) {
    console.warn("Supabase credit note insert notice:", err);
  }

  fallbackCreditNotes.unshift(newNote);
  return newNote;
}

export async function deleteCreditNote(noteId: string, adminName: string = "Super Admin") {
  const actor = await requireSuperAdmin();
  adminName = actor.name || adminName;
  try {
    await supabase.from("credit_notes").delete().eq("id", noteId);
  } catch (err) {
    console.warn("Supabase credit note delete notice:", err);
  }
  const idx = fallbackCreditNotes.findIndex((n) => n.id === noteId);
  if (idx !== -1) fallbackCreditNotes.splice(idx, 1);
  return { success: true };
}

export async function updateCustomerCreditLimit(
  customerId: string,
  creditLimit: number,
  creditDays: number,
  adminName: string = "Super Admin",
): Promise<DBCustomer> {
  const actor = await requireRole(["accounts", "super_admin"]);
  adminName = actor.name || adminName;
  try {
    const { data, error } = await supabase
      .from("customers")
      .update({
        credit_limit: creditLimit,
        credit_days: creditDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select()
      .single();

    if (!error && data) {
      await logAudit({
        userName: adminName,
        companyId: data.company_id,
        module: "credit_control",
        action: "credit_limit_updated",
        recordId: customerId,
        description: `${adminName} updated credit limit for ${data.name} to ₹${creditLimit.toLocaleString("en-IN")} (${creditDays} days)`,
      });
      return data as DBCustomer;
    }

    if (columnMissing(error)) {
      const { data: current } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();
      if (current) {
        const notes = notesWithCredit(current.notes, creditLimit, creditDays);
        const saved = await supabase
          .from("customers")
          .update({ notes, updated_at: new Date().toISOString() })
          .eq("id", customerId)
          .select()
          .single();
        if (!saved.error && saved.data) {
          return {
            ...(saved.data as DBCustomer),
            credit_limit: creditLimit,
            credit_days: creditDays,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Supabase customer credit update notice:", err);
  }

  const found = fallbackCustomers.find((c) => c.id === customerId);
  if (found) {
    found.credit_limit = creditLimit;
    found.credit_days = creditDays;
    return { ...found };
  }
  return {
    id: customerId,
    company_id: "asian",
    name: "Customer",
    initials: "CU",
    status: "Active",
    credit_limit: creditLimit,
    credit_days: creditDays,
  };
}

// ----------------------------------------------------------------------------
// VEHICLES & FLEET SERVICE
// ----------------------------------------------------------------------------
export const fallbackVehicles: DBVehicle[] = [
  {
    id: "FL-101",
    name: "Tata 1109",
    plate_number: "KA-01-AB-1024",
    status: "Available / At Godown",
    driver_name: "Mahesh Patel",
    driver_phone: "+91 98450 11223",
    capacity: "5 Tons",
  },
  {
    id: "FL-102",
    name: "Eicher Pro 2049",
    plate_number: "KA-05-CD-3312",
    status: "Available / At Godown",
    driver_name: "Kiran Joshi",
    driver_phone: "+91 98450 44556",
    capacity: "3.5 Tons",
  },
  {
    id: "FL-103",
    name: "Mahindra Bolero Maxi",
    plate_number: "KA-03-EF-9981",
    status: "Available / At Godown",
    driver_name: "Ramesh Yadav",
    driver_phone: "+91 98450 77889",
    capacity: "1.5 Tons",
  },
];

function mapVehicle(v: Record<string, unknown>): DBVehicle {
  const id = String(v["id"] || "");
  const name = String(v["name"] || "");
  const plate = String(v["plate_number"] || "");
  const status = (v["status"] as VehicleStatus) || "Available / At Godown";
  const compId = v["company_id"] ? String(v["company_id"]) : undefined;
  const cap = v["capacity"] ? String(v["capacity"]) : undefined;
  const drvName = v["driver_name"] ? String(v["driver_name"]) : undefined;
  const drvPhone = v["driver_phone"] ? String(v["driver_phone"]) : undefined;
  const makeModel = (v["make_model"] as string | undefined) || name || undefined;
  const asgnDrv = (v["assigned_driver_name"] as string | undefined) || drvName;
  const asgnPhone = (v["assigned_driver_phone"] as string | undefined) || drvPhone;
  const created = v["created_at"] ? String(v["created_at"]) : undefined;
  const updated = v["updated_at"] ? String(v["updated_at"]) : undefined;

  return {
    id,
    name,
    plate_number: plate,
    status,
    company_id: compId,
    capacity: cap,
    driver_name: drvName,
    driver_phone: drvPhone,
    make_model: makeModel,
    assigned_driver_name: asgnDrv,
    assigned_driver_phone: asgnPhone,
    created_at: created,
    updated_at: updated,
  };
}

export async function fetchVehicles(companyId?: string): Promise<DBVehicle[]> {
  if (missingTables.has("vehicles")) return [...fallbackVehicles];
  try {
    let query = supabase.from("vehicles").select("*").order("name");
    if (companyId && companyId !== "all") {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data, error } = await query;
    if (tableMissing(error)) {
      missingTables.add("vehicles");
      return [...fallbackVehicles];
    }
    if (error || !data) throw error;
    return (data as Array<Record<string, unknown>>).map(mapVehicle);
  } catch {
    return [...fallbackVehicles];
  }
}

export async function createVehicle(
  payload: {
    name?: string | undefined;
    makeModel?: string | undefined;
    plateNumber: string;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    capacity?: string | undefined;
    status?: VehicleStatus | undefined;
    companyId?: string | undefined;
    creatorName?: string | undefined;
  },
  creatorName: string = "Super Admin",
): Promise<DBVehicle> {
  const actor = await requireAnyPermission(["admin.manage", "orders.approve"]);
  const author = payload.creatorName || creatorName || actor.name;
  const vehicleName = payload.name?.trim() || payload.makeModel?.trim() || "Commercial Truck";
  const newVehicle: DBVehicle = {
    id: `FL-${Math.floor(100 + Math.random() * 900)}`,
    company_id: payload.companyId || "asian",
    name: vehicleName,
    make_model: vehicleName,
    plate_number: payload.plateNumber.trim().toUpperCase(),
    status: payload.status || "Available / At Godown",
    driver_name: payload.driverName?.trim() || undefined,
    driver_phone: payload.driverPhone?.trim() || undefined,
    assigned_driver_name: payload.driverName?.trim() || undefined,
    assigned_driver_phone: payload.driverPhone?.trim() || undefined,
    capacity: payload.capacity?.trim() || "3.5 Tons",
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        id: newVehicle.id,
        company_id: newVehicle.company_id,
        name: newVehicle.name,
        plate_number: newVehicle.plate_number,
        status: newVehicle.status,
        driver_name: newVehicle.driver_name,
        driver_phone: newVehicle.driver_phone,
        capacity: newVehicle.capacity,
      })
      .select()
      .single();

    if (!error && data) {
      await logAudit({
        userName: author,
        companyId: newVehicle.company_id,
        module: "fleet",
        action: "vehicle_created",
        recordId: newVehicle.id,
        description: `${author} added vehicle ${newVehicle.name} (${newVehicle.plate_number}) with status "${newVehicle.status}"`,
      });
      return mapVehicle(data as Record<string, unknown>);
    }
  } catch (err) {
    console.warn("Supabase createVehicle notice:", err);
  }

  fallbackVehicles.unshift(newVehicle);
  await logAudit({
    userName: author,
    companyId: newVehicle.company_id,
    module: "fleet",
    action: "vehicle_created",
    recordId: newVehicle.id,
    description: `${author} added vehicle ${newVehicle.name} (${newVehicle.plate_number}) with status "${newVehicle.status}"`,
  });
  return newVehicle;
}

export async function updateVehicle(
  id: string,
  updates: Partial<DBVehicle> & {
    makeModel?: string | undefined;
    plateNumber?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    capacity?: string | undefined;
    companyId?: string | undefined;
    updatedByName?: string | undefined;
  },
  updaterName: string = "Super Admin",
): Promise<DBVehicle> {
  const author = updates.updatedByName || updaterName;
  const cleanUpdates: Record<string, unknown> = { ...updates };
  if (updates.makeModel && !cleanUpdates["name"]) cleanUpdates["name"] = updates.makeModel;
  if (updates.plateNumber && !cleanUpdates["plate_number"])
    cleanUpdates["plate_number"] = updates.plateNumber;
  if (updates.driverName && !cleanUpdates["driver_name"])
    cleanUpdates["driver_name"] = updates.driverName;
  if (updates.driverPhone && !cleanUpdates["driver_phone"])
    cleanUpdates["driver_phone"] = updates.driverPhone;
  if (updates.companyId && !cleanUpdates["company_id"]) cleanUpdates["company_id"] = updates.companyId;

  delete cleanUpdates["makeModel"];
  delete cleanUpdates["plateNumber"];
  delete cleanUpdates["driverName"];
  delete cleanUpdates["driverPhone"];
  delete cleanUpdates["companyId"];
  delete cleanUpdates["updatedByName"];

  try {
    const { data, error } = await supabase
      .from("vehicles")
      .update({
        ...cleanUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      await logAudit({
        userName: author,
        companyId: data.company_id,
        module: "fleet",
        action: "vehicle_updated",
        recordId: id,
        description: `${author} updated vehicle ${data.name} (${data.plate_number})`,
      });
      return mapVehicle(data as Record<string, unknown>);
    }
  } catch (err) {
    console.warn("Supabase updateVehicle notice:", err);
  }

  const idx = fallbackVehicles.findIndex((v) => v.id === id);
  if (idx !== -1) {
    fallbackVehicles[idx] = mapVehicle({ ...fallbackVehicles[idx], ...cleanUpdates });
    await logAudit({
      userName: author,
      companyId: fallbackVehicles[idx]?.company_id,
      module: "fleet",
      action: "vehicle_updated",
      recordId: id,
      description: `${author} updated vehicle ${fallbackVehicles[idx]?.name} (${fallbackVehicles[idx]?.plate_number})`,
    });
    return fallbackVehicles[idx]!;
  }

  throw new Error(`Vehicle ${id} not found.`);
}

export async function deleteVehicle(
  id: string,
  deleterName: string = "Super Admin",
): Promise<boolean> {
  const actor = await requireSuperAdmin();
  deleterName = actor.name || deleterName;
  try {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (!error) {
      await logAudit({
        userName: deleterName,
        module: "fleet",
        action: "vehicle_deleted",
        recordId: id,
        description: `${deleterName} deleted vehicle ${id}`,
      });
    }
  } catch (err) {
    console.warn("Supabase deleteVehicle notice:", err);
  }

  const idx = fallbackVehicles.findIndex((v) => v.id === id);
  if (idx !== -1) {
    fallbackVehicles.splice(idx, 1);
  }
  await logAudit({
    userName: deleterName,
    module: "fleet",
    action: "vehicle_deleted",
    recordId: id,
    description: `${deleterName} deleted vehicle ${id}`,
  });
  return true;
}

export async function updateVehicleStatus(
  idOrPlate: string,
  status: VehicleStatus,
  updaterName: string = "Logistics",
  notes?: string,
): Promise<DBVehicle | null> {
  const norm = idOrPlate.trim().toUpperCase();
  try {
    const { data: matched } = await supabase
      .from("vehicles")
      .select("*")
      .or(`id.ilike.${norm},plate_number.ilike.${norm}`)
      .maybeSingle();

    if (matched) {
      const { data, error } = await supabase
        .from("vehicles")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matched.id)
        .select()
        .single();

      if (!error && data) {
        await logAudit({
          userName: updaterName,
          companyId: data.company_id,
          module: "fleet",
          action: "vehicle_status_changed",
          recordId: data.id,
          description: `${updaterName} updated vehicle ${data.plate_number} status to "${status}"${notes ? ` · ${notes}` : ""}`,
        });
        return data as DBVehicle;
      }
    }
  } catch (err) {
    console.warn("Supabase updateVehicleStatus notice:", err);
  }

  const fallback = fallbackVehicles.find(
    (v) => v.id.toUpperCase() === norm || v.plate_number.toUpperCase() === norm,
  );
  if (fallback) {
    fallback.status = status;
    await logAudit({
      userName: updaterName,
      companyId: fallback.company_id,
      module: "fleet",
      action: "vehicle_status_changed",
      recordId: fallback.id,
      description: `${updaterName} updated vehicle ${fallback.plate_number} status to "${status}"${notes ? ` · ${notes}` : ""}`,
    });
    return fallback;
  }

  return null;
}

export async function assignOrderVehicle(
  orderId: string,
  payload: {
    transportMode: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle";
    vehicleNumber?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    assignedByName: string;
    assignedByRole?: string | undefined;
  },
): Promise<DBOrder> {
  if (payload.transportMode === "Manufacturer Vehicle") {
    const updates = {
      transport_mode: "Manufacturer Vehicle" as const,
      assigned_vehicle: "Manufacturer Arranged",
      assigned_driver: payload.driverName || "Manufacturer Driver",
      assigned_driver_phone: payload.driverPhone,
    };
    try {
      const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
      if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
        const { data: cur } = await supabase
          .from("orders")
          .select("notes")
          .eq("id", orderId)
          .maybeSingle();
        const baseNotes = (cur?.notes || "").replace(/\[Transport:.*?\]/g, "").trim();
        const tag = `[Transport: Manufacturer Vehicle · Vehicle: Manufacturer Arranged · Driver: ${updates.assigned_driver}${updates.assigned_driver_phone ? ` · Phone: ${updates.assigned_driver_phone}` : ""}]`;
        await supabase
          .from("orders")
          .update({ notes: `${baseNotes} ${tag}`.trim() })
          .eq("id", orderId);
      }
    } catch (e) {
      console.warn("Order transport update notice:", e);
    }
    await logAudit({
      userName: payload.assignedByName,
      module: "orders",
      action: "transport_assigned",
      recordId: orderId,
      description: `${payload.assignedByName} (${payload.assignedByRole || "Staff"}) set Order #${orderId} transport to Manufacturer Vehicle (Direct Collection)`,
    });
    return {
      id: orderId,
      status: "Approved",
      ...updates,
    } as unknown as DBOrder;
  }

  // Logistics / Assigned Vehicle
  const vehicleNo = payload.vehicleNumber?.trim();
  if (!vehicleNo) {
    throw new Error("Vehicle number is required for Logistics / Assigned Vehicle path.");
  }

  // CRITICAL RULE: A vehicle that is currently dispatched/on delivery MUST NOT be assignable
  const allVehicles = await fetchVehicles();
  const matchedVehicle = allVehicles.find(
    (v) =>
      v.plate_number.toUpperCase() === vehicleNo.toUpperCase() ||
      v.id.toUpperCase() === vehicleNo.toUpperCase() ||
      v.name.toUpperCase().includes(vehicleNo.toUpperCase()),
  );

  if (matchedVehicle && matchedVehicle.status === "Dispatched / On Delivery") {
    throw new Error(
      `Vehicle "${matchedVehicle.name} (${matchedVehicle.plate_number})" is currently Dispatched / On Delivery and cannot be assigned to another order.`,
    );
  }

  // Mark vehicle assigned/booked
  if (matchedVehicle) {
    await updateVehicleStatus(
      matchedVehicle.id,
      "Assigned / Booked",
      payload.assignedByName,
      `Assigned to Order #${orderId}`,
    );
  }

  const updates = {
    transport_mode: "Logistics / Assigned Vehicle" as const,
    assigned_vehicle: matchedVehicle?.plate_number || vehicleNo,
    assigned_driver: payload.driverName || matchedVehicle?.driver_name || "Logistics Driver",
    assigned_driver_phone: payload.driverPhone || matchedVehicle?.driver_phone,
  };

  try {
    const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
    if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
      const { data: cur } = await supabase
        .from("orders")
        .select("notes")
        .eq("id", orderId)
        .maybeSingle();
      const baseNotes = (cur?.notes || "").replace(/\[Transport:.*?\]/g, "").trim();
      const tag = `[Transport: Logistics / Assigned Vehicle · Vehicle: ${updates.assigned_vehicle} · Driver: ${updates.assigned_driver}${updates.assigned_driver_phone ? ` · Phone: ${updates.assigned_driver_phone}` : ""}]`;
      await supabase
        .from("orders")
        .update({ notes: `${baseNotes} ${tag}`.trim() })
        .eq("id", orderId);
    }
  } catch (e) {
    console.warn("Order transport update notice:", e);
  }

  await logAudit({
    userName: payload.assignedByName,
    module: "orders",
    action: "vehicle_assigned",
    recordId: orderId,
    description: `${payload.assignedByName} (${payload.assignedByRole || "Staff"}) assigned Vehicle ${updates.assigned_vehicle} & Driver ${updates.assigned_driver} to Order #${orderId}`,
  });

  return {
    id: orderId,
    status: "Approved",
    ...updates,
  } as unknown as DBOrder;
}
