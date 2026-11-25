import { useMemo, useState, type FormEvent } from "react";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  emptyCoaExtraction,
  fieldStatus,
  normalizeDateValue,
  resolvedReceiveQuantity,
  type CoaExtraction,
  type CoaField,
} from "@/lib/coa-ocr";
import {
  extractCoaInBrowser,
  guessCoaMimeType,
  isCoaImageFile,
} from "@/lib/coa-client-ocr";
import { extractCoaDocument } from "@/lib/coa-service";
import {
  poPaymentRemaining,
  poPaymentStatus,
  poRemainingQuantity,
  receivePurchaseGoods,
  recordSupplierPayment,
  SUPPLIER_PAYMENT_METHODS,
  type DBPurchaseOrder,
  type SupplierPaymentMethod,
} from "@/lib/erp-service";
import type { RoleType } from "@/lib/auth-service";

type PaySettlement = "fully" | "partial" | "unpaid";

function fileToBase64(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  });
}

function statusClass(status: ReturnType<typeof fieldStatus>) {
  if (status === "ok") return "border-emerald-500/40 bg-emerald-500/5";
  if (status === "low") return "border-amber-500/40 bg-amber-500/5";
  if (status === "invalid") return "border-destructive/50 bg-destructive/5";
  return "border-border bg-muted/20";
}

function FieldInput({
  label,
  field,
  kind = "text",
  onChange,
}: {
  label: string;
  field: CoaField;
  kind?: "text" | "date" | "number";
  onChange: (next: CoaField) => void;
}) {
  const status = fieldStatus(field, kind);
  return (
    <label
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border p-2.5 text-[12px] ${statusClass(status)}`}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {status === "ok" ? "OK" : status === "low" ? "Check" : status === "invalid" ? "Invalid" : "Edit"}
        </span>
      </span>
      <input
        className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={field.value || ""}
        onChange={(e) =>
          onChange({
            value: e.target.value || null,
            confidence: Math.max(field.confidence, 0.9),
          })
        }
        placeholder={kind === "date" ? "YYYY-MM-DD" : undefined}
      />
    </label>
  );
}

async function pickInvoicePhoto(): Promise<File | null> {
  try {
    const { Camera: CapCamera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const photo = await CapCamera.getPhoto({
      quality: 85,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    return new File([blob], `invoice-${Date.now()}.jpg`, {
      type: blob.type || "image/jpeg",
    });
  } catch {
    return null;
  }
}

/**
 * Supervisor (or super admin) uploads supplier invoice photo → OCR review popup →
 * partial receive into inventory tagged to that PO → optional supplier payment.
 */
export function PoInvoiceReceiveSheet({
  po,
  open,
  onOpenChange,
  actorRole,
  actorName,
  allowAnyStatus,
  onReceived,
}: {
  po: DBPurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: RoleType | undefined;
  actorName: string;
  allowAnyStatus?: boolean;
  onReceived: () => void;
}) {
  const [stage, setStage] = useState<
    "idle" | "processing" | "review" | "saving" | "payment"
  >("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<CoaExtraction>(emptyCoaExtraction());
  const [receiveQty, setReceiveQty] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [receivedPo, setReceivedPo] = useState<DBPurchaseOrder | null>(null);
  const [receivedThisTime, setReceivedThisTime] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<SupplierPaymentMethod>("Bank Transfer");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [paySettlement, setPaySettlement] = useState<PaySettlement>("fully");

  const remaining = po ? poRemainingQuantity(po) : 0;
  const qtyPreview = useMemo(() => resolvedReceiveQuantity(extraction), [extraction]);
  const paymentPo = receivedPo || po;
  const payRemaining = paymentPo ? poPaymentRemaining(paymentPo) : 0;

  const applySettlement = (mode: PaySettlement, rem: number) => {
    setPaySettlement(mode);
    setError("");
    if (mode === "fully") setPayAmount(rem > 0 ? String(rem) : "");
    else if (mode === "partial") {
      const half = rem > 0 ? Math.round((rem / 2) * 100) / 100 : 0;
      setPayAmount(half > 0 ? String(half) : "");
    } else setPayAmount("");
  };

  const reset = () => {
    setStage("idle");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtraction(emptyCoaExtraction());
    setReceiveQty("");
    setNotes("");
    setError("");
    setWarning(null);
    setReceivedPo(null);
    setReceivedThisTime(0);
    setPayAmount("");
    setPayMethod("Bank Transfer");
    setPayRef("");
    setPayNotes("");
    setPaySaving(false);
    setPaySettlement("fully");
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const runExtract = async (selected: File) => {
    if (!po || !actorRole) return;
    setError("");
    setWarning(null);
    setStage("processing");
    try {
      const encoded = await fileToBase64(selected);
      const mimeType = guessCoaMimeType(selected);
      let ocrText = "";
      let browserExtraction: CoaExtraction | null = null;
      let browserError: string | undefined;

      if (isCoaImageFile(selected)) {
        const browser = await extractCoaInBrowser(selected);
        ocrText = browser.text;
        browserError = browser.error;
        if (browser.engine === "browser") browserExtraction = browser.extraction;
      }

      let next = browserExtraction;
      if (!next) {
        const res = await extractCoaDocument({
          data: {
            actorRole,
            fileName: selected.name,
            mimeType,
            base64: encoded,
            companyId: po.company_id,
            ...(ocrText.trim() ? { ocrText } : {}),
          },
        });
        if (res.ok) {
          next = res.extraction;
          setWarning(res.warning || null);
        } else {
          setWarning(
            browserError ||
              res.error ||
              "Could not auto-read the invoice. Enter details manually.",
          );
          next = emptyCoaExtraction();
        }
      }

      const extractionNext = next || emptyCoaExtraction();
      // Prefill product name from PO when OCR missed it
      if (!extractionNext.productName.value?.trim()) {
        extractionNext.productName = {
          value: po.product_name,
          confidence: 0.85,
        };
      }
      if (!extractionNext.supplierName.value?.trim()) {
        extractionNext.supplierName = {
          value: po.supplier_name,
          confidence: 0.85,
        };
      }
      if (!extractionNext.unit.value?.trim()) {
        extractionNext.unit = { value: po.unit, confidence: 0.9 };
      }

      setExtraction(extractionNext);
      const resolved = resolvedReceiveQuantity(extractionNext);
      const suggested =
        resolved.quantity > 0
          ? Math.min(resolved.quantity, remaining)
          : remaining;
      setReceiveQty(String(suggested || ""));
      setStage("review");
      toast.success("Review OCR details, then confirm to update inventory.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read invoice.";
      setError(message);
      setStage("idle");
      toast.error(message);
    }
  };

  const onPickFile = (next: File | null) => {
    if (!next) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    void runExtract(next);
  };

  const handleCamera = async () => {
    const photo = await pickInvoicePhoto();
    if (photo) onPickFile(photo);
    else {
      // Fallback: trigger hidden file input via toast hint
      toast.message("Use Upload photo if camera is unavailable.");
    }
  };

  const updateField = (key: keyof CoaExtraction, next: CoaField) => {
    setExtraction((prev) => ({ ...prev, [key]: next }));
  };

  const handleConfirm = async () => {
    if (!po) return;
    if (!po.product_id) {
      setError("This PO is not linked to a catalog product.");
      toast.error("Ask Accounts to recreate the PO with a product selected.");
      return;
    }
    const qty = Number(receiveQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter qty that arrived this time.");
      toast.error("Enter a valid quantity for this arrival.");
      return;
    }
    if (qty > remaining + 1e-9) {
      setError(`Only ${remaining} ${po.unit} remaining on this PO.`);
      toast.error(`Cannot receive more than remaining (${remaining} ${po.unit}).`);
      return;
    }

    const batchNumber = extraction.batchNumber.value?.trim();
    if (!batchNumber) {
      setError("Batch / lot number from the invoice is required.");
      toast.error("Enter the supplier batch ID before confirming.");
      return;
    }

    setStage("saving");
    setError("");
    try {
      const mfg = normalizeDateValue(extraction.manufacturingDate.value);
      const exp = normalizeDateValue(extraction.expiryDate.value);
      const result = await receivePurchaseGoods(po.id, po.company_id, actorName, {
        productId: po.product_id,
        receiveQty: qty,
        notes: [
          notes.trim(),
          file ? `Invoice photo: ${file.name}` : "",
          extraction.productName.value
            ? `OCR product: ${extraction.productName.value}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        allowAnyStatus,
        batchNumber,
        manufacturerName: extraction.manufacturerName.value || undefined,
        mfgDate: mfg,
        expiryDate: exp,
      });

      const updatedPo = {
        ...result.po,
        paid_amount: Number(result.po.paid_amount ?? po.paid_amount) || 0,
      };
      setReceivedPo(updatedPo);
      setReceivedThisTime(result.receivedThisTime);
      const remPay = poPaymentRemaining(updatedPo);
      setPaySettlement("fully");
      setPayAmount(remPay > 0 ? String(remPay) : "");
      if (result.remaining > 0) {
        toast.success(
          `Stock updated: +${result.receivedThisTime} ${po.unit}. Remaining to receive: ${result.remaining} ${po.unit}. Now choose Fully / Partially paid.`,
        );
      } else {
        toast.success(
          `Fully received ${result.receivedThisTime} ${po.unit}. Now choose Fully / Partially paid for this invoice.`,
        );
      }
      setStage("payment");
      onReceived();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update inventory.";
      setError(message);
      setStage("review");
      toast.error(message);
    }
  };

  const finishWithoutPayment = () => {
    reset();
    onOpenChange(false);
  };

  const handlePaymentConfirm = async () => {
    if (!paymentPo) return;
    if (paySettlement === "unpaid") {
      toast.message("Marked unpaid — you can pay later from Purchases → Supplier payment.");
      finishWithoutPayment();
      return;
    }
    let amount = Number(payAmount);
    if (paySettlement === "fully") {
      amount = payRemaining > 0 ? payRemaining : amount;
      setPayAmount(String(amount));
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter how much was paid to the supplier.");
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (paySettlement === "partial" && payRemaining > 0 && amount + 1e-9 >= payRemaining) {
      setError("For partially paid, enter less than the remaining payable (or choose Fully paid).");
      toast.error("Partial amount must be less than remaining payable.");
      return;
    }
    setPaySaving(true);
    setError("");
    try {
      const result = await recordSupplierPayment({
        purchaseOrderId: paymentPo.id,
        companyId: paymentPo.company_id,
        amount,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim() || undefined,
        notes: [
          paySettlement === "fully" ? "Fully paid" : "Partially paid",
          payNotes.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        recordedByName: actorName,
      });
      const status = poPaymentStatus(result.po);
      if (result.remaining > 0) {
        toast.success(
          `${status}: ₹${amount.toLocaleString("en-IN")} via ${payMethod}. Remaining payable: ₹${result.remaining.toLocaleString("en-IN")}.`,
        );
      } else {
        toast.success(`Fully paid ₹${amount.toLocaleString("en-IN")} via ${payMethod}.`);
      }
      reset();
      onOpenChange(false);
      onReceived();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save supplier payment.";
      setError(message);
      toast.error(message);
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <Sheet open={open && !!po} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col overflow-y-auto !max-w-[min(96vw,720px)] sm:!max-w-[min(96vw,720px)] pb-16">
        <SheetHeader className="shrink-0 pr-8">
          <SheetTitle>
            {stage === "payment" ? "Supplier payment" : "Receive from supplier invoice"}
          </SheetTitle>
          <SheetDescription>
            {stage === "payment"
              ? `Stock is updated. Record how much was paid to ${paymentPo?.supplier_name || "the supplier"} for this invoice, and the payment type.`
              : `Supervisor uploads the supplier invoice PDF (or photo). OCR fills product, batch ID, and qty — confirm to tag stock to PO #${po?.id}. Then record supplier payment.`}
          </SheetDescription>
        </SheetHeader>

        {po && (
          <div className="mt-5 space-y-4 pb-10">
            {stage !== "payment" && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Product (PO)</span>
                <span className="font-bold text-right">{po.product_name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-semibold text-right">{po.supplier_name}</span>
              </div>
              <div className="flex justify-between gap-2 pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Ordered</span>
                <span className="font-semibold">
                  {po.quantity} {po.unit}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Already received</span>
                <span className="font-semibold">
                  {Number(po.received_quantity) || 0} {po.unit}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Remaining to receive</span>
                <span className="font-bold text-primary">
                  {remaining} {po.unit}
                </span>
              </div>
            </div>
            )}

            {stage === "idle" || stage === "processing" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90">
                    <FileUp className="size-3.5" />
                    Upload supplier invoice PDF
                    <input
                      type="file"
                      accept="application/pdf,.pdf,image/*"
                      className="hidden"
                      disabled={stage === "processing"}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        onPickFile(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 text-xs font-semibold"
                    disabled={stage === "processing"}
                    onClick={() => void handleCamera()}
                  >
                    <Camera className="size-3.5" />
                    Camera (optional)
                  </Button>
                </div>
                {stage === "processing" && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Reading supplier invoice…
                  </p>
                )}
              </div>
            ) : null}

            {(stage === "review" || stage === "saving") && (
              <>
                {previewUrl && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <img
                      src={previewUrl}
                      alt="Supplier invoice"
                      className="max-h-48 w-full object-contain bg-muted/40"
                    />
                  </div>
                )}
                {warning && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                    {warning}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <FieldInput
                    label="Product name (from invoice)"
                    field={extraction.productName}
                    onChange={(n) => updateField("productName", n)}
                  />
                  <FieldInput
                    label="Batch / lot ID"
                    field={extraction.batchNumber}
                    onChange={(n) => updateField("batchNumber", n)}
                  />
                  <FieldInput
                    label="Manufacturer"
                    field={extraction.manufacturerName}
                    onChange={(n) => updateField("manufacturerName", n)}
                  />
                  <FieldInput
                    label="Supplier / party"
                    field={extraction.supplierName}
                    onChange={(n) => updateField("supplierName", n)}
                  />
                  <FieldInput
                    label="Mfg date"
                    field={extraction.manufacturingDate}
                    kind="date"
                    onChange={(n) => updateField("manufacturingDate", n)}
                  />
                  <FieldInput
                    label="Expiry date"
                    field={extraction.expiryDate}
                    kind="date"
                    onChange={(n) => updateField("expiryDate", n)}
                  />
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    Confirm this arrival
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    OCR suggested {qtyPreview.quantity || "—"} {qtyPreview.unit || po.unit}. Enter
                    how much arrived now (max {remaining} {po.unit}).
                  </p>
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                    Qty this arrival ({po.unit})
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      max={remaining}
                      className="h-10 rounded-md border border-border bg-background px-3 text-[14px] font-semibold"
                      value={receiveQty}
                      onChange={(e) => setReceiveQty(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                    Notes (optional)
                    <input
                      className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Vehicle / GRN / short shipment note"
                    />
                  </label>
                  {Number(receiveQty) > 0 && Number(receiveQty) <= remaining && (
                    <p className="text-[11px] font-semibold text-foreground">
                      After confirm: remaining will be{" "}
                      <span className="text-primary">
                        {(remaining - Number(receiveQty)).toLocaleString("en-IN")} {po.unit}
                      </span>
                      {remaining - Number(receiveQty) <= 0 ? " (PO fully received)" : ""}
                    </p>
                  )}
                </div>

                {error && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs font-semibold"
                    disabled={stage === "saving"}
                    onClick={() => {
                      reset();
                    }}
                  >
                    Re-upload photo
                  </Button>
                  <Button
                    type="button"
                    className="h-9 flex-1 text-xs font-bold"
                    disabled={stage === "saving"}
                    onClick={() => void handleConfirm()}
                  >
                    {stage === "saving" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Updating inventory…
                      </>
                    ) : (
                      "Confirm details & update inventory"
                    )}
                  </Button>
                </div>
              </>
            )}

            {stage === "payment" && paymentPo && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Supplier</span>
                    <span className="font-bold text-right">{paymentPo.supplier_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-semibold text-right">{paymentPo.product_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Stock received this time</span>
                    <span className="font-semibold">
                      {receivedThisTime} {paymentPo.unit}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 pt-1 border-t border-border/60">
                    <span className="text-muted-foreground">Invoice / PO total</span>
                    <span className="font-semibold">
                      ₹{(Number(paymentPo.total_amount) || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Already paid</span>
                    <span className="font-semibold">
                      ₹{(Number(paymentPo.paid_amount) || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Remaining payable</span>
                    <span className="font-bold text-primary">
                      ₹{payRemaining.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Current status</span>
                    <span className="font-semibold">{poPaymentStatus(paymentPo)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Payment settlement
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: "fully" as const,
                          label: "Fully paid",
                          hint: "Clear remaining balance",
                        },
                        {
                          id: "partial" as const,
                          label: "Partially paid",
                          hint: "Pay some amount now",
                        },
                        {
                          id: "unpaid" as const,
                          label: "Unpaid / later",
                          hint: "Skip — pay from PO later",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          paySettlement === opt.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-muted/40"
                        }`}
                        onClick={() => applySettlement(opt.id, payRemaining)}
                      >
                        <p className="text-[12px] font-bold text-foreground">{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {paySettlement !== "unpaid" && (
                  <>
                    <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                      Amount paid (₹)
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        max={payRemaining || undefined}
                        className="h-10 rounded-md border border-border bg-background px-3 text-[14px] font-semibold"
                        value={payAmount}
                        readOnly={paySettlement === "fully"}
                        onChange={(e) => {
                          setPayAmount(e.target.value);
                          if (paySettlement === "fully") setPaySettlement("partial");
                        }}
                        placeholder={
                          paySettlement === "fully"
                            ? "Full remaining amount"
                            : "Enter partial amount"
                        }
                      />
                      {paySettlement === "fully" && (
                        <span className="text-[10px] text-muted-foreground">
                          Locked to remaining ₹{payRemaining.toLocaleString("en-IN")}. Switch to
                          Partially paid to enter a smaller amount.
                        </span>
                      )}
                      {paySettlement === "partial" && Number(payAmount) > 0 && (
                        <span className="text-[10px] font-semibold text-foreground">
                          After this: remaining ₹
                          {Math.max(0, payRemaining - Number(payAmount)).toLocaleString("en-IN")}{" "}
                          (Partially paid)
                        </span>
                      )}
                    </label>

                    <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                      Payment type
                      <select
                        className="h-10 rounded-md border border-border bg-background px-3 text-[13px] font-semibold"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as SupplierPaymentMethod)}
                      >
                        {SUPPLIER_PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                      Reference / UTR / cheque no. (optional)
                      <input
                        className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="Transaction ID or cheque number"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                      Notes (optional)
                      <input
                        className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Advance / short payment note"
                      />
                    </label>
                  </>
                )}

                {paySettlement === "unpaid" && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                    Invoice stays <strong>Unpaid</strong>. Record payment later from Purchases →
                    Supplier payment (Fully paid / Partially paid).
                  </p>
                )}

                {error && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs font-semibold"
                    disabled={paySaving}
                    onClick={finishWithoutPayment}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    className="h-9 flex-1 text-xs font-bold"
                    disabled={paySaving}
                    onClick={() => void handlePaymentConfirm()}
                  >
                    {paySaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Saving payment…
                      </>
                    ) : paySettlement === "unpaid" ? (
                      "Keep unpaid & finish"
                    ) : paySettlement === "fully" ? (
                      "Confirm fully paid"
                    ) : (
                      "Confirm partially paid"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Standalone supplier payment sheet for a PO (after stock is already received). */
export function SupplierPaymentSheet({
  po,
  open,
  onOpenChange,
  actorName,
  onSaved,
}: {
  po: DBPurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorName: string;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SupplierPaymentMethod>("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settlement, setSettlement] = useState<PaySettlement>("fully");

  const remaining = po ? poPaymentRemaining(po) : 0;
  const currentStatus = po ? poPaymentStatus(po) : "Unpaid";

  const applySettlement = (mode: PaySettlement) => {
    setSettlement(mode);
    setError("");
    if (mode === "fully") setAmount(remaining > 0 ? String(remaining) : "");
    else if (mode === "partial") {
      const half = remaining > 0 ? Math.round((remaining / 2) * 100) / 100 : 0;
      setAmount(half > 0 ? String(half) : "");
    } else setAmount("");
  };

  const reset = () => {
    setAmount("");
    setMethod("Bank Transfer");
    setReference("");
    setNotes("");
    setSaving(false);
    setError("");
    setSettlement("fully");
  };

  const handleOpen = (next: boolean) => {
    if (!next) reset();
    else if (po) {
      const rem = poPaymentRemaining(po);
      setSettlement("fully");
      setAmount(rem > 0 ? String(rem) : "");
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!po) return;
    if (settlement === "unpaid") {
      toast.message("No payment recorded — status stays Unpaid / Partially paid as before.");
      reset();
      onOpenChange(false);
      return;
    }
    let payAmt = Number(amount);
    if (settlement === "fully") payAmt = remaining > 0 ? remaining : payAmt;
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      setError("Enter how much was paid.");
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (settlement === "partial" && remaining > 0 && payAmt + 1e-9 >= remaining) {
      setError("For partially paid, enter less than remaining (or choose Fully paid).");
      toast.error("Partial amount must be less than remaining payable.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await recordSupplierPayment({
        purchaseOrderId: po.id,
        companyId: po.company_id,
        amount: payAmt,
        paymentMethod: method,
        referenceNumber: reference.trim() || undefined,
        notes: [
          settlement === "fully" ? "Fully paid" : "Partially paid",
          notes.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        recordedByName: actorName,
      });
      const status = poPaymentStatus(result.po);
      if (result.remaining > 0) {
        toast.success(
          `${status}: ₹${payAmt.toLocaleString("en-IN")} via ${method}. Remaining: ₹${result.remaining.toLocaleString("en-IN")}.`,
        );
      } else {
        toast.success(`Fully paid via ${method}.`);
      }
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save payment.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open && !!po} onOpenChange={handleOpen}>
      <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
        <SheetHeader>
          <SheetTitle>Supplier payment</SheetTitle>
          <SheetDescription>
            Record Fully paid or Partially paid to {po?.supplier_name} for PO #{po?.id}.
          </SheetDescription>
        </SheetHeader>
        {po && (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4 pb-10">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Invoice / PO total</span>
                <span className="font-semibold">
                  ₹{(Number(po.total_amount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Already paid</span>
                <span className="font-semibold">
                  ₹{(Number(po.paid_amount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Remaining payable</span>
                <span className="font-bold text-primary">
                  ₹{remaining.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold">{currentStatus}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: "fully" as const, label: "Fully paid" },
                  { id: "partial" as const, label: "Partially paid" },
                  { id: "unpaid" as const, label: "Unpaid / later" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-[12px] font-bold ${
                    settlement === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                  onClick={() => applySettlement(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {settlement !== "unpaid" && (
              <>
                <label className="drawer-field">
                  Amount paid (₹) <span className="text-destructive">*</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    max={remaining || undefined}
                    value={amount}
                    readOnly={settlement === "fully"}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (settlement === "fully") setSettlement("partial");
                    }}
                  />
                </label>
                <label className="drawer-field">
                  Payment type <span className="text-destructive">*</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as SupplierPaymentMethod)}
                  >
                    {SUPPLIER_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="drawer-field">
                  Reference / UTR (optional)
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Transaction ID / cheque no."
                  />
                </label>
                <label className="drawer-field">
                  Notes (optional)
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
              </>
            )}
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <Button type="submit" className="w-full font-bold text-xs" disabled={saving}>
              {saving
                ? "Saving…"
                : settlement === "unpaid"
                  ? "Keep unpaid & close"
                  : settlement === "fully"
                    ? "Confirm fully paid"
                    : "Confirm partially paid"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
