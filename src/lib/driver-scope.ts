/** A logistics login only keeps records whose assignee text contains their name. */
export function assignedTo(field: string | null | undefined, personName: string) {
  const record = (field || "").trim().toLowerCase();
  const person = personName.trim().toLowerCase();
  if (!record || !person) return false;
  return record.includes(person);
}

type Viewer = { role?: string; name?: string } | null;

type OrderRow = {
  id: string;
  assigned_driver?: string | null | undefined;
  customer_id?: string | null | undefined;
  customer_name: string;
};
type DeliveryRow = {
  order_id: string;
  driver_name?: string | null | undefined;
  vehicle_number?: string | null | undefined;
};
type InvoiceRow = { id: string; order_id: string };
type PaymentRow = { invoice_id: string };
type CustomerRow = { id?: string | null | undefined; name: string };
type TaskRow = { assigned_to_name?: string | null | undefined };
type VehicleRow = { id: string; plate_number: string; driver_name?: string | null | undefined };

export type DriverScope = {
  orders?: OrderRow[];
  deliveries?: DeliveryRow[];
  invoices?: InvoiceRow[];
  payments?: PaymentRow[];
  customers?: CustomerRow[];
  tasks?: TaskRow[];
  vehicles?: VehicleRow[];
  products?: unknown[];
  leads?: unknown[];
  visits?: unknown[];
  purchaseOrders?: unknown[];
  creditNotes?: unknown[];
};

export function scopeForDriver<T extends DriverScope>(user: Viewer, data: T): T {
  if (user?.role !== "logistics" || !user.name) return data;

  const deliveries = (data.deliveries ?? []).filter((d) => assignedTo(d.driver_name, user.name!));
  const ownedOrders = new Set(deliveries.map((d) => d.order_id));
  const orders = (data.orders ?? []).filter(
    (o) => ownedOrders.has(o.id) || assignedTo(o.assigned_driver, user.name!),
  );
  for (const order of orders) ownedOrders.add(order.id);
  const invoices = (data.invoices ?? []).filter((i) => ownedOrders.has(i.order_id));
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const payments = (data.payments ?? []).filter((p) => invoiceIds.has(p.invoice_id));
  const names = new Set(orders.map((o) => o.customer_name.trim().toLowerCase()));
  const customerIds = new Set(orders.map((o) => o.customer_id).filter(Boolean));
  const customers = (data.customers ?? []).filter(
    (c) =>
      (c.id && customerIds.has(c.id)) || names.has(c.name.trim().toLowerCase()),
  );
  const tasks = (data.tasks ?? []).filter((t) => assignedTo(t.assigned_to_name, user.name!));
  const vehicles = (data.vehicles ?? []).filter(
    (v) =>
      assignedTo(v.driver_name, user.name!) ||
      deliveries.some((d) => {
        const plate = (d.vehicle_number || "").toUpperCase();
        return plate === v.plate_number.toUpperCase() || plate === v.id.toUpperCase();
      }),
  );

  return {
    ...data,
    ...(data.orders ? { orders } : {}),
    ...(data.deliveries ? { deliveries } : {}),
    ...(data.invoices ? { invoices } : {}),
    ...(data.payments ? { payments } : {}),
    ...(data.customers ? { customers } : {}),
    ...(data.tasks ? { tasks } : {}),
    ...(data.vehicles ? { vehicles } : {}),
    ...(data.products ? { products: [] } : {}),
    ...(data.leads ? { leads: [] } : {}),
    ...(data.visits ? { visits: [] } : {}),
    ...(data.purchaseOrders ? { purchaseOrders: [] } : {}),
    ...(data.creditNotes ? { creditNotes: [] } : {}),
  } as T;
}
