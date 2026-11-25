import { useMemo, useState } from "react";
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
  poRemainingQuantity,
  receivePurchaseGoods,
  type DBPurchaseOrder,
} from "@/lib/erp-service";
import type { RoleType } from "@/lib/auth-service";

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
 * partial receive into inventory tagged to that PO, with remaining qty shown.
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
    "idle" | "processing" | "review" | "saving"
  >("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<CoaExtraction>(emptyCoaExtraction());
  const [receiveQty, setReceiveQty] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const remaining = po ? poRemainingQuantity(po) : 0;
  const qtyPreview = useMemo(() => resolvedReceiveQuantity(extraction), [extraction]);

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

      if (result.remaining > 0) {
        toast.success(
          `Received ${result.receivedThisTime} ${po.unit} (batch ${result.batchNumber || batchNumber}). Remaining to receive: ${result.remaining} ${po.unit}.`,
        );
      } else {
        toast.success(
          `Fully received ${result.receivedThisTime} ${po.unit} — stock updated and PO closed.`,
        );
      }
      reset();
      onOpenChange(false);
      onReceived();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update inventory.";
      setError(message);
      setStage("review");
      toast.error(message);
    }
  };

  return (
    <Sheet open={open && !!po} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col overflow-y-auto !max-w-[min(96vw,720px)] sm:!max-w-[min(96vw,720px)] pb-16">
        <SheetHeader className="shrink-0 pr-8">
          <SheetTitle>Receive from supplier invoice</SheetTitle>
          <SheetDescription>
            Supervisor uploads the supplier invoice PDF (or photo). OCR fills product, batch ID,
            and qty — confirm to tag stock to PO #{po?.id}. Short shipments leave remaining open.
            Logistics does not review inbound arrivals.
          </SheetDescription>
        </SheetHeader>

        {po && (
          <div className="mt-5 space-y-4 pb-10">
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
