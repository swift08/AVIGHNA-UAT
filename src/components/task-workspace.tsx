import { useEffect, useMemo, useState } from "react";
import { Check, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { companies } from "@/lib/workspace-data";
import { useWorkspace } from "./workspace-provider";
import {
  fetchTasks,
  createTask,
  toggleTask,
  taskAssignerName,
  type DBTask,
} from "@/lib/erp-service";
import { ROLE_NAMES, type RoleType } from "@/lib/auth-service";
import { listStaffLogins, type StaffLoginSummary } from "@/lib/login-admin";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { scopeForDriver } from "@/lib/driver-scope";
import { missingRequired } from "@/lib/form-required";
import { toast } from "sonner";

export function TaskWorkspace({ compact = false }: { compact?: boolean }) {
  const { company, currentUser, hasPermission } = useWorkspace();
  const isSuperAdmin =
    currentUser?.role === "super_admin" || currentUser?.permissions?.includes("*");
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffLoginSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [taskCompany, setTaskCompany] = useState("asian");
  const [person, setPerson] = useState("");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");

  useEffect(() => {
    let active = true;
    listStaffLogins()
      .then((res) => {
        if (!active || !res.ok) return;
        const activeStaff = res.users.filter((u) => u.status === "Active");
        setStaffUsers(activeStaff);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const roleLabelForName = (personName: string) => {
    const match = staffUsers.find(
      (u) =>
        u.name.toLowerCase() === personName.toLowerCase() ||
        u.name.toLowerCase().includes(personName.toLowerCase().split(" (")[0] || ""),
    );
    if (!match) return "";
    return ROLE_NAMES[match.role as RoleType] || match.role;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTasks(company).then((res) => {
      if (!active) return;
      // Drivers stay scoped to their own plate; Super Admin and others keep full company set.
      const scoped = scopeForDriver(currentUser, { tasks: res }).tasks ?? [];
      setTasks(scoped);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [company, currentUser]);

  const visible = useMemo(() => {
    const companyFiltered = tasks.filter((t) => company === "all" || t.company_id === company);
    // Super Admin sees every role’s tasks (open + completed), with assigner/assignee.
    if (isSuperAdmin) {
      return [...companyFiltered].sort((a, b) => Number(a.done) - Number(b.done));
    }
    // Sales only sees tasks assigned to them. Others see assigned-to or assigned-by.
    const me = (currentUser?.name || "").trim().toLowerCase();
    if (!me) return companyFiltered;
    const isSales = currentUser?.role === "sales";
    return companyFiltered.filter((t) => {
      const assignee = (t.assigned_to_name || "").toLowerCase();
      const assignedToMe =
        assignee.includes(me) || me.includes(assignee.split(" (")[0] || "");
      if (isSales) return assignedToMe;
      const from = taskAssignerName(t).toLowerCase();
      return (
        assignedToMe || from.includes(me) || me.includes(from.split(" (")[0] || "")
      );
    });
  }, [tasks, company, isSuperAdmin, currentUser?.name, currentUser?.role]);

  const openCount = visible.filter((t) => !t.done).length;
  const doneCount = visible.filter((t) => t.done).length;

  const assigneeOptions = useMemo(() => {
    const list = staffUsers.filter((u) => u.role !== "super_admin" || isSuperAdmin);
    if (list.length === 0 && currentUser) {
      return [
        {
          value: currentUser.name,
          label: `${currentUser.name} · ${ROLE_NAMES[currentUser.role] || currentUser.role}`,
          keywords: `${currentUser.name} ${currentUser.email} ${currentUser.role}`,
        },
      ];
    }
    return list.map((u) => {
      const roleLabel = ROLE_NAMES[u.role as RoleType] || u.role;
      return {
        value: u.name,
        label: `${u.name} · ${roleLabel}`,
        keywords: `${u.name} ${u.email} ${roleLabel}`,
      };
    });
  }, [staffUsers, isSuperAdmin, currentUser]);

  useEffect(() => {
    if (!person && assigneeOptions.length > 0 && assigneeOptions[0]) {
      setPerson(assigneeOptions[0].value);
    }
  }, [person, assigneeOptions]);

  const handleToggle = async (t: DBTask) => {
    const updatedDone = !t.done;
    setTasks((prev) =>
      prev.map((p) =>
        p.id === t.id
          ? { ...p, done: updatedDone, status: updatedDone ? "Completed" : "Pending" }
          : p,
      ),
    );
    if (t.id) {
      await toggleTask(t.id, updatedDone);
    }
  };

  const canAddTask =
    currentUser?.role !== "sales" && hasPermission("tasks.manage");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddTask) {
      toast.error("Sales can only complete assigned tasks.");
      return;
    }
    const requiredError = missingRequired([
      { label: "Task name", value: name },
      { label: "Assigned to", value: person },
      { label: "Due date", value: due },
    ]);
    if (requiredError) {
      toast.error("Required fields missing", { description: requiredError });
      return;
    }
    const creatorName = currentUser?.name || "Harshith (Owner)";
    try {
      const created = await createTask({
        title: name.trim(),
        companyId: taskCompany,
        assignedToName: person,
        dueDate: due,
        priority,
        creatorName,
        creatorId: currentUser?.id,
      });
      if (created) {
        setTasks((prev) => [created as DBTask, ...prev]);
      }
    } catch (err) {
      console.warn("Could not persist to database, adding locally:", err);
      setTasks((prev) => [
        {
          id: String(Date.now()),
          title: name,
          company_id: taskCompany,
          assigned_to_name: person,
          created_by_name: creatorName,
          description: `[Assigned by: ${creatorName}]`,
          due_date: due,
          priority,
          status: "Pending",
          done: false,
        },
        ...prev,
      ]);
    }
    setName("");
    setOpen(false);
  };

  return (
    <>
      <div className={compact ? "" : "panel"}>
        {compact ? (
          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="panel-title">{isSuperAdmin ? "Team work" : "My work"}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isSuperAdmin
                    ? openCount === 0 && doneCount === 0
                      ? "No tasks across roles"
                      : `${openCount} open · ${doneCount} completed`
                    : openCount === 0
                      ? "Nothing open"
                      : `${openCount} open`}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <Link to="/tasks">
                  All tasks
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </div>
            {canAddTask && (
              <Button
                size="sm"
                className="mt-3 h-8 w-full gap-1.5 text-xs font-semibold"
                title="Add task"
                aria-label="Add task"
                onClick={() => {
                  if (company !== "all") setTaskCompany(company);
                  setOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Add task
              </Button>
            )}
          </div>
        ) : (
          <div className="panel-head">
            <div className="flex items-center gap-2">
              <h2 className="panel-title">{isSuperAdmin ? "Team work" : "My work"}</h2>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {openCount}
              </span>
            </div>
            {canAddTask && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                title="Add task"
                aria-label="Add task"
                onClick={() => {
                  if (company !== "all") setTaskCompany(company);
                  setOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Add task
              </Button>
            )}
          </div>
        )}
        {loading && (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading tasks...</p>
        )}
        {!loading &&
          visible.map((t) => {
            const from = taskAssignerName(t);
            const assigneeRole = roleLabelForName(t.assigned_to_name || "");
            const fromRole = from ? roleLabelForName(from) : "";
            return (
              <div key={t.id} className={`task-row ${t.done ? "completed" : ""}`}>
                <Button
                  variant="ghost"
                  className={`task-check ${t.done ? "done" : ""}`}
                  aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
                  onClick={() => handleToggle(t)}
                >
                  {t.done && <Check className="size-3" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="task-name text-xs font-semibold leading-5">{t.title}</p>
                    {isSuperAdmin && (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          t.done
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {t.done ? "Completed" : t.status || "Open"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className={t.priority === "High" ? "text-warning" : ""}>{t.due_date}</span>
                    <span>·</span>
                    <span>{companies.find((c) => c.id === t.company_id)?.short}</span>
                    {(isSuperAdmin || from) && (
                      <>
                        <span>·</span>
                        <span>
                          To {t.assigned_to_name || "—"}
                          {assigneeRole ? ` (${assigneeRole})` : ""}
                        </span>
                        {from ? (
                          <>
                            <span>·</span>
                            <span>
                              From {from}
                              {fromRole ? ` (${fromRole})` : ""}
                            </span>
                          </>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className="avatar size-7 text-[10px] font-bold"
                  title={t.assigned_to_name || "Assignee"}
                >
                  {(t.assigned_to_name || "?")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
            );
          })}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-medium text-foreground">
              {isSuperAdmin ? "No team tasks yet" : "No tasks assigned"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isSuperAdmin
                ? "Tasks assigned across sales, accounts, logistics, and supervisors will appear here."
                : "Everything is clear in this workspace."}
            </p>
          </div>
        )}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create a task</SheetTitle>
            <SheetDescription>
              {isSuperAdmin
                ? "Assign work to any role — completion status stays visible here"
                : "Assign work across your organization"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate}>
            <label className="drawer-field">
              Task name <span className="text-destructive">*</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What needs to get done?"
              />
            </label>
            <label className="drawer-field">
              Company
              <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="drawer-field">
              <span>
                Assigned to <span className="text-destructive">*</span>
              </span>
              <SearchableSelect
                required
                value={person}
                onChange={setPerson}
                options={assigneeOptions}
                placeholder="Select user"
                searchPlaceholder="Search user by name or role..."
                emptyText="No matching active users"
              />
            </div>
            <label className="drawer-field">
              Due date <span className="text-destructive">*</span>
              <input type="date" required value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="drawer-field">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "High" | "Medium" | "Low")}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <Button type="submit" className="mt-6 w-full">
              <Plus />
              Create task
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
