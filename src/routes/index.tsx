import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  FileCheck2,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Wallet,
  Plus,
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
import { OrderTable } from "@/components/order-workspace";
import { TaskWorkspace } from "@/components/task-workspace";
import { companies, money } from "@/lib/workspace-data";
import { scopeForDriver } from "@/lib/driver-scope";
import {
  fetchOrders,
  fetchInvoices,
  fetchProducts,
  fetchDeliveries,
  type DBOrder,
  type DBInvoice,
  type DBProduct,
} from "@/lib/erp-service";

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
  const [period, setPeriod] = useState("This year");
  const [customize, setCustomize] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [showCompanies, setShowCompanies] = useState(true);
  const [showAttention, setShowAttention] = useState(true);

  const [dbOrders, setDbOrders] = useState<DBOrder[]>([]);
  const [dbInvoices, setDbInvoices] = useState<DBInvoice[]>([]);
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);

  const reloadOverview = useCallback(() => {
    Promise.all([
      fetchOrders(company),
      fetchInvoices(company),
      fetchProducts(company),
      fetchDeliveries(company),
    ]).then(([orders, invoices, products, deliveries]) => {
      const scoped = scopeForDriver(currentUser, { orders, invoices, products, deliveries });
      setDbOrders(scoped.orders ?? []);
      setDbInvoices(scoped.invoices ?? []);
      setDbProducts(scoped.products ?? []);
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
  const lowStockCount = dbProducts.filter((p) => p.on_hand - p.reserved < p.reorder_level).length;

  const kpis = [
    {
      name: "Total revenue",
      value: money(totalRevenue),
      growth: totalRevenue > 0 ? "+100%" : "₹0",
      note: "Collected revenue",
      icon: Wallet,
    },
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
    {
      name: "Outstanding",
      value: money(outstandingAmount),
      growth: `${dbInvoices.filter((i) => i.status !== "Paid").length} invoices`,
      note: "Awaiting collection",
      icon: ArrowDownLeft,
    },
  ];
  return (
    <main className="content">
      <div className="heading-row flex items-end justify-between gap-5">
        <div>
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
        <div className="heading-actions flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs">
                <CalendarDays />
                <span className="desktop-only">
                  {period === "This year" ? "01 Jan – 31 Dec, 2026" : "01 Oct – 31 Oct, 2026"}
                </span>
                <span className="hidden max-sm:inline">{period}</span>
                <ChevronDown className="size-3" />
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
        <Link to="/analytics">Revenue intelligence</Link>
        <Link to="/logistics">Operations</Link>
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.name}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">{k.name}</p>
              <k.icon className="kpi-icon" />
            </div>
            <p className="kpi-value">{k.value}</p>
            <div className="flex items-center gap-1.5">
              <span className="trend">
                <ArrowUpRight size={12} /> {k.growth}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{k.note}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={showAttention ? "middle-grid" : "grid grid-cols-1"}>
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-[23px] pb-2">
            <div className="flex items-center gap-3">
              <p className="revenue-number">{money(totalRevenue)}</p>
              <span className="status success">
                <ArrowUpRight className="size-3" />
                Live
              </span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
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
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-semibold">
              <Link to="/accounts">
                Explore report
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </section>
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
              {[
                {
                  icon: FileCheck2,
                  value: approvalsWaitingCount,
                  title: "Approvals waiting",
                  subtitle: "Orders & purchase requests",
                  to: "/orders",
                },
                {
                  icon: Package,
                  value: lowStockCount,
                  title: "Low-stock products",
                  subtitle: "Restock before you run low",
                  to: "/inventory",
                },
                {
                  icon: Truck,
                  value: pendingDispatchCount,
                  title: "Dispatches ready",
                  subtitle: "Ready for the road",
                  to: "/logistics",
                },
              ].map((a) => (
                <Link to={a.to} key={a.title} className="attention-item text-inherit no-underline">
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
      {showCompanies && (
        <section className="panel mt-[22px]">
          <div className="panel-head !pb-3 !pt-4">
            <h2 className="panel-title !text-sm">
              {selected ? "Company snapshot" : "One group. Four engines of growth."}
            </h2>
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">
              REVENUE CONTRIBUTION
            </span>
          </div>
          <div className="company-bar">
            {companies
              .filter((c) => company === "all" || c.id === company)
              .map((c) => {
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[20px] font-semibold tabular-nums">
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
      <div className={showTasks ? "bottom-grid" : "mt-[22px]"}>
        <section className="panel">
          <div className="panel-head">
            <div className="flex items-center gap-2">
              <h2 className="panel-title">Recent orders</h2>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {dbOrders.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hasPermission("orders.create") && (
                <Button asChild size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                  <Link to="/orders" search={{ openCreate: "true" }}>
                    <Plus className="size-3.5" />
                    Create order
                  </Link>
                </Button>
              )}
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
          <OrderTable rows={dbOrders.slice(0, 5)} compact onRefresh={reloadOverview} />
        </section>
        {showTasks && (
          <section className="panel">
            <TaskWorkspace compact />
          </section>
        )}
      </div>
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
