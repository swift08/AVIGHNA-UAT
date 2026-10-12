import { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { companies, money } from "@/lib/workspace-data";
import type {
  DBOrder,
  DBCustomer,
  DBInvoice,
  DBLead,
  DBFieldVisit,
  DBProduct,
} from "@/lib/erp-service";

const COMPANY_COLORS: Record<string, string> = {
  asian: "#0ea5e9", // Sky Blue
  avighna: "#10b981", // Emerald
  ganesh: "#f59e0b", // Amber
  atharva: "#8b5cf6", // Purple
};

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#10b981",
  "Out for delivery": "#06b6d4",
  "Ready to dispatch": "#3b82f6",
  Approved: "#8b5cf6",
  "Pending Approval": "#f59e0b",
  Draft: "#94a3b8",
};

export function CompanyRevenuePieChart({
  orders,
  invoices,
}: {
  orders: DBOrder[];
  invoices: DBInvoice[];
}) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");

  const data = companies.map((c) => {
    const compOrders = orders.filter((o) => o.company_id === c.id);
    const rev = compOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    return {
      id: c.id,
      name: c.short,
      fullName: c.name,
      value: metric === "revenue" ? rev : compOrders.length,
      ordersCount: compOrders.length,
      revenueAmount: rev,
      color: COMPANY_COLORS[c.id] || "#64748b",
    };
  });

  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground">Revenue Share by Entity</h3>
          <p className="text-[11px] text-muted-foreground">
            Distribution across 4 corporate subsidiaries
          </p>
        </div>
        <div className="inline-flex p-0.5 rounded-lg bg-muted text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMetric("revenue")}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
              metric === "revenue"
                ? "bg-card text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Gross (₹)
          </button>
          <button
            type="button"
            onClick={() => setMetric("orders")}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
              metric === "orders"
                ? "bg-card text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Orders (#)
          </button>
        </div>
      </div>

      <div className="h-[220px] w-full my-2 relative flex items-center justify-center">
        {totalValue > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  const pct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
                  return (
                    <div className="chart-tooltip">
                      <p className="font-bold text-foreground text-xs">{item.fullName}</p>
                      <p className="text-primary font-mono font-bold text-xs mt-1">
                        {metric === "revenue"
                          ? money(item.revenueAmount)
                          : `${item.ordersCount} orders`}
                        <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            <p>No transactions booked yet.</p>
            <p className="text-[10px] mt-0.5">Place an order to view revenue distribution.</p>
          </div>
        )}

        {totalValue > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Total
            </span>
            <span className="text-xs font-black text-foreground">
              {metric === "revenue" ? money(totalValue) : `${totalValue} orders`}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
        {data.map((item) => {
          const pct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30"
            >
              <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-foreground text-[11px] truncate">
                  {item.name}
                </span>
              </span>
              <span className="font-mono text-[11px] font-bold text-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderStatusPieChart({ orders }: { orders: DBOrder[] }) {
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const s = o.status || "Draft";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
    color: STATUS_COLORS[status] || "#94a3b8",
  }));

  const totalOrders = orders.length;

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
      <div className="pb-3 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">Order Lifecycle Pipeline</h3>
        <p className="text-[11px] text-muted-foreground">
          Fulfillment & approval status distribution
        </p>
      </div>

      <div className="h-[220px] w-full my-2 relative flex items-center justify-center">
        {totalOrders > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  const pct = totalOrders > 0 ? Math.round((item.value / totalOrders) * 100) : 0;
                  return (
                    <div className="chart-tooltip">
                      <p className="font-bold text-foreground text-xs">{item.name}</p>
                      <p className="text-primary font-mono font-bold text-xs mt-1">
                        {item.value} {item.value === 1 ? "order" : "orders"}
                        <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            <p>No orders registered.</p>
            <p className="text-[10px] mt-0.5">Create orders to view status pipeline.</p>
          </div>
        )}

        {totalOrders > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Orders
            </span>
            <span className="text-sm font-black text-foreground">{totalOrders}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
        {data.map((item) => {
          const pct = totalOrders > 0 ? Math.round((item.value / totalOrders) * 100) : 0;
          return (
            <div
              key={item.name}
              className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30"
            >
              <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-foreground text-[11px] truncate">
                  {item.name}
                </span>
              </span>
              <span className="font-mono text-[11px] font-bold text-foreground">
                {item.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompanyComparisonBarChart({
  orders,
  invoices,
  customers,
}: {
  orders: DBOrder[];
  invoices: DBInvoice[];
  customers: DBCustomer[];
}) {
  const [viewMode, setViewMode] = useState<"finance" | "volume">("finance");

  const rawData = companies.map((c) => {
    const compOrders = orders.filter((o) => o.company_id === c.id);
    const compInvoices = invoices.filter((i) => i.company_id === c.id);
    const compCusts = customers.filter((cu) => cu.company_id === c.id);

    const grossSales = compOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const collected = compInvoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);
    const receivables = compInvoices.reduce((s, i) => s + (Number(i.remaining_amount) || 0), 0);

    return {
      id: c.id,
      name: c.short,
      fullName: c.name,
      grossSales,
      collected,
      receivables,
      ordersCount: compOrders.length,
      customersCount: compCusts.length,
    };
  });

  const maxFinance = Math.max(
    ...rawData.flatMap((d) => [d.grossSales, d.collected, d.receivables]),
    0,
  );

  // Dynamic adaptive scaling:
  // If >= 1,00,000 (1 Lakh): use Lakhs
  // If >= 1,000: use Thousands (k)
  // Otherwise: use raw Rupees
  const isLakhs = maxFinance >= 100000;
  const isThousands = maxFinance >= 1000 && !isLakhs;
  const divisor = isLakhs ? 100000 : isThousands ? 1000 : 1;
  const unitSuffix = isLakhs ? "L" : isThousands ? "k" : "";
  const unitLabel = isLakhs
    ? "Financial Metrics (₹ Lakhs)"
    : isThousands
      ? "Financial Metrics (₹ Thousands)"
      : "Financial Metrics (₹)";

  const data = rawData.map((d) => ({
    ...d,
    grossSalesDisplay: Number((d.grossSales / divisor).toFixed(divisor === 1 ? 0 : 2)),
    collectedDisplay: Number((d.collected / divisor).toFixed(divisor === 1 ? 0 : 2)),
    receivablesDisplay: Number((d.receivables / divisor).toFixed(divisor === 1 ? 0 : 2)),
  }));

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Multi-Company Financial & Volume Comparison
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Side-by-side performance benchmarking across corporate entities
          </p>
        </div>
        <div className="inline-flex p-0.5 rounded-lg bg-muted text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("finance")}
            className={`px-3 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
              viewMode === "finance"
                ? "bg-card text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {unitLabel}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("volume")}
            className={`px-3 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
              viewMode === "volume"
                ? "bg-card text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Account & Order Volume
          </button>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "finance" ? (
            <BarChart
              key="finance-barchart"
              data={data}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              barGap={8}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
                opacity={0.7}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickFormatter={(v) => `₹${v}${unitSuffix}`}
                width={56}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const companyItem = data.find((d) => d.name === label);
                  return (
                    <div className="chart-tooltip">
                      <p className="font-bold text-foreground text-xs mb-1.5">
                        {companyItem?.fullName || label}
                      </p>
                      {payload.map((p) => {
                        let valString = `${p.value}`;
                        if (p.dataKey === "grossSalesDisplay")
                          valString = money(companyItem?.grossSales || 0);
                        else if (p.dataKey === "collectedDisplay")
                          valString = money(companyItem?.collected || 0);
                        else if (p.dataKey === "receivablesDisplay")
                          valString = money(companyItem?.receivables || 0);
                        return (
                          <div
                            key={p.dataKey}
                            className="flex items-center justify-between gap-4 text-xs mt-1"
                          >
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name}:
                            </span>
                            <span className="font-bold font-mono text-foreground">{valString}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "11px", fontWeight: 500 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="grossSalesDisplay"
                name="Booked Sales"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                minPointSize={8}
                isAnimationActive={false}
              />
              <Bar
                dataKey="collectedDisplay"
                name="Collected Revenue"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                minPointSize={8}
                isAnimationActive={false}
              />
              <Bar
                dataKey="receivablesDisplay"
                name="Receivables Due"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                minPointSize={8}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <BarChart
              key="volume-barchart"
              data={data}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              barGap={8}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
                opacity={0.7}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                allowDecimals={false}
                width={40}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const companyItem = data.find((d) => d.name === label);
                  return (
                    <div className="chart-tooltip">
                      <p className="font-bold text-foreground text-xs mb-1.5">
                        {companyItem?.fullName || label}
                      </p>
                      {payload.map((p) => (
                        <div
                          key={p.dataKey}
                          className="flex items-center justify-between gap-4 text-xs mt-1"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}:
                          </span>
                          <span className="font-bold font-mono text-foreground">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "11px", fontWeight: 500 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="ordersCount"
                name="Sales Orders"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                minPointSize={8}
                isAnimationActive={false}
              />
              <Bar
                dataKey="customersCount"
                name="Customer Accounts"
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                minPointSize={8}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ConversionFunnelBarChart({
  leads,
  visits,
  orders,
  invoices,
}: {
  leads: DBLead[];
  visits: DBFieldVisit[];
  orders: DBOrder[];
  invoices: DBInvoice[];
}) {
  const deliveredCount = orders.filter((o) =>
    ["Ready to dispatch", "Out for delivery", "Delivered"].includes(o.status),
  ).length;
  const paidCount = invoices.filter((i) => i.status === "Paid").length;

  const data = [
    { stage: "Leads Captured", count: leads.length, fill: "#3b82f6" },
    { stage: "Field Visits", count: visits.length, fill: "#6366f1" },
    { stage: "Orders Booked", count: orders.length, fill: "#8b5cf6" },
    { stage: "Dispatched", count: deliveredCount, fill: "#f59e0b" },
    { stage: "Invoices Settled", count: paidCount, fill: "#10b981" },
  ];

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="pb-3 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">Commercial Conversion Pipeline Funnel</h3>
        <p className="text-[11px] text-muted-foreground">
          Progression count from initial prospect to settled payment
        </p>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 25, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="3 4"
              opacity={0.7}
            />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              width={110}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload;
                if (!item) return null;
                return (
                  <div className="chart-tooltip">
                    <p className="font-bold text-foreground text-xs">{item.stage}</p>
                    <p className="text-primary font-mono font-bold text-xs mt-1">
                      {item.count} records
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={18}
              minPointSize={8}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ProductCategoryCharts({ products }: { products: DBProduct[] }) {
  const [metric, setMetric] = useState<"value" | "units">("value");

  const categoryMap: Record<string, { count: number; units: number; value: number }> = {};
  products.forEach((p) => {
    const cat = p.category || "General";
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, units: 0, value: 0 };
    categoryMap[cat].count += 1;
    categoryMap[cat].units += p.on_hand || 0;
    categoryMap[cat].value += (p.on_hand || 0) * (p.unit_price || 0);
  });

  const catColors = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];

  const data = Object.entries(categoryMap).map(([category, stats], idx) => ({
    category,
    count: stats.count,
    units: stats.units,
    value: stats.value,
    color: catColors[idx % catColors.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      {/* Bar Chart: Category Inventory Breakdown */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-bold text-foreground">Inventory Valuation by Category</h3>
            <p className="text-[11px] text-muted-foreground">
              Stock valuation and units per product classification
            </p>
          </div>
          <div className="inline-flex p-0.5 rounded-lg bg-muted text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMetric("value")}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                metric === "value"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Value (₹)
            </button>
            <button
              type="button"
              onClick={() => setMetric("units")}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                metric === "units"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Units (#)
            </button>
          </div>
        </div>

        <div className="h-[220px] w-full my-2">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 15, right: 15, left: 5, bottom: 5 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                  opacity={0.7}
                />
                <XAxis
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
                  dy={6}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={(v) =>
                    metric === "value" ? `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}` : `${v}`
                  }
                  width={52}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;
                    return (
                      <div className="chart-tooltip">
                        <p className="font-bold text-foreground text-xs">{item.category}</p>
                        <p className="text-primary font-mono font-bold text-xs mt-1">
                          {metric === "value" ? money(item.value) : `${item.units} units`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.count} SKU products
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={metric === "value" ? "value" : "units"}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  minPointSize={8}
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No product inventory recorded.
            </div>
          )}
        </div>
      </div>

      {/* Pie Chart: Category Catalog Share */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
        <div className="pb-3 border-b border-border/60">
          <h3 className="text-sm font-bold text-foreground">Catalog Category Share</h3>
          <p className="text-[11px] text-muted-foreground">SKU catalog distribution by category</p>
        </div>

        <div className="h-[220px] w-full my-2 relative flex items-center justify-center">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="count"
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`pie-${index}`}
                      fill={entry.color}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;
                    const pct = Math.round((item.count / (products.length || 1)) * 100);
                    return (
                      <div className="chart-tooltip">
                        <p className="font-bold text-foreground text-xs">{item.category}</p>
                        <p className="text-primary font-mono font-bold text-xs mt-1">
                          {item.count} items ({pct}%)
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {money(item.value)} total value
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-muted-foreground">No catalog data</div>
          )}

          {data.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Catalog
              </span>
              <span className="text-xs font-black text-foreground">{products.length} SKUs</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
          {data.slice(0, 4).map((item) => {
            const pct = Math.round((item.count / (products.length || 1)) * 100);
            return (
              <div
                key={item.category}
                className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30"
              >
                <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-foreground text-[11px] truncate">
                    {item.category}
                  </span>
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
