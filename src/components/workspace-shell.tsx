import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronsUpDown,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShoppingBag,
  Sun,
  Truck,
  Users,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  Info,
  CheckCheck,
  Trash2,
  BellOff,
  Plus,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useWorkspace } from "./workspace-provider";
import { companies, orders, filterCompany, type ThemeMode, type CompanyId } from "@/lib/workspace-data";
import { SYSTEM_USERS, PERMISSION_LABELS, type RoleType } from "@/lib/auth-service";
import { assignedTo } from "@/lib/driver-scope";
import {
  type DBNotification,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  subscribeToNotifications,
  createNotification,
} from "@/lib/notification-service";
import { LoginPage } from "./login-page";
import { isDemoAuthEnabled } from "@/lib/security";

export const navigation = [
  {
    section: "Workspace",
    items: [
      { name: "Overview", url: "/", icon: LayoutDashboard },
      { name: "My work", url: "/tasks", icon: ListTodo, perm: "tasks.view" },
    ],
  },
  {
    section: "Sales & relationships",
    items: [
      { name: "Leads", url: "/leads", icon: Users, perm: "leads.view" },
      { name: "Customers", url: "/customers", icon: Building2, perm: "customers.view" },
      { name: "Field visits", url: "/field-visits", icon: MapPin, perm: "field_visits.view" },
    ],
  },
  {
    section: "Operations",
    items: [
      { name: "Orders", url: "/orders", icon: ShoppingBag, perm: "orders.view" },
      { name: "Inventory", url: "/inventory", icon: Package, perm: "inventory.view" },
      { name: "Purchases", url: "/purchases", icon: FileText, perm: "purchases.view" },
      { name: "Logistics", url: "/logistics", icon: Truck, perm: "logistics.view" },
    ],
  },
  {
    section: "Finance & control",
    items: [
      { name: "Invoices", url: "/accounts", icon: CreditCard, perm: "invoices.view" },
      { name: "Credit control", url: "/credit", icon: Scale, perm: "credit.view" },
      { name: "Analytics", url: "/analytics", icon: ArrowUpRight, perm: "analytics.view" },
      { name: "Administration", url: "/administration", icon: Settings2, perm: "admin.manage" },
      { name: "Team logins", url: "/administration", icon: Users, supervisorOnly: true },
    ],
  },
];

function navVisible(
  item: (typeof navigation)[number]["items"][number],
  role: string | undefined,
  hasPermission: (permission: string) => boolean,
) {
  if ("supervisorOnly" in item && item.supervisorOnly) return role === "supervisor";
  if ("superAdminOnly" in item && item.superAdminOnly) return role === "super_admin";
  return !item.perm || hasPermission(item.perm);
}

export function CompanyLogo({
  id,
  className = "company-logo",
}: {
  id: string;
  className?: string;
}) {
  const c = companies.find((c) => c.id === id);
  return c ? (
    <img
      className={className}
      src={c.logo}
      alt={`${c.short} logo`}
      onError={(e) => {
        const target = e.currentTarget;
        const src = target.getAttribute("src") || "";
        if (src.includes("/logos/logos/")) {
          target.src = src.replace("/logos/logos/", "/logos/");
        }
      }}
    />
  ) : (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <Building2 size={20} />
    </span>
  );
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "Recently";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const {
    company,
    setCompany,
    mode,
    setMode,
    currentUser,
    login,
    loginAsRole,
    logout,
    changePassword,
    hasPermission,
  } = useWorkspace();

  const selected = companies.find((c) => c.id === company);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<"notifications" | "profile" | null>(null);
  const [profileTab, setProfileTab] = useState<"profile" | "password" | "permissions">("profile");

  // Notifications state
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread" | "approval" | "alerts">("all");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    let active = true;
    const keep = (items: DBNotification[]) => {
      if (currentUser?.role !== "logistics" || !currentUser.name) return items;
      return items.filter((item) => assignedTo(`${item.title} ${item.message}`, currentUser.name));
    };
    const load = async () => {
      setNotificationsLoading(true);
      const data = await fetchNotifications(company);
      if (active) {
        setNotifications(keep(data));
        setNotificationsLoading(false);
      }
    };
    load();

    const unsubscribe = subscribeToNotifications(() => {
      fetchNotifications(company).then((data) => {
        if (active) setNotifications(keep(data));
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [company, currentUser]);

  // Change password local state
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const mobileOnly = currentUser?.role === "logistics" || currentUser?.role === "sales";
    document.documentElement.classList.toggle("driver-mobile", mobileOnly);
    return () => document.documentElement.classList.remove("driver-mobile");
  }, [currentUser?.role]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (!newPass || newPass.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassError("New passwords do not match.");
      return;
    }

    setPassLoading(true);
    try {
      const res = await changePassword(currentPass, newPass);
      if (res.success) {
        setPassSuccess(res.message);
        setCurrentPass("");
        setNewPass("");
        setConfirmPass("");
      } else {
        setPassError(res.message);
      }
    } catch {
      setPassError("An unexpected error occurred while changing password.");
    } finally {
      setPassLoading(false);
    }
  };

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div
      className={`workspace ${collapsed ? "collapsed" : ""} ${
        currentUser.role === "sales" || currentUser.role === "logistics" ? "field-role" : ""
      } ${
        currentUser.role === "logistics" || currentUser.role === "sales" ? "driver-mobile" : ""
      }`}
    >
      {/* --------------------------------------------------------------- */}
      {/* SIDEBAR                                                         */}
      {/* --------------------------------------------------------------- */}
      <aside className="sidebar">
        <div className="sidebar-brand flex h-[73px] shrink-0 items-center gap-3 overflow-hidden px-5">
          <img
            src="/logos/logos/avighna.png"
            alt="Avighna"
            className="size-8 shrink-0 rounded-lg object-contain"
          />
          <div className="sidebar-copy">
            <div className="text-[17px] font-extrabold">
              avighna<span className="font-normal text-muted-foreground"> one</span>
            </div>
            <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[1.7px] text-muted-foreground">
              Business, connected.
            </div>
          </div>
        </div>
        <div className="px-3 pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="company-switch" aria-label="Switch company">
                <CompanyLogo id={company} />
                <span className="sidebar-copy min-w-0 flex-1 overflow-hidden">
                  <span className="block truncate text-xs font-bold">
                    {selected?.short ?? "All Companies"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                    {selected ? "Company workspace" : "Organization workspace"}
                  </span>
                </span>
                <ChevronsUpDown className="sidebar-copy size-3 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 p-2">
              <DropdownMenuLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                SWITCH WORKSPACE
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setCompany("all")} className="py-3">
                <CompanyLogo id="all" />
                <span className="flex-1 font-medium">All Companies</span>
                {company === "all" && <Check />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {companies.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => setCompany(c.id)} className="py-3">
                  <CompanyLogo id={c.id} />
                  <span className="flex-1 text-xs font-medium">{c.name}</span>
                  {company === c.id && <Check />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) =>
              navVisible(item, currentUser?.role, hasPermission),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.section}>
                <div className="nav-label">{group.section}</div>
                {visibleItems.map((item) => (
                  <Button
                    asChild
                    key={item.url}
                    variant="workspace"
                    className={path === item.url ? "active" : ""}
                    title={item.name}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span className="sidebar-copy">{item.name}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="sidebar-user h-auto min-h-0 flex-1 justify-start gap-2.5 px-2 py-1.5"
              onClick={() => {
                setProfileTab("profile");
                setNotice("profile");
              }}
              title={
                currentUser
                  ? `${currentUser.name} · ${currentUser.roleName}`
                  : "View profile and security settings"
              }
            >
              <span className="avatar shrink-0 size-8 text-[11px]">
                {currentUser?.initials || "??"}
              </span>
              <span className="sidebar-copy min-w-0 flex-1 text-left overflow-hidden">
                <span className="block truncate text-xs font-semibold leading-snug">
                  {currentUser?.name || "Sign In"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {currentUser?.roleName || "No active session"}
                </span>
              </span>
            </Button>

            {currentUser && (
              <Button
                variant="ghost"
                size="icon"
                title="Log out"
                aria-label="Log out"
                onClick={logout}
                className="size-8 shrink-0 text-muted-foreground hover:text-danger hover:bg-danger/10"
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------------- */}
      {/* MAIN TOPBAR & CONTENT                                           */}
      {/* --------------------------------------------------------------- */}
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              title="Open workspace menu"
              aria-label="Open workspace menu"
              className="mobile-nav-trigger text-muted-foreground mr-1"
            >
              <Menu className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="mobile-hide text-muted-foreground"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSearchOpen(true)}
              className="topbar-search gap-3 px-0 text-xs font-medium text-muted-foreground"
            >
              <Search className="size-4" />
              <span>Search your workspace...</span>
              <kbd className="ml-16 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold">
                ⌘ K
              </kbd>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Appearance"
                  title="Appearance"
                  className="text-muted-foreground"
                >
                  {mode === "dark" ? <Moon /> : mode === "system" ? <Monitor /> : <Sun />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                {(
                  [
                    { id: "light", name: "Light", icon: Sun },
                    { id: "dark", name: "Dark", icon: Moon },
                    { id: "system", name: "System", icon: Monitor },
                  ] as const
                ).map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => setMode(m.id as ThemeMode)}>
                    <m.icon />
                    {m.name}
                    {mode === m.id && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
              aria-label="Notifications"
              onClick={() => setNotice("notifications")}
              className="relative text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            <span className="mx-1 h-5 border-l border-border" />

            {/* Logout button in topbar */}
            {currentUser && (
              <Button
                variant="ghost"
                size="icon"
                title="Log out"
                aria-label="Log out"
                onClick={logout}
                className="text-muted-foreground hover:text-danger hover:bg-danger/10"
              >
                <LogOut className="size-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setProfileTab("profile");
                setNotice("profile");
              }}
              aria-label="Your profile"
              title={currentUser ? `${currentUser.name} (${currentUser.roleName})` : "Profile"}
            >
              <span className="avatar">{currentUser?.initials || "??"}</span>
            </Button>
          </div>
        </header>
        {children}

        {/* MOBILE STRICT BOTTOM NAVIGATION */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
          <Link to="/" className={`mobile-bottom-nav-item ${path === "/" ? "active" : ""}`}>
            <LayoutDashboard className="size-4" />
            <span>Overview</span>
          </Link>
          {hasPermission("leads.view") && (
            <Link
              to="/leads"
              className={`mobile-bottom-nav-item ${path === "/leads" ? "active" : ""}`}
            >
              <Users className="size-4" />
              <span>Leads</span>
            </Link>
          )}
          {hasPermission("field_visits.view") && (
            <Link
              to="/field-visits"
              className={`mobile-bottom-nav-item ${path === "/field-visits" ? "active" : ""}`}
            >
              <MapPin className="size-4" />
              <span>Visits</span>
            </Link>
          )}
          {hasPermission("orders.view") && (
            <Link
              to="/orders"
              className={`mobile-bottom-nav-item ${path === "/orders" ? "active" : ""}`}
            >
              <ShoppingBag className="size-4" />
              <span>Orders</span>
            </Link>
          )}
          {hasPermission("logistics.view") && (
            <Link
              to="/logistics"
              className={`mobile-bottom-nav-item ${path === "/logistics" ? "active" : ""}`}
            >
              <Truck className="size-4" />
              <span>Logistics</span>
            </Link>
          )}
          {currentUser.role === "sales" && hasPermission("customers.view") && (
            <Link
              to="/customers"
              className={`mobile-bottom-nav-item ${path === "/customers" ? "active" : ""}`}
            >
              <Building2 className="size-4" />
              <span>Customers</span>
            </Link>
          )}
        </nav>

        {/* MOBILE FULL DRAWER NAVIGATION SHEET */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="mobile-nav-sheet p-0 flex flex-col h-full bg-card border-0"
          >
            <SheetHeader className="p-4 border-b border-border text-left">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logos/logos/avighna.png"
                  alt="Avighna"
                  className="size-9 shrink-0 rounded-lg object-contain"
                />
                <div>
                  <SheetTitle className="text-sm font-bold">avighna one</SheetTitle>
                  <SheetDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Unified Enterprise OS
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Mobile Company Switcher */}
            <div className="p-3 border-b border-border bg-muted/20">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Operating Company
              </label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value as CompanyId)}
                className="w-full text-xs font-semibold h-9 px-2.5 rounded-lg border border-border bg-card"
              >
                <option value="all">All Companies (Unified)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Navigation Links */}
            <nav
              className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
              aria-label="Mobile drawer navigation"
            >
              {navigation.map((group) => {
                const visibleItems = group.items.filter((item) =>
                  navVisible(item, currentUser?.role, hasPermission),
                );
                if (visibleItems.length === 0) return null;
                return (
                  <div key={group.section}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                      {group.section}
                    </div>
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => (
                        <Button
                          asChild
                          key={item.url}
                          variant="workspace"
                          className={`w-full justify-start text-xs ${path === item.url ? "active font-bold" : ""}`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Mobile User Profile & Logout */}
            <div className="p-3 border-t border-border bg-card/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="avatar size-8 text-xs">{currentUser?.initials || "??"}</span>
                <div className="min-w-0 text-left">
                  <p className="text-xs font-bold truncate">{currentUser?.name || "User"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {currentUser?.roleName}
                  </p>
                </div>
              </div>
              {currentUser && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  title="Log out"
                >
                  <LogOut className="size-4" />
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* SEARCH WORKSPACE SHEET                                          */}
      {/* --------------------------------------------------------------- */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Search workspace</SheetTitle>
            <SheetDescription>Customers, orders, and workspaces</SheetDescription>
          </SheetHeader>
          <div className="relative mt-6">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              autoFocus
              aria-label="Search workspace"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find anything..."
              className="w-full pl-10"
            />
          </div>
          <p className="eyebrow mt-7 mb-3">Pages</p>
          {navigation
            .flatMap((g) => g.items)
            .filter((i) => navVisible(i, currentUser?.role, hasPermission))
            .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <Button asChild variant="ghost" key={item.url} className="mb-1 w-full justify-start">
                <Link to={item.url} onClick={() => setSearchOpen(false)}>
                  <item.icon />
                  {item.name}
                  <ArrowUpRight className="ml-auto" />
                </Link>
              </Button>
            ))}
          <p className="eyebrow mt-7 mb-3">Orders & customers</p>
          {filterCompany(orders, company).length > 0 ? (
            filterCompany(orders, company)
              .filter((o) => `${o.id} ${o.customer}`.toLowerCase().includes(query.toLowerCase()))
              .map((o) => (
                <Button
                  asChild
                  key={o.id}
                  variant="ghost"
                  className="mb-2 h-auto w-full justify-start py-3"
                >
                  <Link to="/orders" onClick={() => setSearchOpen(false)}>
                    <span className="avatar">{o.initials}</span>
                    <span className="text-left">
                      <span className="block text-xs">{o.customer}</span>
                      <span className="text-[10px] text-muted-foreground">{o.id}</span>
                    </span>
                  </Link>
                </Button>
              ))
          ) : (
            <p className="text-xs text-muted-foreground py-2">No orders or customers found.</p>
          )}
        </SheetContent>
      </Sheet>

      {/* --------------------------------------------------------------- */}
      {/* NOTIFICATIONS & PROFILE / SECURITY SHEET                         */}
      {/* --------------------------------------------------------------- */}
      <Sheet
        open={notice !== null}
        onOpenChange={(v) => {
          if (!v) {
            setNotice(null);
            setPassError("");
            setPassSuccess("");
          }
        }}
      >
        <SheetContent className="overflow-y-auto max-h-screen w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {notice === "notifications"
                ? "Notifications"
                : notice === "profile"
                  ? "User Profile & Security"
                  : "Workspace system"}
            </SheetTitle>
            <SheetDescription>
              {notice === "notifications"
                ? "Real-time updates, approvals & enterprise alerts"
                : notice === "profile"
                  ? currentUser?.role === "super_admin"
                    ? "Manage session, role permissions, and password"
                    : "Manage your session and password"
                  : "Avighna One ERP"}
            </SheetDescription>
          </SheetHeader>

          {notice === "notifications" ? (
            <div className="mt-4 space-y-3.5">
              {/* Header Action Toolbar */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {unreadCount} unread
                  </span>
                  {notifications.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      · {notifications.length} total
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllNotificationsAsRead(company)}
                      className="h-7 px-2 text-[11px] font-medium text-primary hover:text-primary cursor-pointer"
                    >
                      <CheckCheck className="size-3.5 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearAllNotifications(company)}
                      className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex p-0.5 rounded-lg bg-muted text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setNotifFilter("all")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    notifFilter === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter("unread")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    notifFilter === "unread"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter("approval")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    notifFilter === "approval"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Orders (
                  {
                    notifications.filter(
                      (n) =>
                        n.type === "approval" || n.type === "dispatch" || n.type === "delivery",
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter("alerts")}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    notifFilter === "alerts"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Alerts ({notifications.filter((n) => n.type === "shortage").length})
                </button>
              </div>

              {/* Notification Cards Feed */}
              {notifications.filter((n) => {
                if (notifFilter === "unread") return !n.is_read;
                if (notifFilter === "approval")
                  return n.type === "approval" || n.type === "dispatch" || n.type === "delivery";
                if (notifFilter === "alerts") return n.type === "shortage";
                return true;
              }).length > 0 ? (
                <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                  {notifications
                    .filter((n) => {
                      if (notifFilter === "unread") return !n.is_read;
                      if (notifFilter === "approval")
                        return (
                          n.type === "approval" || n.type === "dispatch" || n.type === "delivery"
                        );
                      if (notifFilter === "alerts") return n.type === "shortage";
                      return true;
                    })
                    .map((item) => {
                      const isUnread = !item.is_read;
                      const comp = companies.find((c) => c.id === item.company_id);
                      const targetLink =
                        item.reference_type === "order"
                          ? "/orders"
                          : item.reference_type === "delivery"
                            ? "/logistics"
                            : item.reference_type === "invoice"
                              ? "/accounts"
                              : item.reference_type === "product"
                                ? "/inventory"
                                : item.reference_type === "visit"
                                  ? "/field-visits"
                                  : item.reference_type === "customer"
                                    ? "/customers"
                                    : item.reference_type === "lead"
                                      ? "/leads"
                                      : null;

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border transition-all text-xs relative flex gap-3 ${
                            isUnread
                              ? "bg-primary/5 border-primary/30 shadow-2xs"
                              : "bg-card border-border/70 hover:border-border text-muted-foreground"
                          }`}
                        >
                          {/* Type Icon */}
                          <div className="shrink-0 mt-0.5">
                            {item.type === "shortage" ? (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="size-4" />
                              </span>
                            ) : item.type === "approval" ? (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                <ShieldAlert className="size-4" />
                              </span>
                            ) : item.type === "dispatch" ? (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                                <Truck className="size-4" />
                              </span>
                            ) : item.type === "delivery" ? (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-4" />
                              </span>
                            ) : item.type === "task" ? (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                <CalendarClock className="size-4" />
                              </span>
                            ) : (
                              <span className="flex size-7 items-center justify-center rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-400">
                                <Info className="size-4" />
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4
                                className={`text-xs font-bold leading-tight ${isUnread ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatRelativeTime(item.created_at)}
                                </span>
                                {isUnread && (
                                  <span className="size-2 rounded-full bg-primary" title="Unread" />
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] leading-relaxed text-foreground/80">
                              {item.message}
                            </p>

                            <div className="flex items-center justify-between pt-1.5 gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                {comp && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {comp.short}
                                  </span>
                                )}
                                {targetLink && (
                                  <Link
                                    to={targetLink}
                                    onClick={() => {
                                      if (isUnread) markNotificationAsRead(item.id);
                                      setNotice(null);
                                    }}
                                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                  >
                                    View details
                                    <ArrowUpRight className="size-3" />
                                  </Link>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {isUnread ? (
                                  <button
                                    type="button"
                                    onClick={() => markNotificationAsRead(item.id)}
                                    title="Mark as read"
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => deleteNotification(item.id)}
                                  title="Dismiss notification"
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="py-12 px-4 rounded-xl border border-dashed border-border text-center space-y-3">
                  <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <BellOff className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">All caught up</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notifFilter === "unread"
                        ? "You have no unread notifications."
                        : "No notifications found in this view."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      createNotification({
                        title: "Test System Alert",
                        message: `Real-time notification test dispatched for ${selected?.name || "Avighna One"} at ${new Date().toLocaleTimeString()}.`,
                        type: "info",
                        company_id: company === "all" ? "asian" : company,
                        reference_type: "order",
                        reference_id: "test",
                      });
                    }}
                    className="h-8 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    Send test notification
                  </Button>
                </div>
              )}
            </div>
          ) : notice === "profile" ? (
            <div className="mt-6 space-y-6">
              {/* Profile Tabs */}
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setProfileTab("profile")}
                  className={`pb-2 text-xs font-semibold px-3 border-b-2 transition-colors ${
                    profileTab === "profile"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Profile & Role
                </button>
                <button
                  type="button"
                  onClick={() => setProfileTab("password")}
                  className={`pb-2 text-xs font-semibold px-3 border-b-2 transition-colors ${
                    profileTab === "password"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Change Password
                </button>
                {currentUser?.role === "super_admin" && (
                  <button
                    type="button"
                    onClick={() => setProfileTab("permissions")}
                    className={`pb-2 text-xs font-semibold px-3 border-b-2 transition-colors ${
                      profileTab === "permissions"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Permissions
                  </button>
                )}
              </div>

              {/* TAB 1: PROFILE & ROLE SWITCHER */}
              {profileTab === "profile" && (
                <div className="space-y-6">
                  {currentUser ? (
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                      <span className="avatar size-14 text-lg font-bold">
                        {currentUser.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold truncate">{currentUser.name}</h2>
                        <p className="text-xs text-muted-foreground truncate">
                          {currentUser.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="status brand !text-[10px]">{currentUser.roleName}</span>
                          <span className="status success !text-[10px]">Session Active</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-border bg-card text-center">
                      <p className="text-xs text-muted-foreground">No active user logged in.</p>
                    </div>
                  )}

                  {isDemoAuthEnabled() && currentUser?.role === "super_admin" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Switch Role to Audit Permissions:
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {SYSTEM_USERS.map((u) => {
                        const isActive = currentUser?.id === u.id || currentUser?.role === u.role;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              loginAsRole(u.role);
                              void navigate({ to: "/" });
                            }}
                            className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                              isActive
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border bg-card hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="avatar size-8 text-xs">{u.initials}</span>
                              <div>
                                <div className="text-xs font-bold">{u.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {u.roleName}
                                </div>
                              </div>
                            </div>
                            {isActive ? (
                              <CheckCircle2 className="size-4 text-primary" />
                            ) : (
                              <span className="text-[11px] text-muted-foreground hover:text-foreground">
                                Switch →
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )}

                  {/* Clearly Accessible Logout Option */}
                  {currentUser && (
                    <div className="border-t border-border pt-4">
                      <Button
                        variant="outline"
                        className="w-full text-danger border-danger/30 hover:bg-danger/10 hover:text-danger h-10 font-semibold text-xs"
                        onClick={() => {
                          logout();
                          setNotice(null);
                        }}
                      >
                        <LogOut className="mr-2 size-4" />
                        Log out of Avighna One
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
                        Closes your active session and locks workspace.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CHANGE PASSWORD */}
              {profileTab === "password" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold">Change Password</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Update security credentials for {currentUser?.email || "your account"}.
                    </p>
                  </div>

                  {passSuccess && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/10 text-xs text-success">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>{passSuccess}</span>
                    </div>
                  )}

                  {passError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-danger/30 bg-danger/10 text-xs text-danger">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{passError}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Current password"
                        value={currentPass}
                        onChange={(e) => setCurrentPass(e.target.value)}
                        className="w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        New Password (min 6 characters)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="New password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Confirm new password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        className="w-full text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={passLoading}
                      className="w-full text-xs font-semibold h-9"
                    >
                      <KeyRound className="mr-1.5 size-3.5" />
                      {passLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </form>

                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Password Policy:</p>
                    <p>• Minimum 6 characters.</p>
                    <p>
                      • Changes are cryptographically verified and recorded in tamper-evident audit
                      logs.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: PERMISSIONS MATRIX */}
              {profileTab === "permissions" && currentUser?.role === "super_admin" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Permissions Matrix</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permissions assigned to <strong>{currentUser?.roleName}</strong>.
                    </p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {Object.entries(PERMISSION_LABELS).map(([permKey, permMeta]) => {
                      const granted = hasPermission(permKey);
                      return (
                        <div
                          key={permKey}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs"
                        >
                          <div>
                            <span className="font-semibold">{permMeta.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {permMeta.module} · {permKey}
                            </span>
                          </div>
                          <span
                            className={`status !text-[10px] ${granted ? "success" : "opacity-40"}`}
                          >
                            {granted ? "Granted" : "Restricted"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-7 space-y-5 text-sm">
              <p>Avighna One Multi-Company Unified Operating System.</p>
              <p className="text-muted-foreground">
                All business records are persisted to Supabase PostgreSQL database.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
