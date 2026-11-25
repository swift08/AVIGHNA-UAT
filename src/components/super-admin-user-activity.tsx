import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLE_NAMES, type RoleType } from "@/lib/auth-service";
import { fetchAuditLogs, type DBAuditLog } from "@/lib/erp-service";
import { listStaffLogins, type StaffLogin } from "@/lib/login-admin";
import { companies } from "@/lib/workspace-data";
import {
  AUDIT_CATEGORIES,
  classifyAuditLog,
  type AuditCategory,
} from "./audit-logs-panel";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  phone?: string;
  status: "Active" | "Inactive";
  initials: string;
  source: "staff" | "demo";
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(role: string) {
  if (role in ROLE_NAMES) return ROLE_NAMES[role as RoleType];
  return role.replace(/_/g, " ");
}

function matchesUser(log: DBAuditLog, user: DirectoryUser) {
  const who = (log.user_name || "").toLowerCase();
  if (!who) return false;
  const name = user.name.toLowerCase();
  const email = user.email.toLowerCase();
  const first = name.split(" (")[0] || name;
  return (
    who === name ||
    who === email ||
    who.includes(first) ||
    first.includes(who) ||
    who.startsWith(first)
  );
}

function formatWhen(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function SuperAdminUserActivityButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [logs, setLogs] = useState<DBAuditLog[]>([]);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [category, setCategory] = useState<AuditCategory>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setSelected(null);
    setQuery("");

    Promise.all([listStaffLogins(), fetchAuditLogs("all")])
      .then(([staffRes, audit]) => {
        if (!active) return;
        // Production: only real Auth users — never merge demo SYSTEM_USERS.
        const fromStaff: DirectoryUser[] = (staffRes.users || []).map((u: StaffLogin) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          roleName: roleLabel(u.role),
          phone: u.phone,
          status: u.status,
          initials: initialsFor(u.name),
          source: "staff",
        }));

        setUsers(fromStaff.sort((a, b) => a.name.localeCompare(b.name)));
        setLogs(audit || []);
        if (!staffRes.ok) {
          setError(staffRes.error || "Could not load users.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load users.");
        setUsers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, query]);

  const selectedActivity = useMemo(() => {
    if (!selected) return [];
    const userLogs = logs.filter((log) => matchesUser(log, selected));
    if (category === "all") return userLogs;
    return userLogs.filter((log) => classifyAuditLog(log) === category);
  }, [logs, selected, category]);

  const activityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) {
      map.set(
        user.id,
        logs.filter((log) => matchesUser(log, user)).length,
      );
    }
    return map;
  }, [users, logs]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Users & activity (Super Admin)"
        aria-label="Users and activity"
        onClick={() => setOpen(true)}
        className="relative text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Users className="size-4" />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
          SA
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="app-sheet w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left pr-12">
            <SheetTitle className="flex items-center gap-2">
              {selected ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted cursor-pointer"
                    aria-label="Back to users"
                  >
                    <ArrowLeft className="size-3.5" />
                  </button>
                  {selected.name}
                </>
              ) : (
                <>
                  <Shield className="size-4 text-primary" />
                  All users
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {selected
                ? "Activity for this login."
                : "Open a user to review activity."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading users…
              </div>
            ) : selected ? (
              <>
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {selected.initials}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                      <p className="text-xs text-muted-foreground">{selected.roleName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                  {selected.phone ? (
                    <p className="text-xs text-muted-foreground">{selected.phone}</p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        selected.status === "Active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selected.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedActivity.length} activit
                      {selectedActivity.length === 1 ? "y" : "ies"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="eyebrow !text-[9px] flex items-center gap-1.5">
                    <Activity className="size-3" />
                    Activity
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {AUDIT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                          category === cat.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {selectedActivity.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No audit activity recorded for {selected.name} yet.
                    </p>
                  ) : (
                    selectedActivity.map((log) => (
                      <div
                        key={log.id || `${log.action}-${log.record_id}-${log.created_at}`}
                        className="rounded-xl border border-border bg-card px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground capitalize">
                              {log.module} · {log.action.replace(/_/g, " ")}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                              {log.description}
                            </p>
                            {log.record_id ? (
                              <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                                Record #{log.record_id}
                                {log.company_id
                                  ? ` · ${
                                      companies.find((c) => c.id === log.company_id)?.short ||
                                      log.company_id
                                    }`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatWhen(log.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users…"
                    className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {error ? (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                    {error}
                  </p>
                ) : null}

                <div className="space-y-2">
                  {filteredUsers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No users match this search.
                    </p>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelected(user)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/40 cursor-pointer"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {user.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {user.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {user.roleName} · {user.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {activityCounts.get(user.id) || 0} acts
                          </span>
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
