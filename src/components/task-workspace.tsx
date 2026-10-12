import { useEffect, useState } from "react";
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
import { fetchTasks, createTask, toggleTask, type DBTask } from "@/lib/erp-service";
import { scopeForDriver } from "@/lib/driver-scope";

export function TaskWorkspace({ compact = false }: { compact?: boolean }) {
  const { company, currentUser, hasPermission } = useWorkspace();
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [taskCompany, setTaskCompany] = useState("asian");
  const [person, setPerson] = useState("Ravi Kumar");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTasks(company).then((res) => {
      if (active) {
        setTasks(scopeForDriver(currentUser, { tasks: res }).tasks ?? []);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [company, currentUser]);

  const visible = tasks.filter((t) => company === "all" || t.company_id === company);
  const openCount = visible.filter((t) => !t.done).length;

  const handleToggle = async (t: DBTask) => {
    const updatedDone = !t.done;
    setTasks((prev) => prev.map((p) => (p.id === t.id ? { ...p, done: updatedDone } : p)));
    if (t.id) {
      await toggleTask(t.id, updatedDone);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createTask({
        title: name,
        companyId: taskCompany,
        assignedToName: person,
        dueDate: due,
        priority,
        creatorName: currentUser?.name || "Ravi Kumar",
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
                <h2 className="panel-title">My work</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {openCount === 0 ? "Nothing open" : `${openCount} open`}
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
            {hasPermission("tasks.manage") && (
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
              <h2 className="panel-title">Team work</h2>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {openCount}
              </span>
            </div>
            {hasPermission("tasks.manage") && (
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
          visible.map((t) => (
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
                <p className="task-name text-xs font-semibold leading-5">{t.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={t.priority === "High" ? "text-warning" : ""}>{t.due_date}</span>
                  <span>·</span>
                  {companies.find((c) => c.id === t.company_id)?.short}
                </p>
              </div>
              <span className="avatar size-7 text-[10px] font-bold">
                {(t.assigned_to_name || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
          ))}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-medium text-foreground">No tasks assigned</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Everything is clear in this workspace.
            </p>
          </div>
        )}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create a task</SheetTitle>
            <SheetDescription>Assign work across your organization</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate}>
            <label className="drawer-field">
              Task name
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
            <label className="drawer-field">
              Assigned to
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="Ravi Kumar">Ravi Kumar · Sales</option>
                <option value="Suresh Rao">Suresh Rao · Accounts</option>
                <option value="Mahesh Patel">Mahesh Patel · Logistics</option>
                <option value="Arun Nair">Arun Nair · Supervisor</option>
              </select>
            </label>
            <label className="drawer-field">
              Due date
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
