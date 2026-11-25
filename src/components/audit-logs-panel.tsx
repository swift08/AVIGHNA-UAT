import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Compass,
  FileText,
  KeyRound,
  Loader2,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAuditLogs, type DBAuditLog } from "@/lib/erp-service";
import { companies, type CompanyId } from "@/lib/workspace-data";

export type AuditCategory =
  | "all"
  | "auth"
  | "ui"
  | "navigation"
  | "sales"
  | "inventory"
  | "finance"
  | "operations";

export const AUDIT_CATEGORIES: {
  id: AuditCategory;
  label: string;
  icon: typeof Activity;
}[] = [
  { id: "all", label: "All", icon: Activity },
  { id: "auth", label: "Logins & Auth", icon: KeyRound },
  { id: "ui", label: "Button Clicks", icon: MousePointerClick },
  { id: "navigation", label: "Navigation", icon: Compass },
  { id: "sales", label: "Sales & Orders", icon: ShoppingBag },
  { id: "inventory", label: "Inventory & Stock", icon: Package },
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "operations", label: "Operations & Admin", icon: FileText },
];

export function classifyAuditLog(log: DBAuditLog): Exclude<AuditCategory, "all"> {
  const mod = (log.module || "").toLowerCase();
  const act = (log.action || "").toLowerCase();
  if (mod === "auth" || mod === "security" || act.includes("login") || act.includes("logout") || act.includes("password")) {
    return "auth";
  }
  if (mod === "ui" || act === "button_click") return "ui";
  if (mod === "navigation" || act === "page_view") return "navigation";
  if (["orders", "order", "leads", "lead", "customers", "customer", "quotes", "dispatch", "deliveries", "sales"].includes(mod)) {
    return "sales";
  }
  if (["inventory", "stock", "products", "product", "purchases", "purchase", "warehouses", "warehouse"].includes(mod)) {
    return "inventory";
  }
  if (["finance", "invoices", "invoice", "payments", "payment", "expenses", "expense", "coa", "credit_notes", "accounts"].includes(mod)) {
    return "finance";
  }
  return "operations";
}

const CATEGORY_BADGE: Record<Exclude<AuditCategory, "all">, string> = {
  auth: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  ui: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  navigation: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  sales: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  inventory: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  finance: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  operations: "bg-muted text-muted-foreground",
};

function formatWhen(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

export function AuditLogsPanel({ companyId }: { companyId: CompanyId }) {
  const [logs, setLogs] = useState<DBAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AuditCategory>("all");
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(companyId);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<AuditCategory, number> = {
      all: logs.length,
      auth: 0,
      ui: 0,
      navigation: 0,
      sales: 0,
      inventory: 0,
      finance: 0,
      operations: 0,
    };
    for (const log of logs) {
      map[classifyAuditLog(log)] += 1;
    }
    return map;
  }, [logs]);

  const users = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (log.user_name) set.add(log.user_name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (category !== "all" && classifyAuditLog(log) !== category) return false;
      if (userFilter !== "all" && log.user_name !== userFilter) return false;
      if (!q) return true;
      return (
        (log.user_name || "").toLowerCase().includes(q) ||
        (log.module || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.description || "").toLowerCase().includes(q) ||
        (log.record_id || "").toLowerCase().includes(q)
      );
    });
  }, [logs, category, userFilter, query]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-foreground">Audit Logs</h4>
          <p className="text-xs text-muted-foreground">
            Live activity across logins, button clicks, navigation, and business actions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-8 gap-1.5 text-xs cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Category segregation pills */}
      <div className="flex flex-wrap gap-1.5">
        {AUDIT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-3" />
              <span>{cat.label}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {counts[cat.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & user filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search user, action, description, or record…"
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          aria-label="Filter by user"
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All users ({users.length})</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {/* Logs list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading audit logs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
          No audit logs found for this filter.
        </div>
      ) : (
        <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
          {filtered.map((log) => {
            const cat = classifyAuditLog(log);
            const catMeta = AUDIT_CATEGORIES.find((c) => c.id === cat);
            const companyShort = log.company_id
              ? companies.find((c) => c.id === log.company_id)?.short || log.company_id
              : null;
            return (
              <div
                key={log.id || `${log.user_name}-${log.action}-${log.record_id}-${log.created_at}`}
                className="rounded-lg border border-border bg-background/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE[cat]}`}>
                        {catMeta?.label || cat}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {log.user_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        · {log.module} / {(log.action || "").replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {log.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      {log.record_id ? <span>Ref: {log.record_id}</span> : null}
                      {companyShort ? <span>· {companyShort}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {formatWhen(log.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
