import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useWorkspace } from "./workspace-provider";
export function RevenueChart({
  period = "This year",
  totalRevenue = 0,
}: {
  period?: string;
  totalRevenue?: number;
}) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const currentMonthIdx = 9; // October 2026
  const inLakhs = Number((totalRevenue / 100000).toFixed(2));

  const data =
    period === "This month"
      ? [
          { name: "Week 1", revenue: 0, previous: 0 },
          { name: "Week 2", revenue: inLakhs, previous: 0 },
          { name: "Week 3", revenue: 0, previous: 0 },
          { name: "Week 4", revenue: 0, previous: 0 },
        ]
      : months.map((m, i) => ({
          name: m,
          revenue: i === currentMonthIdx ? inLakhs : 0,
          previous: 0,
        }));
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
            tickFormatter={(v) => `₹${v}L`}
            width={48}
            domain={[0, "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <p className="font-bold">{label}</p>
                  {payload.map((p) => (
                    <p key={p.dataKey} className="mt-1 text-muted-foreground">
                      {p.dataKey === "revenue" ? "This period" : "Previous period"}: ₹{p.value}L
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="previous"
            fill="var(--chart-secondary)"
            opacity={0.4}
            barSize={19}
            radius={[3, 3, 0, 0]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="url(#revenue-fill)"
            stroke="var(--primary)"
            strokeWidth={2.5}
            activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
