import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Factory,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspace } from "@/components/workspace-provider";
import { companies } from "@/lib/workspace-data";
import { missingPhone, missingRequired } from "@/lib/form-required";
import {
  createSupplier,
  deleteSupplier,
  fetchPurchaseOrders,
  fetchSuppliers,
  updateSupplier,
  type DBPurchaseOrder,
  type DBSupplier,
} from "@/lib/erp-service";

export function SuppliersWorkspace({ supplierId }: { supplierId?: string }) {
  const navigate = useNavigate();
  const { company, currentUser, hasPermission } = useWorkspace();
  const canManage = hasPermission("suppliers.manage");

  const [loading, setLoading] = useState(true);
  const [dbSuppliers, setDbSuppliers] = useState<DBSupplier[]>([]);
  const [dbPOs, setDbPOs] = useState<DBPurchaseOrder[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [supplierType, setSupplierType] = useState("Manufacturer");
  const [paymentDays, setPaymentDays] = useState("30");
  const [supplierCompany, setSupplierCompany] = useState("asian");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const reload = () => {
    setLoading(true);
    Promise.all([fetchSuppliers(company), fetchPurchaseOrders(company)])
      .then(([suppliers, purchaseOrders]) => {
        setDbSuppliers(suppliers);
        setDbPOs(purchaseOrders);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [company]);

  const visibleSuppliers = useMemo(
    () => (company === "all" ? dbSuppliers : dbSuppliers.filter((s) => s.company_id === company)),
    [dbSuppliers, company],
  );

  const selected = useMemo(() => {
    if (!supplierId) return null;
    const decoded = decodeURIComponent(supplierId);
    return (
      visibleSuppliers.find((s) => s.id === supplierId) ||
      visibleSuppliers.find((s) => (s.id || s.name) === decoded) ||
      visibleSuppliers.find((s) => s.name.toLowerCase() === decoded.toLowerCase()) ||
      null
    );
  }, [supplierId, visibleSuppliers]);

  const linkedPOs = useMemo(() => {
    if (!selected) return [];
    const name = selected.name.trim().toLowerCase();
    return dbPOs.filter((po) => po.supplier_name?.trim().toLowerCase() === name);
  }, [selected, dbPOs]);

  const resetForm = () => {
    setLegalName("");
    setTradeName("");
    setContact("");
    setPhone("");
    setEmail("");
    setGstin("");
    setAddress("");
    setSupplierType("Manufacturer");
    setPaymentDays("30");
    setSupplierCompany(company === "all" ? "asian" : company);
    setNotes("");
    setStatus("Active");
    setEditId("");
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (s: DBSupplier) => {
    setEditId(s.id || "");
    setLegalName(s.name || "");
    setTradeName("");
    setContact(s.contact_person || "");
    setPhone(s.phone || "");
    setEmail(s.email || "");
    setGstin(s.gstin || "");
    setAddress(s.address || "");
    setSupplierType("Manufacturer");
    setPaymentDays(String(s.payment_terms_days || 30));
    setSupplierCompany(s.company_id || "asian");
    setNotes(s.notes || "");
    setStatus(s.status || "Active");
    setEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredError =
      missingRequired([
        { label: "Legal name", value: legalName },
        { label: "Contact person", value: contact },
      ]) || missingPhone("Phone number", phone);
    if (requiredError) {
      toast.error("Required fields missing", { description: requiredError });
      return;
    }
    try {
      await createSupplier({
        companyId: supplierCompany || "asian",
        name: legalName.trim(),
        tradeName,
        contactPerson: contact.trim(),
        phone: phone.trim(),
        email,
        gstin,
        address,
        supplierType,
        paymentTermsDays: parseInt(paymentDays, 10) || 30,
        notes,
        creatorName: currentUser?.name || "Accounts",
      });
      toast.success("Supplier profile created");
      setCreateOpen(false);
      resetForm();
      reload();
    } catch (err: unknown) {
      toast.error("Failed to create supplier", {
        description: err instanceof Error ? err.message : "Error",
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const requiredError =
      missingRequired([{ label: "Supplier / business name", value: legalName }]) ||
      missingPhone("Phone number", phone);
    if (requiredError) {
      toast.error("Required fields missing", { description: requiredError });
      return;
    }
    try {
      const updated = await updateSupplier({
        id: editId,
        name: legalName.trim(),
        contactPerson: contact,
        phone: phone.trim(),
        email,
        address,
        gstin,
        notes,
        status,
        paymentTermsDays: parseInt(paymentDays, 10) || 30,
        companyId: supplierCompany,
        userName: currentUser?.name || "Accounts",
      });
      setDbSuppliers((prev) => prev.map((s) => (s.id === editId ? updated : s)));
      toast.success("Supplier profile updated");
      setEditOpen(false);
      reload();
    } catch (err: unknown) {
      toast.error("Failed to update supplier", {
        description: err instanceof Error ? err.message : "Error",
      });
    }
  };

  if (supplierId) {
    if (loading && !selected) {
      return <p className="mt-8 text-sm text-muted-foreground">Loading supplier profile…</p>;
    }
    if (!selected) {
      return (
        <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Supplier not found</h2>
          <p className="text-xs text-muted-foreground">
            This profile may have been removed or belongs to another company workspace.
          </p>
          <Button size="sm" onClick={() => navigate({ to: "/suppliers" })}>
            Back to suppliers
          </Button>
        </div>
      );
    }

    return (
      <section className="customer-dossier-page mt-5">
        <div className="mb-4">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs gap-1.5"
            onClick={() => navigate({ to: "/suppliers" })}
          >
            ← Back to suppliers
          </Button>
        </div>
        <div className="customer-dossier-identity mb-5 flex items-center gap-3.5 min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <span className="avatar customer-dossier-avatar size-14 text-sm font-bold shrink-0 bg-primary/10 text-primary border border-primary/20">
            {selected.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="customer-dossier-title text-lg font-bold text-foreground truncate">
              {selected.name}
            </h2>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="status success text-xs font-semibold py-0.5 px-2.5">
                {selected.status}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {companies.find((c) => c.id === selected.company_id)?.name || "Avighna Group"}
              </span>
            </div>
            <p className="customer-dossier-meta text-xs text-muted-foreground mt-1.5 font-mono">
              Supplier ID {selected.id || "—"}
            </p>
          </div>
        </div>

        <div className="customer-dossier-actions flex items-center gap-3 flex-wrap pb-3 border-b border-border/40 mb-4">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5"
              onClick={() => openEdit(selected)}
            >
              <Pencil className="size-3.5 text-primary" />
              Edit Profile
            </Button>
          )}
          {hasPermission("purchases.create") && (
            <Button
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5"
              onClick={() =>
                navigate({
                  to: "/purchases",
                  search: {
                    supplier: selected.name,
                    company: selected.company_id,
                    openCreate: "true",
                  } as unknown as Record<string, string>,
                })
              }
            >
              <Plus className="size-3.5" />
              New purchase order
            </Button>
          )}
        </div>

        {canManage && selected.id ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 mb-4">
            <h3 className="text-sm font-bold text-destructive">Danger zone</h3>
            <p className="text-xs text-muted-foreground">
              Permanently removes this supplier profile. Linked purchase orders keep the supplier
              name as text.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (!window.confirm(`Delete supplier "${selected.name}"? This cannot be undone.`))
                  return;
                try {
                  await deleteSupplier(selected.id!, currentUser?.name);
                  toast.success("Supplier deleted");
                  navigate({ to: "/suppliers" });
                } catch (err: unknown) {
                  toast.error("Delete failed", {
                    description: err instanceof Error ? err.message : "Error",
                  });
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Delete supplier
            </Button>
          </div>
        ) : null}

        <div className="customer-dossier-body grid gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Contact</h3>
            <div className="customer-card-details !border-0 !pt-0 !mt-0">
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Users className="size-3 text-primary shrink-0" /> Contact
                </span>
                <span className="customer-card-value">{selected.contact_person || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Phone className="size-3 text-primary shrink-0" /> Phone
                </span>
                <span className="customer-card-value font-mono font-bold">
                  {selected.phone || "—"}
                </span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Mail className="size-3 text-primary shrink-0" /> Email
                </span>
                <span className="customer-card-value">{selected.email || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <MapPin className="size-3 text-primary shrink-0" /> Address
                </span>
                <span className="customer-card-value">{selected.address || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">GSTIN</span>
                <span className="customer-card-value font-mono">{selected.gstin || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">Payment terms</span>
                <span className="customer-card-value">
                  {selected.payment_terms_days || 30} days
                </span>
              </div>
            </div>
            {selected.notes ? (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                {selected.notes}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">Purchase orders</h3>
              <span className="text-[11px] text-muted-foreground">{linkedPOs.length} linked</span>
            </div>
            {linkedPOs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No purchase orders yet for this supplier name.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {linkedPOs.map((po) => (
                  <div
                    key={po.id}
                    className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{po.product_name}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {po.quantity} {po.unit} · {po.status}
                      </p>
                    </div>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {po.id?.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SupplierFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Edit supplier"
          description="Update supplier profile details"
          onSubmit={handleUpdate}
          values={{
            legalName,
            tradeName,
            contact,
            phone,
            email,
            gstin,
            address,
            supplierType,
            paymentDays,
            supplierCompany,
            notes,
            status,
          }}
          setters={{
            setLegalName,
            setTradeName,
            setContact,
            setPhone,
            setEmail,
            setGstin,
            setAddress,
            setSupplierType,
            setPaymentDays,
            setSupplierCompany,
            setNotes,
            setStatus,
          }}
          showStatus
        />
      </section>
    );
  }

  return (
    <div className="customers-page">
      <div className="customers-toolbar mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="customers-toolbar-count text-xs text-muted-foreground">
          {visibleSuppliers.length} supplier profiles
        </span>
        {canManage && (
          <Button
            size="sm"
            className="customers-toolbar-action h-8 gap-1.5 text-xs font-semibold"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add supplier
          </Button>
        )}
      </div>

      <div className="module-grid customers-grid">
        {visibleSuppliers.map((s) => (
          <article
            key={s.id || s.name}
            className="module-item customer-card cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group select-none flex flex-col"
            title={`Open full profile for ${s.name}`}
            onClick={() =>
              navigate({
                to: "/suppliers/$supplierId",
                params: { supplierId: s.id || encodeURIComponent(s.name) },
              })
            }
          >
            <div className="customer-card-head">
              <span className="avatar customer-card-avatar size-10 text-xs font-bold group-hover:scale-105 transition-transform shrink-0">
                {s.initials}
              </span>
              <div className="customer-card-title min-w-0 flex-1">
                <div className="customer-card-title-row flex items-start justify-between gap-2">
                  <h2 className="customer-card-name font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug break-words">
                    {s.name}
                  </h2>
                  <span className="status success shrink-0">{s.status}</span>
                </div>
                <p className="customer-card-company mt-1 text-xs text-muted-foreground font-medium flex items-center gap-1.5 min-w-0">
                  <Building2 className="size-3 text-primary shrink-0" />
                  <span className="truncate">
                    {companies.find((co) => co.id === s.company_id)?.name || "Asian Apex & Co."}
                  </span>
                </p>
              </div>
            </div>

            <div className="customer-card-details">
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Users className="size-3 text-primary shrink-0" /> Contact
                </span>
                <span className="customer-card-value">{s.contact_person || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Phone className="size-3 text-primary shrink-0" /> Phone
                </span>
                <span className="customer-card-value font-mono font-bold">{s.phone || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Mail className="size-3 text-primary shrink-0" /> Email
                </span>
                <span className="customer-card-value">{s.email || "—"}</span>
              </div>
              <div className="customer-card-row">
                <span className="customer-card-label">
                  <Factory className="size-3 text-primary shrink-0" /> Terms
                </span>
                <span className="customer-card-value">{s.payment_terms_days || 30} days</span>
              </div>
            </div>

            <div className="customer-card-footer">
              <span className="customer-card-cta">
                <span className="customer-card-cta-full">Open Supplier Profile →</span>
                <span className="customer-card-cta-short">Open profile →</span>
              </span>
              {canManage && (
                <div className="customer-card-actions flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                    title="Edit Supplier"
                    aria-label="Edit supplier"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(s);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  {s.id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Delete supplier"
                      aria-label="Delete supplier"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm(`Delete supplier "${s.name}"? This cannot be undone.`))
                          return;
                        try {
                          await deleteSupplier(s.id!, currentUser?.name);
                          toast.success("Supplier deleted");
                          reload();
                        } catch (err: unknown) {
                          toast.error("Delete failed", {
                            description: err instanceof Error ? err.message : "Error",
                          });
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {visibleSuppliers.length === 0 && !loading && (
        <p className="customers-empty p-8 text-center text-muted-foreground text-sm">
          No supplier profiles yet. Accounts can add vendors used on purchase orders.
        </p>
      )}

      <SupplierFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add supplier"
        description="Create a supplier profile for purchase orders"
        onSubmit={handleCreate}
        values={{
          legalName,
          tradeName,
          contact,
          phone,
          email,
          gstin,
          address,
          supplierType,
          paymentDays,
          supplierCompany,
          notes,
          status,
        }}
        setters={{
          setLegalName,
          setTradeName,
          setContact,
          setPhone,
          setEmail,
          setGstin,
          setAddress,
          setSupplierType,
          setPaymentDays,
          setSupplierCompany,
          setNotes,
          setStatus,
        }}
      />

      <SupplierFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit supplier"
        description="Update supplier profile details"
        onSubmit={handleUpdate}
        values={{
          legalName,
          tradeName,
          contact,
          phone,
          email,
          gstin,
          address,
          supplierType,
          paymentDays,
          supplierCompany,
          notes,
          status,
        }}
        setters={{
          setLegalName,
          setTradeName,
          setContact,
          setPhone,
          setEmail,
          setGstin,
          setAddress,
          setSupplierType,
          setPaymentDays,
          setSupplierCompany,
          setNotes,
          setStatus,
        }}
        showStatus
      />
    </div>
  );
}

function SupplierFormSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  values,
  setters,
  showStatus = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSubmit: (e: React.FormEvent) => void;
  values: {
    legalName: string;
    tradeName: string;
    contact: string;
    phone: string;
    email: string;
    gstin: string;
    address: string;
    supplierType: string;
    paymentDays: string;
    supplierCompany: string;
    notes: string;
    status: "Active" | "Inactive";
  };
  setters: {
    setLegalName: (v: string) => void;
    setTradeName: (v: string) => void;
    setContact: (v: string) => void;
    setPhone: (v: string) => void;
    setEmail: (v: string) => void;
    setGstin: (v: string) => void;
    setAddress: (v: string) => void;
    setSupplierType: (v: string) => void;
    setPaymentDays: (v: string) => void;
    setSupplierCompany: (v: string) => void;
    setNotes: (v: string) => void;
    setStatus: (v: "Active" | "Inactive") => void;
  };
  showStatus?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto max-h-screen">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="drawer-field">
            Legal name <span className="text-destructive">*</span>
            <input
              required
              value={values.legalName}
              onChange={(e) => setters.setLegalName(e.target.value)}
              placeholder="Registered supplier legal name"
            />
          </label>
          <label className="drawer-field">
            Trade name
            <input
              value={values.tradeName}
              onChange={(e) => setters.setTradeName(e.target.value)}
              placeholder="Doing business as name"
            />
          </label>
          <label className="drawer-field">
            Contact person <span className="text-destructive">*</span>
            <input
              required
              value={values.contact}
              onChange={(e) => setters.setContact(e.target.value)}
              placeholder="Primary contact name"
            />
          </label>
          <label className="drawer-field">
            Phone number <span className="text-destructive">*</span>
            <input
              type="tel"
              required
              value={values.phone}
              onChange={(e) => setters.setPhone(e.target.value)}
              placeholder="+91 98..."
            />
          </label>
          <label className="drawer-field">
            Email
            <input
              type="email"
              value={values.email}
              onChange={(e) => setters.setEmail(e.target.value)}
              placeholder="billing@supplier.com"
            />
          </label>
          <label className="drawer-field">
            GSTIN
            <input
              value={values.gstin}
              onChange={(e) => setters.setGstin(e.target.value)}
              placeholder="29AAAAA0000A1Z5"
            />
          </label>
          <label className="drawer-field">
            Address
            <textarea
              rows={2}
              value={values.address}
              onChange={(e) => setters.setAddress(e.target.value)}
              placeholder="Registered / billing address"
            />
          </label>
          <label className="drawer-field">
            Supplier type
            <select
              value={values.supplierType}
              onChange={(e) => setters.setSupplierType(e.target.value)}
            >
              <option value="Manufacturer">Manufacturer</option>
              <option value="Trader">Trader</option>
              <option value="Importer">Importer</option>
              <option value="Distributor">Distributor</option>
              <option value="Service">Service</option>
            </select>
          </label>
          <label className="drawer-field">
            Payment terms (days)
            <input
              type="number"
              min={1}
              value={values.paymentDays}
              onChange={(e) => setters.setPaymentDays(e.target.value)}
              placeholder="30"
            />
          </label>
          <label className="drawer-field">
            Company workspace
            <select
              value={values.supplierCompany}
              onChange={(e) => setters.setSupplierCompany(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {showStatus && (
            <label className="drawer-field">
              Status
              <select
                value={values.status}
                onChange={(e) => setters.setStatus(e.target.value as "Active" | "Inactive")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          )}
          <label className="drawer-field">
            Notes
            <textarea
              rows={2}
              value={values.notes}
              onChange={(e) => setters.setNotes(e.target.value)}
              placeholder="Bank details, lead time, remarks…"
            />
          </label>
          <div className="flex items-center gap-3 pt-3">
            <Button type="submit" className="flex-1">
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
