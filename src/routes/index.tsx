import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FileCheck2,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useWorkspace } from "@/components/workspace-provider";
import { CompanyLogo } from "@/components/workspace-shell";
import { RevenueChart } from "@/components/revenue-chart";
import { TaskWorkspace } from "@/components/task-workspace";
import { companies, money } from "@/lib/workspace-data";
import { scopeForDriver } from "@/lib/driver-scope";
import {
  fetchOrders,
  fetchInvoices,
  fetchProducts,
  fetchDeliveries,
  fetchPurchaseOrders,
  availableFromStock,
  outboundOrderedQuantity,
  type DBOrder,
  type DBInvoice,
  type DBProduct,
  type DBPurchaseOrder,
} from "@/lib/erp-service";

function orderDayKey(order: DBOrder) {
  const raw = order.created_at || "";
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDayKey(daysBack: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SalesOrderRange = "today" | "5days" | "1month" | "custom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Avighna One" },
      {
        name: "description",
        content: "Your multi-company command center for revenue, orders, dispatch and team work.",
      },
      { property: "og:title", content: "Overview — Avighna One" },
      { property: "og:description", content: "Four companies. One clear view of your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { company, currentUser, hasPermission } = useWorkspace();
  const selected = companies.find((c) => c.id === company);
  const isSupervisor =
    currentUser?.role === "supervisor" ||
    Boolean(currentUser?.roleName?.toLowerCase().includes("supervisor"));
  const isSales = currentUser?.role === "sales";
  const [period, setPeriod] = useState("This year");
  const [customize, setCustomize] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [showCompanies, setShowCompanies] = useState(true);
  const [showAttention, setShowAttention] = useState(true);
  const [salesOrderRange, setSalesOrderRange] = useState<SalesOrderRange>("today");
  const [salesCustomFrom, setSalesCustomFrom] = useState(() => todayKey());
  const [salesCustomTo, setSalesCustomTo] = useState(() => todayKey());

  const [dbOrders, setDbOrders] = useState<DBOrder[]>([]);
  const [dbInvoices, setDbInvoices] = useState<DBInvoice[]>([]);
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);
  const [dbPOs, setDbPOs] = useState<DBPurchaseOrder[]>([]);

  const reloadOverview = useCallback(() => {
    Promise.all([
      fetchOrders(company),
      fetchInvoices(company),
      fetchProducts(company),
      fetchDeliveries(company),
      fetchPurchaseOrders(company),
    ]).then(([orders, invoices, products, deliveries, purchaseOrders]) => {
      const scoped = scopeForDriver(currentUser, {
        orders,
        invoices,
        products,
        deliveries,
        purchaseOrders,
      });
      setDbOrders(scoped.orders ?? []);
      setDbInvoices(scoped.invoices ?? []);
      setDbProducts(scoped.products ?? []);
      setDbPOs(scoped.purchaseOrders ?? []);
    });
  }, [company, currentUser]);

  useEffect(() => {
    reloadOverview();
  }, [reloadOverview]);

  const totalRevenue = dbInvoices.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
  const activeOrdersCount = dbOrders.filter(
    (o) => !["Delivered", "Rejected"].includes(o.status),
  ).length;
  const pendingDispatchCount = dbOrders.filter((o) => o.status === "Ready to dispatch").length;
  const outstandingAmount = dbInvoices.reduce(
    (sum, i) => sum + (Number(i.remaining_amount) || 0),
    0,
  );
  const approvalsWaitingCount = dbOrders.filter((o) =>
    ["Pending approval", "Procuring"].includes(o.status),
  ).length;

  const lowStockProducts = useMemo(() => {
    return dbProducts
      .map((p) => {
        const outbound = outboundOrderedQuantity(dbOrders, p);
        const available = availableFromStock(Number(p.on_hand) || 0, outbound);
        return { product: p, available, outbound };
      })
      .filter(({ product, available }) => available <= Number(product.reorder_level || 0))
      .sort((a, b) => a.available - b.available);
  }, [dbProducts, dbOrders]);
  const lowStockCount = lowStockProducts.length;

  const pendingOrdersToday = useMemo(() => {
    const key = todayKey();
    return dbOrders.filter((o) => {
      const pending = ["Pending approval", "Procuring", "Approved", "Ready to dispatch"].includes(
        o.status,
      );
      if (!pending) return false;
      // Prefer today's orders; keep older still-pending approvals visible for supervisor action.
      return orderDayKey(o) === key || ["Pending approval", "Procuring"].includes(o.status);
    });
  }, [dbOrders]);

  const inboundExpectedToday = useMemo(() => {
    const key = todayKey();
    return dbPOs.filter((po) => {
      if (po.status === "Received" || po.status === "Rejected") return false;
      const eta = (po.eta || "").slice(0, 10);
      // Expected today: ETA is today, or open inbound with no ETA yet (treat as due).
      if (eta) return eta === key;
      return ["In transit", "Requested", "Approval"].includes(po.status);
    });
  }, [dbPOs]);

  const todaysOrders = useMemo(() => {
    const key = todayKey();
    return dbOrders.filter((o) => orderDayKey(o) === key);
  }, [dbOrders]);

  const todaysOrderKpis = useMemo(() => {
    if (todaysOrders.length === 0) return [];
    const value = todaysOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const pendingApproval = todaysOrders.filter((o) =>
      ["Pending approval", "Procuring"].includes(o.status),
    ).length;
    const readyDispatch = todaysOrders.filter((o) => o.status === "Ready to dispatch").length;
    const inFulfillment = todaysOrders.filter((o) =>
      ["Approved", "Out for delivery", "Ready to dispatch", "Delivered"].includes(o.status),
    ).length;
    const canSeeAmounts = hasPermission("finance.view_amounts");
    return [
      {
        name: "Orders today",
        value: String(todaysOrders.length),
        note: "Received today",
        icon: ShoppingBag,
      },
      {
        name: "Today’s order value",
        value: canSeeAmounts ? money(value) : "—",
        note: "Gross booked today",
        icon: Wallet,
      },
      {
        name: "Awaiting approval",
        value: String(pendingApproval),
        note: "Needs supervisor / owner",
        icon: Clock,
      },
      {
        name: "Moving today",
        value: String(inFulfillment || readyDispatch),
        note:
          readyDispatch > 0
            ? `${readyDispatch} ready to dispatch`
            : "Approved / in transit / delivered",
        icon: Truck,
      },
    ];
  }, [todaysOrders, hasPermission]);

  // Accounts + Super Admin see money amounts (receivables / payables / invoice figures).
  const hideRevenue = !hasPermission("finance.view_amounts");
  // Accounts keeps money, payables & receivables — but not the Total revenue roll-up.
  const isAccounts = currentUser?.role === "accounts";
  const hideTotalRevenue = hideRevenue || isAccounts;
  const payablesAmount = dbPOs
    .filter((p) => !["Rejected", "Received"].includes(p.status))
    .reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  const paymentsDueCount = useMemo(
    () => dbInvoices.filter((i) => i.status !== "Paid" && Number(i.remaining_amount) > 0).length,
    [dbInvoices],
  );

  const salesRecentOrders = useMemo(() => {
    const end = todayKey();
    let start = end;
    if (salesOrderRange === "5days") start = shiftDayKey(4); // today + prior 4 = 5 days
    else if (salesOrderRange === "1month") start = shiftDayKey(29);
    else if (salesOrderRange === "custom") {
      start = salesCustomFrom || end;
      const customEnd = salesCustomTo || end;
      return dbOrders
        .filter((o) => {
          const key = orderDayKey(o);
          if (!key) return false;
          return key >= start && key <= customEnd;
        })
        .slice()
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
    return dbOrders
      .filter((o) => {
        const key = orderDayKey(o);
        if (!key) return false;
        return key >= start && key <= end;
      })
      .slice()
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [dbOrders, salesOrderRange, salesCustomFrom, salesCustomTo]);

  const salesRangeLabel =
    salesOrderRange === "today"
      ? "Today"
      : salesOrderRange === "5days"
        ? "Last 5 days"
        : salesOrderRange === "1month"
          ? "Last 1 month"
          : salesCustomFrom && salesCustomTo
            ? `${salesCustomFrom} → ${salesCustomTo}`
            : "Custom dates";

  if (isSales) {
    const firstName = currentUser ? currentUser.name.split(" ")[0] : "Sales";
    return (
      <main className="content">
        <div className="heading-row flex flex-wrap items-end justify-between gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-2">Sales desk</p>
            <h1 className="page-heading">
              Good morning, {firstName}{" "}
              <span className="font-normal text-primary">↗</span>
            </h1>
            <p className="mt-2 text-xs text-muted-foreground max-w-xl">
              Your orders and collections — clear status, no clutter.
            </p>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">Active orders</p>
              <ShoppingBag className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{activeOrdersCount}</p>
            <span className="trend">In your pipeline</span>
          </div>
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                Pending dispatch
              </p>
              <Truck className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{pendingDispatchCount}</p>
            <span className="trend">Ready to move</span>
          </div>
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                Awaiting approval
              </p>
              <Clock className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{approvalsWaitingCount}</p>
            <span className="trend">With supervisor</span>
          </div>
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">Orders today</p>
              <CalendarDays className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{todaysOrders.length}</p>
            <span className="trend">Booked today</span>
          </div>
          {hasPermission("payments.record") && (
            <div className="kpi">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground truncate">Payments due</p>
                <CreditCard className="kpi-icon shrink-0" />
              </div>
              <p className="kpi-value">{paymentsDueCount}</p>
              <span className="trend">Open invoices</span>
            </div>
          )}
        </div>

        <section className="panel">
          <div className="panel-head flex-wrap gap-3">
            <div className="min-w-0">
              <h2 className="panel-title truncate">Recent orders</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {salesRecentOrders.length} order{salesRecentOrders.length === 1 ? "" : "s"} ·{" "}
                {salesRangeLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Filter recent orders by date"
                value={salesOrderRange}
                onChange={(e) => setSalesOrderRange(e.target.value as SalesOrderRange)}
                className="toolbar-select rounded-md border border-border bg-background text-foreground"
              >
                <option value="today">Today</option>
                <option value="5days">Last 5 days</option>
                <option value="1month">Last 1 month</option>
                <option value="custom">Custom dates</option>
              </select>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Link to="/orders">
                  All orders
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </div>
          </div>

          {salesOrderRange === "custom" && (
            <div className="flex flex-wrap items-end gap-3 px-4 sm:px-[23px] pb-3 border-b border-border">
              <label className="drawer-field !gap-1 min-w-[140px] flex-1">
                From
                <input
                  type="date"
                  value={salesCustomFrom}
                  max={salesCustomTo || todayKey()}
                  onChange={(e) => setSalesCustomFrom(e.target.value)}
                  className="text-xs"
                />
              </label>
              <label className="drawer-field !gap-1 min-w-[140px] flex-1">
                To
                <input
                  type="date"
                  value={salesCustomTo}
                  min={salesCustomFrom || undefined}
                  max={todayKey()}
                  onChange={(e) => setSalesCustomTo(e.target.value)}
                  className="text-xs"
                />
              </label>
            </div>
          )}

          {salesRecentOrders.length === 0 ? (
            <p className="px-4 sm:px-[23px] py-10 text-sm text-muted-foreground">
              No orders for {salesRangeLabel.toLowerCase()}.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {salesRecentOrders.slice(0, 20).map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-[23px] py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {o.customer_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      #{o.id}
                      {orderDayKey(o) ? ` · ${orderDayKey(o)}` : ""}
                      {o.items_summary ? ` · ${o.items_summary}` : ""}
                    </p>
                  </div>
                  <span
                    className={`status shrink-0 ${
                      o.status === "Delivered"
                        ? "success"
                        : o.status === "Pending approval" || o.status === "Procuring"
                          ? "warning"
                          : "brand"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-[22px] grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between text-xs font-semibold px-4"
          >
            <Link to="/customers">
              Customers
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between text-xs font-semibold px-4"
          >
            <Link to="/leads">
              Leads
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          {hasPermission("payments.record") ? (
            <Button
              asChild
              variant="outline"
              className="h-11 justify-between text-xs font-semibold px-4"
            >
              <Link to="/accounts">
                Payments due
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-11 justify-between text-xs font-semibold px-4"
            >
              <Link to="/field-visits">
                Field visits
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-[22px]">
          <section className="panel">
            <TaskWorkspace compact />
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" />
            Sales desk · Orders · Visits · Collections
          </span>
          <span className="font-medium">Salesperson dashboard</span>
        </footer>
      </main>
    );
  }

  if (isSupervisor) {
    const firstName = currentUser ? currentUser.name.split(" ")[0] : "Supervisor";
    return (
      <main className="content">
        <div className="heading-row flex items-end justify-between gap-5 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-2">Supervisor desk</p>
            <h1 className="page-heading">
              Good morning, {firstName}{" "}
              <span className="font-normal text-primary">↗</span>
            </h1>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected ? selected.name : "Today’s floor priorities"} — pending orders, inbound
              stock, and low inventory.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-9 text-xs shrink-0">
            <Link to="/tasks">
              Open tasks
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                Pending orders
              </p>
              <ShoppingBag className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{pendingOrdersToday.length}</p>
            <span className="trend">Needs action today</span>
          </div>
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                Inbound today
              </p>
              <ArrowDownLeft className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{inboundExpectedToday.length}</p>
            <span className="trend">Expected receipts</span>
          </div>
          <div className="kpi">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                Going out of stock
              </p>
              <Package className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{lowStockCount}</p>
            <span className="trend">At or below reorder</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
          <section className="panel">
            <div className="panel-head">
              <div className="min-w-0">
                <h2 className="panel-title truncate">Pending orders today</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Approvals, procuring, and ready-to-move orders
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold shrink-0"
              >
                <Link to="/orders">
                  All orders
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </div>
            {pendingOrdersToday.length === 0 ? (
              <p className="px-4 sm:px-[23px] py-8 text-sm text-muted-foreground">
                No pending orders right now.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {pendingOrdersToday.slice(0, 8).map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-[23px] py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {o.customer_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        #{o.id}
                        {o.items_summary ? ` · ${o.items_summary}` : ""}
                      </p>
                    </div>
                    <span
                      className={`status shrink-0 ${
                        o.status === "Pending approval" || o.status === "Procuring"
                          ? "warning"
                          : "brand"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div className="min-w-0">
                <h2 className="panel-title truncate">Inventory due today</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Purchase orders expected to arrive
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold shrink-0"
              >
                <Link to="/inventory">
                  Inventory
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </div>
            {inboundExpectedToday.length === 0 ? (
              <p className="px-4 sm:px-[23px] py-8 text-sm text-muted-foreground">
                Nothing scheduled to receive today.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {inboundExpectedToday.slice(0, 8).map((po) => (
                  <div
                    key={po.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-[23px] py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {po.product_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {po.supplier_name} · {po.quantity} {po.unit}
                        {po.eta ? ` · ETA ${po.eta.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`status shrink-0 ${
                        po.status === "In transit" ? "brand" : "warning"
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="panel mt-[22px]">
          <div className="panel-head">
            <div className="min-w-0">
              <h2 className="panel-title truncate">Going out of stock</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Available at or below reorder level
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold shrink-0"
            >
              <Link to="/inventory">
                Restock
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="px-4 sm:px-[23px] py-8 text-sm text-muted-foreground">
              All tracked SKUs are above reorder level.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {lowStockProducts.slice(0, 10).map(({ product, available }) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-[23px] py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {product.code ? `${product.code} · ` : ""}
                      Reorder at {product.reorder_level} {product.unit}
                    </p>
                  </div>
                  <span className="status warning shrink-0">
                    {available <= 0 ? "Out of stock" : `${available} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-[22px]">
          <section className="panel">
            <TaskWorkspace compact />
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" />
            Live floor view · Orders · Inbound · Stock
          </span>
          <span className="font-medium">Supervisor dashboard</span>
        </footer>
      </main>
    );
  }

  const kpis = [
    ...(!hideTotalRevenue
      ? [
          {
            name: "Total revenue",
            value: money(totalRevenue),
            growth: totalRevenue > 0 ? "+100%" : "₹0",
            note: "Collected revenue",
            icon: Wallet,
          },
        ]
      : isAccounts && !hideRevenue
        ? [
            {
              name: "Payables",
              value: money(payablesAmount),
              growth: `${dbPOs.filter((p) => !["Rejected", "Received"].includes(p.status)).length} open POs`,
              note: "Supplier commitments",
              icon: Wallet,
            },
          ]
        : []),
    {
      name: "Active orders",
      value: String(activeOrdersCount),
      growth: `${activeOrdersCount} in pipeline`,
      note: "In progress",
      icon: ShoppingBag,
    },
    {
      name: "Pending dispatch",
      value: String(pendingDispatchCount),
      growth: `${pendingDispatchCount} ready`,
      note: "Awaiting dispatch",
      icon: Truck,
    },
    ...(!hideRevenue
      ? [
          {
            name: "Receivables",
            value: money(outstandingAmount),
            growth: `${dbInvoices.filter((i) => i.status !== "Paid").length} invoices`,
            note: "Awaiting collection",
            icon: ArrowDownLeft,
          },
        ]
      : []),
  ];
  return (
    <main className="content">
      <div className="heading-row flex items-end justify-between gap-5 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">Your business, in focus</p>
          <h1 className="page-heading">
            Good morning, {currentUser ? currentUser.name.split(" ")[0] : "Team"}{" "}
            <span className="font-normal text-primary">↗</span>
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {selected ? selected.name : "Four companies. One connected view."}{" "}
            <span className="mobile-hide">
              {currentUser
                ? `Signed in as ${currentUser.roleName}.`
                : "Here’s where things stand today."}
            </span>
          </p>
        </div>
        <div className="heading-actions flex items-center gap-2 sm:gap-3 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs max-w-full">
                <CalendarDays className="shrink-0" />
                <span className="desktop-only truncate">
                  {period === "This year" ? "01 Jan – 31 Dec, 2026" : "01 Oct – 31 Oct, 2026"}
                </span>
                <span className="hidden max-sm:inline">{period}</span>
                <ChevronDown className="size-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPeriod("This year")}>This year</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPeriod("This month")}>
                This month
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            title="Customize overview"
            aria-label="Customize overview"
            onClick={() => setCustomize(true)}
          >
            <SlidersHorizontal />
          </Button>
        </div>
      </div>
      <div className="section-tabs">
        <Link to="/" className="selected">
          Executive overview
        </Link>
        {hasPermission("analytics.view") && (
          <Link to="/analytics">
            {isAccounts ? "Receivables & payables" : "Revenue intelligence"}
          </Link>
        )}
        {hasPermission("logistics.view") && <Link to="/logistics">Operations</Link>}
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.name}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground truncate">{k.name}</p>
              <k.icon className="kpi-icon shrink-0" />
            </div>
            <p className="kpi-value">{k.value}</p>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="trend">
                <ArrowUpRight size={12} className="shrink-0" /> {k.growth}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{k.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Second layer of top layout — only when orders arrived today */}
      {todaysOrders.length > 0 && (
        <section className="panel mt-0 mb-[22px] overview-today-orders">
          <div className="panel-head">
            <div className="min-w-0">
              <h2 className="panel-title truncate">Today’s order KPIs</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {todaysOrders.length} order{todaysOrders.length === 1 ? "" : "s"} received today
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold shrink-0"
            >
              <Link to="/orders">
                All orders
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="kpi-grid !mt-0 !mb-0 border-0 rounded-none">
            {todaysOrderKpis.map((k) => (
              <div className="kpi" key={k.name}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground truncate">{k.name}</p>
                  <k.icon className="kpi-icon shrink-0" />
                </div>
                <p className="kpi-value">{k.value}</p>
                <span className="trend">{k.note}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border divide-y divide-border">
            {todaysOrders.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-[23px] py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{o.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    #{o.id}
                    {o.items_summary ? ` · ${o.items_summary}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!hideRevenue && (
                    <span className="text-xs font-bold tabular-nums">{money(o.total_amount)}</span>
                  )}
                  <span
                    className={`status ${
                      o.status === "Delivered"
                        ? "success"
                        : o.status === "Pending approval" || o.status === "Procuring"
                          ? "warning"
                          : "brand"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div
        className={
          (!hideTotalRevenue || (isAccounts && !hideRevenue)) && showAttention
            ? "middle-grid"
            : "grid grid-cols-1"
        }
      >
        {!hideTotalRevenue && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Revenue performance</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Live financial transactions from database
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    {period}
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setPeriod("This year")}>
                    This year
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPeriod("This month")}>
                    This month
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-[23px] pb-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <p className="revenue-number">{money(totalRevenue)}</p>
                <span className="status success shrink-0">
                  <ArrowUpRight className="size-3" />
                  Live
                </span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  This period
                </span>
              </div>
            </div>
            <RevenueChart period={period} totalRevenue={totalRevenue} />
            <div className="insight-strip">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-primary">
                  <ArrowUpRight size={12} />
                </span>
                <span>
                  <b className="font-semibold">Financial Ledger.</b>{" "}
                  <span className="text-muted-foreground">Synchronized with Supabase invoices.</span>
                </span>
              </div>
              {hasPermission("invoices.view") && (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs font-semibold"
                >
                  <Link to="/accounts">
                    Explore report
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}
        {isAccounts && !hideRevenue && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Money desk</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Receivables to collect · payables on open purchases
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 sm:px-[23px] pb-5">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receivables
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{money(outstandingAmount)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {dbInvoices.filter((i) => i.status !== "Paid").length} open invoices
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payables
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{money(payablesAmount)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {
                    dbPOs.filter((p) => !["Rejected", "Received"].includes(p.status)).length
                  }{" "}
                  open purchase orders
                </p>
              </div>
            </div>
            <div className="insight-strip">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-primary">
                  <CreditCard size={12} />
                </span>
                <span>
                  <b className="font-semibold">Collections & commitments.</b>{" "}
                  <span className="text-muted-foreground">
                    Invoice dues and supplier POs — no total revenue roll-up.
                  </span>
                </span>
              </div>
              {hasPermission("invoices.view") && (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs font-semibold"
                >
                  <Link to="/accounts">
                    Open invoices
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}
        {showAttention && (
          <section className="attention-panel">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                Action center
              </span>
              <span className="flex size-6 items-center justify-center rounded-full border border-ink-foreground/30 text-xs font-semibold">
                {approvalsWaitingCount + lowStockCount + pendingDispatchCount}
              </span>
            </div>
            <h2 className="mt-4 text-[22px] font-semibold tracking-tight">
              A little attention.
              <br />A lot of impact.
            </h2>
            <p className="mt-2 text-xs opacity-75">Keep your business moving forward.</p>
            <div className="attention-list mt-4">
              {(
                [
                  {
                    icon: FileCheck2,
                    value: approvalsWaitingCount,
                    title: "Approvals waiting",
                    subtitle: "Orders & purchase requests",
                    to: "/orders" as const,
                    perm: "orders.view",
                  },
                  {
                    icon: Package,
                    value: lowStockCount,
                    title: "Low-stock products",
                    subtitle: "Restock before you run low",
                    to: "/inventory" as const,
                    perm: "inventory.view",
                  },
                  {
                    icon: Truck,
                    value: pendingDispatchCount,
                    title: "Dispatches ready",
                    subtitle: "Ready for the road",
                    to: "/logistics" as const,
                    perm: "logistics.view",
                  },
                ] as const
              )
                .filter((a) => hasPermission(a.perm))
                .map((a) => (
                  <Link
                    to={a.to}
                    key={a.title}
                    className="attention-item text-inherit no-underline"
                  >
                    <span className="attention-icon">
                      <a.icon size={18} />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">
                        <span className="mr-1.5">{a.value}</span>
                        {a.title}
                      </p>
                      <p className="mt-1 text-[11px] opacity-70">{a.subtitle}</p>
                    </div>
                    <ArrowUpRight size={14} className="opacity-70" />
                  </Link>
                ))}
            </div>
            <Button
              asChild
              variant="inverse"
              size="sm"
              className="mt-auto w-full text-xs font-semibold"
            >
              <Link to="/tasks">
                Open my workspace
                <ArrowRight className="ml-auto size-3" />
              </Link>
            </Button>
          </section>
        )}
      </div>
      {showCompanies && !hideTotalRevenue && company === "all" && (
        <section className="panel mt-[22px]">
          <div className="panel-head !pb-3 !pt-4">
            <h2 className="panel-title !text-sm">One group. Four engines of growth.</h2>
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">
              REVENUE CONTRIBUTION
            </span>
          </div>
          <div className="company-bar">
            {companies.map((c) => {
                const compRevenue = dbInvoices
                  .filter((i) => i.company_id === c.id)
                  .reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
                return (
                  <div key={c.id} className="company-cell">
                    <div className="mb-3 flex items-center gap-2.5">
                      <CompanyLogo id={c.id} />
                      <span className="text-xs font-bold">{c.short}</span>
                      <ArrowUpRight size={13} className="ml-auto text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="company-cell-value text-[20px] font-semibold tabular-nums truncate">
                        ₹{(compRevenue / 100000).toFixed(1)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">L</span>
                      </span>
                      <span className="text-[11px] font-semibold text-success">Live</span>
                    </div>
                    <progress
                      aria-label={`${c.short} revenue contribution`}
                      className="stock-track mt-3 w-full"
                      max={Math.max(totalRevenue, 100000)}
                      value={compRevenue}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      )}
      {showTasks && (
        <div className="mt-[22px]">
          <section className="panel">
            <TaskWorkspace compact />
          </section>
        </div>
      )}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" />
          Connected to Supabase · Live production database · Real-time sync
        </span>
        <span className="font-medium">Avighna One Multi-Company Unified Operating System</span>
      </footer>
      <Sheet open={customize} onOpenChange={setCustomize}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your overview</SheetTitle>
            <SheetDescription>Choose the sections in your view</SheetDescription>
          </SheetHeader>
          <div className="mt-7 space-y-5">
            {[
              { name: "Action center", value: showAttention, set: setShowAttention },
              { name: "Company snapshots", value: showCompanies, set: setShowCompanies },
              { name: "My work", value: showTasks, set: setShowTasks },
            ].map((v) => (
              <label key={v.name} className="flex items-center justify-between text-sm">
                {v.name}
                <input
                  type="checkbox"
                  checked={v.value}
                  onChange={(e) => v.set(e.target.checked)}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </div>
          <Button onClick={() => setCustomize(false)} className="mt-8 w-full">
            <Check />
            Apply view
          </Button>
        </SheetContent>
      </Sheet>
    </main>
  );
}
