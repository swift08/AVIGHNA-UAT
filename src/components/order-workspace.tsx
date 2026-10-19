import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileCheck2,
  Lock,
  Package,
  Plus,
  Truck,
  XCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { companies, money, type Order } from "@/lib/workspace-data";
import { useWorkspace } from "./workspace-provider";
import { PRESET_UNITS } from "./module-workspace";
import {
  createOrder,
  approveOrder,
  rejectOrder,
  generateInvoice,
  fetchProducts,
  fetchCustomers,
  fetchVehicles,
  assignOrderVehicle,
  deleteOrder,
  type DBOrder,
  type DBProduct,
  type DBCustomer,
  type DBVehicle,
} from "@/lib/erp-service";

export function OrderDetail({
  order,
  onClose,
  onUpdate,
}: {
  order: Order | DBOrder | null;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const { hasPermission, currentUser } = useWorkspace();
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Transport and Vehicle Assignment state
  const [assignVehicleMode, setAssignVehicleMode] = useState(false);
  const [selectedTransportMode, setSelectedTransportMode] = useState<
    "Manufacturer Vehicle" | "Logistics / Assigned Vehicle"
  >("Logistics / Assigned Vehicle");
  const [assignPlateNumber, setAssignPlateNumber] = useState("");
  const [assignDriverName, setAssignDriverName] = useState("");
  const [assignDriverPhone, setAssignDriverPhone] = useState("");
  const [vehiclesList, setVehiclesList] = useState<DBVehicle[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      const mode =
        "transport_mode" in order && order.transport_mode === "Manufacturer Vehicle"
          ? "Manufacturer Vehicle"
          : "Logistics / Assigned Vehicle";
      setSelectedTransportMode(mode);
      setAssignPlateNumber(
        "assigned_vehicle" in order &&
          order.assigned_vehicle &&
          order.assigned_vehicle !== "Manufacturer Arranged"
          ? order.assigned_vehicle
          : "",
      );
      setAssignDriverName(
        "assigned_driver" in order && order.assigned_driver ? order.assigned_driver : "",
      );
      setAssignDriverPhone(
        "assigned_driver_phone" in order && order.assigned_driver_phone
          ? order.assigned_driver_phone
          : "",
      );
      fetchVehicles().then(setVehiclesList);
    }
  }, [order]);

  const isSuperAdmin = currentUser?.role === "super_admin" || hasPermission("*");
  const canAssignVehicle =
    hasPermission("orders.create") || hasPermission("orders.approve") || isSuperAdmin;
  const orderNotes =
    order && "notes" in order && typeof order.notes === "string" ? order.notes : "";
  const isPriceOverride = Boolean(
    orderNotes.includes("PRICE OVERRIDE") || orderNotes.includes("Super Admin Approval Required"),
  );
  const canApprove = isPriceOverride ? isSuperAdmin : hasPermission("orders.approve");
  const canInvoice = hasPermission("invoices.generate");

  if (!order) return null;

  const orderCompany = "company" in order ? order.company : order.company_id;
  const orderAmount = "amount" in order ? order.amount : order.total_amount;
  const orderCustomer = "customer" in order ? order.customer : order.customer_name;
  const orderItems = "items" in order ? order.items : order.items_summary;
  const orderOwner = "owner" in order ? order.owner : order.assigned_to || "Ravi Kumar";
  const orderInitials =
    "initials" in order
      ? order.initials
      : orderCustomer
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const approverName = isSuperAdmin
        ? `${currentUser?.name || "Harshith"} (Super Admin / Owner)`
        : `${currentUser?.name || "Arun Nair"} (Sales Supervisor)`;
      await approveOrder(order.id, approverName, orderCompany, isSuperAdmin);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      console.warn("Could not persist approval, updating session state:", err);
      if (canApprove) {
        order.status = "Approved";
      }
      if (onUpdate) onUpdate();
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return;
    setActionLoading(true);
    try {
      await rejectOrder(order.id, "Ravi Kumar", orderCompany, rejectReason);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      console.warn("Could not persist rejection, updating session state:", err);
      order.status = "Rejected";
      if (onUpdate) onUpdate();
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    try {
      await generateInvoice(
        {
          id: order.id,
          company_id: orderCompany,
          customer_name: orderCustomer,
          customer_id: "customer_id" in order ? order.customer_id : undefined,
          total_amount: orderAmount,
          status: order.status,
          subtotal: orderAmount,
          discount: 0,
          tax: 0,
          shortage_approved: true,
          created_at: new Date().toISOString(),
        },
        "Suresh Rao (Accounts)",
      );
      order.status = "Ready to dispatch";
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      console.warn("Could not persist invoice:", err);
      order.status = "Ready to dispatch";
      if (onUpdate) onUpdate();
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignLoading(true);
    setAssignError(null);
    try {
      await assignOrderVehicle(order.id, {
        transportMode: selectedTransportMode,
        vehicleNumber:
          selectedTransportMode === "Manufacturer Vehicle" ? undefined : assignPlateNumber,
        driverName: assignDriverName,
        driverPhone: assignDriverPhone,
        assignedByName: currentUser?.name || "Staff",
        assignedByRole: currentUser?.role || "sales",
      });
      order.transport_mode = selectedTransportMode;
      order.assigned_vehicle =
        selectedTransportMode === "Manufacturer Vehicle"
          ? "Manufacturer Arranged"
          : assignPlateNumber;
      order.assigned_driver = assignDriverName;
      order.assigned_driver_phone = assignDriverPhone;
      setAssignVehicleMode(false);
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <>
      <Sheet
        open={!!order}
        onOpenChange={(v) => {
          if (!v) {
            setRejectMode(false);
            setRejectReason("");
            onClose();
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{order.id}</SheetTitle>
            <SheetDescription>Order workspace & approval control</SheetDescription>
          </SheetHeader>
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="avatar size-12 text-sm">{orderInitials}</span>
              <div>
                <h2 className="font-bold">{orderCustomer}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {companies.find((c) => c.id === orderCompany)?.name}
                </p>
              </div>
            </div>

            <div className="flex justify-between border-y border-border py-5">
              <div>
                <p className="text-xs text-muted-foreground">Order value</p>
                <p className="mt-2 text-2xl font-bold">{money(orderAmount)}</p>
              </div>
              <span
                className={`status self-center ${
                  order.status === "Delivered"
                    ? "success"
                    : order.status === "Pending approval"
                      ? "warning"
                      : order.status === "Approved"
                        ? "brand"
                        : order.status === "Rejected"
                          ? "danger"
                          : "brand"
                }`}
              >
                {order.status}
              </span>
            </div>

            {/* APPROVAL & INVOICE ACTION CONTROLS */}
            {(order.status === "Pending approval" || order.status === "Procuring") && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-semibold">Workflow Action</p>
                {isPriceOverride && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-4" />
                      <span>Super Admin Price Authorization Required</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                      This order includes a discounted unit price below the product catalog Selling
                      Price.
                      {isSuperAdmin
                        ? " As Super Admin / Owner, you have exclusive authorization to approve this price discount."
                        : " Locked: Only Super Admin (Harshith) can approve orders with discounted prices."}
                    </p>
                  </div>
                )}
                {canApprove ? (
                  !rejectMode ? (
                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        className="flex-1 bg-primary text-primary-foreground font-semibold"
                        disabled={actionLoading}
                        onClick={handleApprove}
                      >
                        <Check className="mr-1 size-3.5" />
                        {isPriceOverride ? "Approve Price Override & Order" : "Approve Order"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-danger"
                        disabled={actionLoading}
                        onClick={() => setRejectMode(true)}
                      >
                        <XCircle className="mr-1 size-3.5" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        className="w-full text-xs"
                        placeholder="Enter reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          disabled={actionLoading || !rejectReason}
                          onClick={handleReject}
                        >
                          Confirm Rejection
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Lock className="size-3.5 text-warning" />
                      <span>
                        {isPriceOverride
                          ? "Super Admin Authorization Required"
                          : "Supervisor Approval Required"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px]">
                      {isPriceOverride
                        ? "This order was placed with a price below catalog Selling Price. Only Super Admin (Harshith) can approve it before it moves to Accounts."
                        : "This order requires approval from Arun Nair (Supervisor) or Harshith (Owner) before progressing."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {order.status === "Approved" && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold">Finance & Invoicing</p>
                <p className="text-[11px] text-muted-foreground">
                  Order is approved. Generate the commercial invoice to release this order to the
                  logistics dispatch queue.
                </p>
                {canInvoice ? (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    disabled={actionLoading}
                    onClick={handleGenerateInvoice}
                  >
                    <FileCheck2 className="mr-1.5 size-3.5" />
                    Generate Invoice & Release to Logistics
                  </Button>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Lock className="size-3.5 text-warning" />
                      <span>Accounts Invoicing Required</span>
                    </div>
                    <p className="mt-1 text-[11px]">
                      Commercial invoices must be generated by Suresh Rao (Accounts) or Harshith
                      (Owner).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TRANSPORT & VEHICLE ASSIGNMENT STATUS CARD */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Transport & Vehicle Details
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                  {"transport_mode" in order && order.transport_mode
                    ? order.transport_mode
                    : "Logistics / Assigned Vehicle"}
                </span>
              </div>

              {"transport_mode" in order && order.transport_mode === "Manufacturer Vehicle" ? (
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Check className="size-3.5 text-blue-600" />
                    Manufacturer-Arranged Transport
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    The manufacturer has their own vehicle and will directly collect this order. No
                    company logistics vehicle is required.
                  </p>
                  {"assigned_driver" in order && order.assigned_driver && (
                    <p className="text-[11px] text-foreground pt-1">
                      <strong>Driver / Representative:</strong> {order.assigned_driver}{" "}
                      {"assigned_driver_phone" in order && order.assigned_driver_phone
                        ? `(${order.assigned_driver_phone})`
                        : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-2">
                  {"assigned_vehicle" in order &&
                  order.assigned_vehicle &&
                  order.assigned_vehicle !== "Manufacturer Arranged" ? (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-foreground">
                          Assigned Vehicle: {order.assigned_vehicle}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Driver:{" "}
                          {("assigned_driver" in order && order.assigned_driver) || "Unassigned"}
                          {"assigned_driver_phone" in order && order.assigned_driver_phone
                            ? ` · ${order.assigned_driver_phone}`
                            : ""}
                        </p>
                      </div>
                      <span className="status success">Vehicle Assigned</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                          No Vehicle Assigned
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Sales can assign now, or Supervisor / Super Admin can assign later.
                        </p>
                      </div>
                      <span className="status warning">Pending Vehicle</span>
                    </div>
                  )}
                </div>
              )}

              {canAssignVehicle && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-semibold gap-1.5 cursor-pointer"
                  onClick={() => {
                    setAssignVehicleMode(true);
                    setSelectedTransportMode(
                      ("transport_mode" in order && order.transport_mode) ||
                        "Logistics / Assigned Vehicle",
                    );
                    setAssignPlateNumber(
                      "assigned_vehicle" in order &&
                        order.assigned_vehicle &&
                        order.assigned_vehicle !== "Manufacturer Arranged"
                        ? order.assigned_vehicle
                        : "",
                    );
                    setAssignDriverName(
                      ("assigned_driver" in order && order.assigned_driver) || "",
                    );
                    setAssignDriverPhone(
                      ("assigned_driver_phone" in order && order.assigned_driver_phone) || "",
                    );
                  }}
                >
                  <Truck className="size-3.5" />
                  {"assigned_vehicle" in order &&
                  order.assigned_vehicle &&
                  order.assigned_vehicle !== "Manufacturer Arranged"
                    ? "Reassign Vehicle / Transport"
                    : "Assign Vehicle / Transport"}
                </Button>
              )}
            </div>

            <p className="eyebrow mb-2">Order lifecycle</p>
            {[
              "Order created",
              "Approval",
              "Invoice generated",
              "Logistics dispatch",
              "Delivery completed",
            ].map((step, i) => {
              const isDone =
                (i === 0 && order.status !== "Draft") ||
                (i === 1 &&
                  ["Approved", "Ready to dispatch", "Out for delivery", "Delivered"].includes(
                    order.status,
                  )) ||
                (i === 2 &&
                  ["Ready to dispatch", "Out for delivery", "Delivered"].includes(order.status)) ||
                (i === 3 && ["Out for delivery", "Delivered"].includes(order.status)) ||
                (i === 4 && order.status === "Delivered");

              return (
                <div key={step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full ${
                        isDone ? "bg-accent text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check size={12} /> : <span className="text-xs">{i + 1}</span>}
                    </span>
                    {i < 4 && <span className="h-7 border-l border-border" />}
                  </div>
                  <div className="pt-1 text-xs">
                    <span className="font-semibold">{step}</span>
                  </div>
                </div>
              );
            })}

            <div className="border-t border-border pt-5">
              <p className="eyebrow">Line items</p>
              <div className="mt-4 flex items-center gap-3">
                <Package size={20} className="text-primary" />
                <span className="text-sm">{orderItems}</span>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Managed by <span className="font-semibold text-foreground">{orderOwner}</span>
              </p>
              {currentUser?.role === "super_admin" && (
                <div className="border-t border-border pt-4 mt-6">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs font-bold gap-1.5 cursor-pointer"
                    onClick={async () => {
                      if (
                        confirm(
                          `Super Admin: Permanently delete Order #${order.id}? This action cannot be undone.`,
                        )
                      ) {
                        await deleteOrder(order.id, currentUser?.name);
                        if (onUpdate) onUpdate();
                        onClose();
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete Order (Super Admin)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* VEHICLE / TRANSPORT ASSIGNMENT MODAL/SHEET */}
      <Sheet open={assignVehicleMode} onOpenChange={setAssignVehicleMode}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              Assign Transport / Vehicle
            </SheetTitle>
            <SheetDescription>
              Select fulfillment transport path for Order #{order.id}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 text-xs">
            {assignError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-xs">
                {assignError}
              </div>
            )}

            {/* Path 1 vs Path 2 Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Transport Path</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTransportMode("Manufacturer Vehicle");
                    setAssignPlateNumber("");
                  }}
                  className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedTransportMode === "Manufacturer Vehicle"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <span className="font-semibold text-foreground flex items-center justify-between">
                    1. Manufacturer Vehicle
                    {selectedTransportMode === "Manufacturer Vehicle" && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Manufacturer sends its own vehicle to collect the order. No company logistics
                    vehicle is required.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTransportMode("Logistics / Assigned Vehicle")}
                  className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedTransportMode === "Logistics / Assigned Vehicle"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <span className="font-semibold text-foreground flex items-center justify-between">
                    2. Logistics / Assigned Vehicle
                    {selectedTransportMode === "Logistics / Assigned Vehicle" && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Company vehicle + driver must be arranged for delivery from godown.
                  </span>
                </button>
              </div>
            </div>

            {selectedTransportMode === "Manufacturer Vehicle" ? (
              <div className="space-y-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
                <p className="text-[11px] text-muted-foreground">
                  Order will be tracked as <strong>Manufacturer-Arranged Transport</strong>.
                </p>
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Manufacturer Driver / Rep Name (Optional)
                  </label>
                  <input
                    className="w-full text-xs rounded-md border border-border bg-background px-3 py-1.5"
                    placeholder="e.g. Ramesh (Driver)"
                    value={assignDriverName}
                    onChange={(e) => setAssignDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Driver / Rep Phone (Optional)
                  </label>
                  <input
                    className="w-full text-xs rounded-md border border-border bg-background px-3 py-1.5"
                    placeholder="e.g. 9876543210"
                    value={assignDriverPhone}
                    onChange={(e) => setAssignDriverPhone(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-border bg-card p-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Select Company Vehicle *
                  </label>
                  <select
                    className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 text-foreground"
                    value={assignPlateNumber}
                    onChange={(e) => {
                      const plate = e.target.value;
                      setAssignPlateNumber(plate);
                      const matched = vehiclesList.find((v) => v.plate_number === plate);
                      if (matched?.assigned_driver_name) {
                        setAssignDriverName(matched.assigned_driver_name);
                      }
                      if (matched?.assigned_driver_phone) {
                        setAssignDriverPhone(matched.assigned_driver_phone);
                      }
                    }}
                  >
                    <option value="">-- Choose Company Vehicle --</option>
                    {vehiclesList.map((v) => {
                      const isDispatched = v.status === "Dispatched / On Delivery";
                      return (
                        <option key={v.id} value={v.plate_number} disabled={isDispatched}>
                          {v.plate_number} ({v.make_model}) — [{v.status}]
                          {isDispatched ? " ⚠️ UNAVAILABLE (IN TRANSIT)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Vehicles currently <strong>Dispatched / On Delivery</strong> cannot be assigned
                    to another order.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Driver Name
                  </label>
                  <input
                    className="w-full text-xs rounded-md border border-border bg-background px-3 py-1.5"
                    placeholder="e.g. Ramesh Kumar"
                    value={assignDriverName}
                    onChange={(e) => setAssignDriverName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Driver Contact Phone
                  </label>
                  <input
                    className="w-full text-xs rounded-md border border-border bg-background px-3 py-1.5"
                    placeholder="e.g. 9876543210"
                    value={assignDriverPhone}
                    onChange={(e) => setAssignDriverPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignVehicleMode(false)}
                disabled={assignLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="font-semibold"
                disabled={
                  assignLoading ||
                  (selectedTransportMode === "Logistics / Assigned Vehicle" && !assignPlateNumber)
                }
                onClick={handleSaveTransport}
              >
                {assignLoading ? "Saving..." : "Save Assignment"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function OrderTable({
  rows,
  compact = false,
  onRefresh,
  initialCustomerName,
  initialCompanyId,
  initialNotes,
  openCreateOnMount,
}: {
  rows: (Order | DBOrder)[];
  compact?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
  initialCustomerName?: string | undefined;
  initialCompanyId?: string | undefined;
  initialNotes?: string | undefined;
  openCreateOnMount?: boolean | undefined;
}) {
  const { hasPermission, currentUser } = useWorkspace();
  const [selected, setSelected] = useState<Order | DBOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Create Order state
  const [companyId, setCompanyId] = useState("asian");
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<DBProduct | null>(null);
  const [quantity, setQuantity] = useState("50");
  const [unit, setUnit] = useState("kg");
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("300");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [shortageNotice, setShortageNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productsList, setProductsList] = useState<DBProduct[]>([]);
  const [customersList, setCustomersList] = useState<DBCustomer[]>([]);

  // Transport and vehicle state for creation
  const [createTransportMode, setCreateTransportMode] = useState<
    "Manufacturer Vehicle" | "Logistics / Assigned Vehicle"
  >("Logistics / Assigned Vehicle");
  const [createVehiclePlate, setCreateVehiclePlate] = useState("");
  const [createDriverName, setCreateDriverName] = useState("");
  const [createDriverPhone, setCreateDriverPhone] = useState("");
  const [vehiclesList, setVehiclesList] = useState<DBVehicle[]>([]);

  useEffect(() => {
    // Detect customer prefill from query params, sessionStorage, or props
    if (typeof window === "undefined") return;

    let targetCustomer = initialCustomerName || "";
    let targetCompany = initialCompanyId || "";
    let targetNotes = initialNotes || "";
    let shouldOpen = Boolean(openCreateOnMount);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const qCust = searchParams.get("customer");
      const qComp = searchParams.get("company");
      const qNotes = searchParams.get("notes");
      const qOpen = searchParams.get("openCreate");

      if (qCust) {
        targetCustomer = qCust;
        shouldOpen = true;
      }
      if (qComp) targetCompany = qComp;
      if (qNotes) targetNotes = qNotes;
      if (qOpen === "true") shouldOpen = true;

      const stored = sessionStorage.getItem("prefill_customer_order");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.customer) targetCustomer = parsed.customer;
        if (parsed.company) targetCompany = parsed.company;
        if (parsed.notes) targetNotes = parsed.notes;
        shouldOpen = true;
        sessionStorage.removeItem("prefill_customer_order");
      }
    } catch {
      // Ignore URL parsing errors
    }

    if (targetCustomer) {
      setCustomerName(targetCustomer);
    }
    if (targetCompany) {
      setCompanyId(targetCompany);
    }
    if (targetNotes) {
      setNotes(targetNotes);
    }
    if (shouldOpen) {
      setCreateOpen(true);
    }
  }, [initialCustomerName, initialCompanyId, initialNotes, openCreateOnMount]);

  useEffect(() => {
    if (createOpen) {
      fetchProducts("all").then((prods) => {
        setProductsList(prods);
      });
      fetchCustomers(companyId as "asian" | "avighna" | "ganesh" | "atharva" | "all").then(
        (custs) => {
          setCustomersList(custs);
          if (customerName) {
            const matched = custs.find(
              (c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase(),
            );
            if (matched?.address && !deliveryAddress) {
              setDeliveryAddress(matched.address);
            }
          }
        },
      );
      fetchVehicles().then(setVehiclesList);
    }
  }, [createOpen, companyId, customerName, deliveryAddress]);

  const inventoryItems = productsList.filter(
    (product) =>
      !companyId ||
      companyId === "all" ||
      product.company_id === companyId ||
      product.company_id === "all",
  );

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);
    setShortageNotice(null);

    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unitPrice) || 100;
    const catalogPrice = selectedProduct ? Number(selectedProduct.unit_price) : undefined;
    const wholesalePrice = selectedProduct ? Number(selectedProduct.wholesale_price) : undefined;

    const finalUnit = isCustomUnit ? customUnit.trim() || "units" : unit;
    const createPayload: {
      companyId: string;
      customerName: string;
      productId?: string;
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      catalogPrice?: number;
      wholesalePrice?: number;
      deliveryAddress?: string;
      notes?: string;
      creatorName: string;
      transportMode?: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle";
      assignedVehicle?: string;
      assignedDriver?: string;
      assignedDriverPhone?: string;
    } = {
      companyId,
      customerName,
      productName,
      quantity: qty,
      unit: finalUnit,
      unitPrice: price,
      creatorName: currentUser?.name || "Ravi Kumar",
      transportMode: createTransportMode,
    };
    if (selectedProduct?.id) createPayload.productId = selectedProduct.id;
    if (catalogPrice !== undefined) createPayload.catalogPrice = catalogPrice;
    if (wholesalePrice !== undefined) createPayload.wholesalePrice = wholesalePrice;
    if (deliveryAddress) createPayload.deliveryAddress = deliveryAddress;
    if (notes) createPayload.notes = notes;

    if (createTransportMode === "Manufacturer Vehicle") {
      if (createDriverName) createPayload.assignedDriver = createDriverName;
      if (createDriverPhone) createPayload.assignedDriverPhone = createDriverPhone;
    } else {
      if (createVehiclePlate) createPayload.assignedVehicle = createVehiclePlate;
      if (createDriverName) createPayload.assignedDriver = createDriverName;
      if (createDriverPhone) createPayload.assignedDriverPhone = createDriverPhone;
    }

    const res = await createOrder(createPayload);

    setIsSubmitting(false);

    if (res.shortage) {
      setShortageNotice(
        `Shortage detected: Required ${qty} ${unit}, Available is lower. Order submitted as "Procuring" awaiting supervisor shortage approval.`,
      );
    }

    if (onRefresh) onRefresh();
    if (!res.shortage) {
      setCreateOpen(false);
      setCustomerName("");
      setDeliveryAddress("");
      setIsCustomUnit(false);
      setCustomUnit("");
      setCreateTransportMode("Logistics / Assigned Vehicle");
      setCreateVehiclePlate("");
      setCreateDriverName("");
      setCreateDriverPhone("");
    }
  };

  return (
    <>
      {!compact && (
        <div className="panel-head border-b border-border">
          <div>
            <h2 className="panel-title">Orders Directory</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rows.length} orders in this view
            </p>
          </div>
          {hasPermission("orders.create") && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Create Order
            </Button>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>ORDER / CUSTOMER</th>
              <th>COMPANY</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const comp = "company" in o ? o.company : o.company_id;
              const amt = "amount" in o ? o.amount : o.total_amount;
              const cust = "customer" in o ? o.customer : o.customer_name;
              const dateStr = "date" in o ? o.date : o.created_at?.split("T")[0];

              return (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-10">
                      <div>
                        <p className="font-semibold text-foreground">{cust}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          #{o.id} · {dateStr}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-muted-foreground">
                      {companies.find((c) => c.id === comp)?.short}
                    </span>
                  </td>
                  <td className="font-semibold">{money(amt)}</td>
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`status ${
                          o.status === "Delivered"
                            ? "success"
                            : o.status === "Pending approval"
                              ? "warning"
                              : o.status === "Procuring"
                                ? "warning"
                                : "brand"
                        }`}
                      >
                        {o.status}
                      </span>
                      {Boolean(
                        "notes" in o &&
                        typeof o.notes === "string" &&
                        (o.notes.includes("PRICE OVERRIDE") ||
                          o.notes.includes("Super Admin Approval Required")) &&
                        o.status === "Pending approval",
                      ) && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          Super Admin Approval
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3 justify-end">
                      {currentUser?.role === "super_admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Order (Super Admin)"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Super Admin: Permanently delete Order #${o.id}? This action cannot be undone.`,
                              )
                            ) {
                              await deleteOrder(o.id, currentUser?.name);
                              if (onRefresh) onRefresh();
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        onClick={() => setSelected(o)}
                        aria-label={`Open order ${o.id}`}
                        title="Open order"
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <OrderDetail
        order={selected}
        onClose={() => setSelected(null)}
        onUpdate={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* CREATE ORDER DRAWER */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Order</SheetTitle>
            <SheetDescription>
              Orders undergo real-time inventory validation before submission
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateOrder} className="mt-6 space-y-4">
            {shortageNotice && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p>{shortageNotice}</p>
              </div>
            )}
            <label className="drawer-field">
              Company
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setSelectedProduct(null);
                  setProductName("");
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Customer Name
              {customersList.length > 0 && (
                <select
                  className="mb-1 text-xs"
                  value={
                    customersList.find(
                      (x) => x.name.trim().toLowerCase() === customerName.trim().toLowerCase(),
                    )?.name || "NEW"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "NEW") {
                      setCustomerName(e.target.value);
                      const c = customersList.find((x) => x.name === e.target.value);
                      if (c?.address) setDeliveryAddress(c.address);
                    }
                  }}
                >
                  <option value="NEW">Select customer or type below...</option>
                  {customersList.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </label>
            <label className="drawer-field">
              Inventory item
              <select
                required
                value={selectedProduct?.id || ""}
                onChange={(e) => {
                  const product = inventoryItems.find((item) => item.id === e.target.value);
                  setSelectedProduct(product || null);
                  setProductName(product?.name || "");
                  if (product) {
                    setIsCustomUnit(false);
                    setUnit(product.unit);
                    setUnitPrice(String(product.unit_price));
                  }
                }}
              >
                <option value="">
                  {inventoryItems.length
                    ? "Select an item from inventory"
                    : "No inventory items for this company"}
                </option>
                {inventoryItems.map((product) => {
                  const available = Number(product.on_hand) - Number(product.reserved);
                  return (
                    <option key={product.id || product.code} value={product.id}>
                      {product.name} ({product.code}) — {available} {product.unit} available · ₹
                      {product.unit_price}
                    </option>
                  );
                })}
              </select>
              {selectedProduct && (
                <div className="mt-1 flex items-center justify-between rounded border border-border bg-muted/40 px-2.5 py-1.5 text-[11px]">
                  <div>
                    <span className="text-muted-foreground font-medium">Selling Price: </span>
                    <span className="font-bold text-foreground">
                      ₹{selectedProduct.unit_price} / {selectedProduct.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Wholesale Price: </span>
                    <span className="font-bold text-foreground">
                      ₹{selectedProduct.wholesale_price} / {selectedProduct.unit}
                    </span>
                  </div>
                </div>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Quantity
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="drawer-field">
                Unit
                <select
                  value={isCustomUnit ? "custom" : unit}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomUnit(true);
                      setCustomUnit("");
                    } else {
                      setIsCustomUnit(false);
                      setUnit(e.target.value);
                    }
                  }}
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="custom">+ Custom Unit...</option>
                </select>
                {isCustomUnit && (
                  <div className="mt-1 flex items-center gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={customUnit}
                      onChange={(e) => {
                        setCustomUnit(e.target.value);
                        setUnit(e.target.value);
                      }}
                      placeholder="e.g. rolls, bundles"
                      className="w-full text-xs font-semibold h-8 px-2.5 rounded border border-primary bg-background focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomUnit(false);
                        setUnit("kg");
                      }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border bg-muted/40 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </label>
            </div>
            <label className="drawer-field">
              Selling Price per Unit (₹)
              <input
                type="number"
                required
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
              {selectedProduct && parseFloat(unitPrice) < Number(selectedProduct.unit_price) && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-bold">Super Admin approval required:</span> Entered
                    selling price (₹{unitPrice}) is below catalog Selling Price (₹
                    {selectedProduct.unit_price}). This order requires Super Admin authorization
                    before moving to Accounts.
                  </div>
                </div>
              )}
            </label>
            <label className="drawer-field">
              Delivery Address
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Client delivery destination"
              />
            </label>
            {/* Fulfillment Transport & Vehicle Selection */}
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
              <div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Truck className="size-3.5 text-primary" />
                  Fulfillment & Transport Mode
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Choose whether manufacturer collects or company arranges delivery.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateTransportMode("Manufacturer Vehicle");
                    setCreateVehiclePlate("");
                  }}
                  className={`text-left p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                    createTransportMode === "Manufacturer Vehicle"
                      ? "border-primary bg-primary/5 ring-1 ring-primary font-semibold"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-foreground text-[11px]">
                    1. Manufacturer Vehicle
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Direct collection by manufacturer. No company vehicle.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateTransportMode("Logistics / Assigned Vehicle")}
                  className={`text-left p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                    createTransportMode === "Logistics / Assigned Vehicle"
                      ? "border-primary bg-primary/5 ring-1 ring-primary font-semibold"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-foreground text-[11px]">2. Company Logistics</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Assign company vehicle & driver from godown.
                  </p>
                </button>
              </div>

              {createTransportMode === "Manufacturer Vehicle" ? (
                <div className="space-y-2.5 rounded border border-blue-500/20 bg-blue-500/5 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Tracked as <strong>Manufacturer-Arranged Transport</strong>. No company fleet
                    required.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-foreground block mb-0.5">
                        Driver / Rep Name (Optional)
                      </label>
                      <input
                        className="w-full text-xs rounded border border-border bg-background px-2.5 py-1"
                        placeholder="e.g. Ramesh"
                        value={createDriverName}
                        onChange={(e) => setCreateDriverName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-foreground block mb-0.5">
                        Phone (Optional)
                      </label>
                      <input
                        className="w-full text-xs rounded border border-border bg-background px-2.5 py-1"
                        placeholder="e.g. 9876543210"
                        value={createDriverPhone}
                        onChange={(e) => setCreateDriverPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 rounded border border-border bg-muted/20 p-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">
                      Company Vehicle (Optional - Supervisor/Admin can assign later)
                    </label>
                    <select
                      className="w-full text-xs rounded border border-border bg-background px-2.5 py-1.5 text-foreground"
                      value={createVehiclePlate}
                      onChange={(e) => {
                        const plate = e.target.value;
                        setCreateVehiclePlate(plate);
                        const matched = vehiclesList.find((v) => v.plate_number === plate);
                        if (matched?.assigned_driver_name) {
                          setCreateDriverName(matched.assigned_driver_name);
                        }
                        if (matched?.assigned_driver_phone) {
                          setCreateDriverPhone(matched.assigned_driver_phone);
                        }
                      }}
                    >
                      <option value="">-- Assign Vehicle Later (Supervisor / Admin) --</option>
                      {vehiclesList.map((v) => {
                        const isDispatched = v.status === "Dispatched / On Delivery";
                        return (
                          <option key={v.id} value={v.plate_number} disabled={isDispatched}>
                            {v.plate_number} ({v.make_model}) — [{v.status}]
                            {isDispatched ? " ⚠️ UNAVAILABLE (IN TRANSIT)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Vehicles currently <strong>Dispatched / On Delivery</strong> cannot be
                      assigned.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-foreground block mb-0.5">
                        Driver Name (Optional)
                      </label>
                      <input
                        className="w-full text-xs rounded border border-border bg-background px-2.5 py-1"
                        placeholder="e.g. Ramesh Kumar"
                        value={createDriverName}
                        onChange={(e) => setCreateDriverName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-foreground block mb-0.5">
                        Driver Phone (Optional)
                      </label>
                      <input
                        className="w-full text-xs rounded border border-border bg-background px-2.5 py-1"
                        placeholder="e.g. 9876543210"
                        value={createDriverPhone}
                        onChange={(e) => setCreateDriverPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <label className="drawer-field">
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special handling or delivery instructions"
              />
            </label>
            <Button type="submit" className="w-full mt-6" disabled={isSubmitting}>
              {isSubmitting
                ? "Checking inventory & submitting..."
                : selectedProduct && parseFloat(unitPrice) < Number(selectedProduct.unit_price)
                  ? "Submit Order (Requires Super Admin Approval)"
                  : "Submit Order"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
