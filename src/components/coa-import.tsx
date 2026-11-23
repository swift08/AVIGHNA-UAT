import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileUp, Loader2, Share2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { companies } from "@/lib/workspace-data";
import {
  emptyCoaExtraction,
  fieldStatus,
  normalizeDateValue,
  resolvedReceiveQuantity,
  type CoaExtraction,
  type CoaField,
  type CoaQualityRow,
} from "@/lib/coa-ocr";
import {
  extractCoaInBrowser,
  guessCoaMimeType,
  isCoaImageFile,
} from "@/lib/coa-client-ocr";
import {
  confirmCoaImport,
  extractCoaDocument,
  getBatchCoaAccess,
  listProductBatches,
} from "@/lib/coa-service";
import type { RoleType } from "@/lib/auth-service";

type ProductBatchRow = {
  id: string;
  batch_number: string;
  mfg_date?: string | null;
  expiry_date?: string | null;
  analysis_date?: string | null;
  quantity: number;
  unit: string;
  package_count?: number | null;
  package_weight?: number | null;
  supplier_name?: string | null;
  manufacturer_name?: string | null;
  coa_file_name?: string | null;
  has_coa?: boolean;
  quality?: Array<{
    parameter_name: string;
    specification: string | null;
    result_value: string | null;
    compliance_status: string | null;
  }>;
};

export function ProductBatchesPanel({
  productId,
  productName,
  tone = "inventory",
  defaultOpen = false,
  embedded = false,
}: {
  productId: string;
  productName?: string;
  /** Delivery trips use clearer “analysis report” copy for logistics drivers. */
  tone?: "inventory" | "delivery";
  defaultOpen?: boolean;
  /** Always show batch / analysis content (no toggle) — used in product detail drawers. */
  embedded?: boolean;
}) {
  const [batches, setBatches] = useState<ProductBatchRow[]>([]);
  const [open, setOpen] = useState(defaultOpen || embedded);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isDelivery = tone === "delivery";

  const load = async () => {
    setLoading(true);
    try {
      const res = await listProductBatches({ data: { productId } });
      if (res.ok) setBatches(res.batches as ProductBatchRow[]);
      else toast.error(res.error || "Could not load batches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (defaultOpen || embedded) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when panel mounts open
  }, [defaultOpen, embedded, productId]);

  const openCoaAccess = async (batchId: string, mode: "view" | "download" | "share") => {
    setBusyId(batchId);
    try {
      const res = await getBatchCoaAccess({
        data: { batchId, ...(productName ? { productName } : {}) },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      if (mode === "view") {
        window.open(res.viewUrl || res.downloadUrl, "_blank", "noopener,noreferrer");
        toast.success("Analysis report opened.");
        return;
      }

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = res.downloadUrl;
        link.download = res.fileName;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("COA download started.");
        return;
      }

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `COA — ${productName || "Product"} / ${res.batchNumber}`,
            text: res.shareText,
            url: res.viewUrl || res.downloadUrl,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }

      await navigator.clipboard.writeText(res.shareText);
      toast.success("COA details + download link copied.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open COA.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={
        embedded
          ? "space-y-2"
          : isDelivery
            ? "mt-2"
            : "mt-3 border-t border-border/70 pt-3"
      }
    >
      {!embedded && (
        <button
          type="button"
          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) void load();
          }}
        >
          {isDelivery
            ? open
              ? "Hide analysis report"
              : "View analysis report"
            : open
              ? "Hide batches / COA"
              : "View batches / COA"}
        </button>
      )}
      {(open || embedded) && (
        <div className={embedded ? "space-y-2" : "mt-2 space-y-2"}>
          {loading && <p className="text-[11px] text-muted-foreground">Loading analysis report…</p>}
          {!loading && batches.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {isDelivery
                ? "No analysis report / batch COA found for this delivery item yet."
                : "No batches recorded yet."}
            </p>
          )}
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="rounded-md border border-border bg-muted/20 px-2.5 py-2 text-[11px]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-foreground">
                    {batch.batch_number} · {batch.quantity} {batch.unit}
                    {batch.package_count && batch.package_weight
                      ? ` · ${batch.package_count}×${batch.package_weight}`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Mfg {batch.mfg_date || "—"} · Exp {batch.expiry_date || "—"}
                    {batch.analysis_date ? ` · Analysis ${batch.analysis_date}` : ""}
                  </p>
                  {(batch.manufacturer_name || batch.supplier_name) && (
                    <p className="text-muted-foreground">
                      {batch.manufacturer_name || "—"}
                      {batch.supplier_name ? ` · Party: ${batch.supplier_name}` : ""}
                    </p>
                  )}
                </div>
                {batch.has_coa ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Analysis report
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No COA
                  </span>
                )}
              </div>

              {batch.quality && batch.quality.length > 0 && (
                <div className="mt-2 rounded border border-border/60 bg-background/60 px-2 py-1.5 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Quality results
                  </p>
                  {batch.quality.slice(0, isDelivery ? 8 : 4).map((q) => (
                    <div
                      key={`${batch.id}-${q.parameter_name}`}
                      className="flex items-start justify-between gap-2 text-[10px]"
                    >
                      <span className="text-muted-foreground">{q.parameter_name}</span>
                      <span className="font-semibold text-foreground text-right">
                        {q.result_value || "—"}
                        {q.specification ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / {q.specification}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {batch.has_coa && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={isDelivery ? "default" : "outline"}
                    className="h-7 gap-1 px-2 text-[10px]"
                    disabled={busyId === batch.id}
                    onClick={() => void openCoaAccess(batch.id, "view")}
                  >
                    {busyId === batch.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Eye className="size-3" />
                    )}
                    {isDelivery ? "Open analysis report" : "View COA"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    disabled={busyId === batch.id}
                    onClick={() => void openCoaAccess(batch.id, "download")}
                  >
                    <Download className="size-3" />
                    Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    disabled={busyId === batch.id}
                    onClick={() => void openCoaAccess(batch.id, "share")}
                  >
                    <Share2 className="size-3" />
                    Share
                  </Button>
                  {batch.coa_file_name && (
                    <span className="self-center text-[10px] text-muted-foreground truncate max-w-[160px]">
                      {batch.coa_file_name}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  className = "",
}: {
  label: string;
  field: CoaField;
  kind?: "text" | "date" | "number";
  onChange: (next: CoaField) => void;
  className?: string;
}) {
  const status = fieldStatus(field, kind);
  return (
    <label
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border p-2.5 text-[12px] ${statusClass(status)} ${className}`}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            status === "ok"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : status === "low"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : status === "invalid"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          {status === "ok"
            ? "Matched"
            : status === "low"
              ? "Low"
              : status === "invalid"
                ? "Invalid"
                : "Missing"}
        </span>
      </span>
      <input
        className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

export function CoaImportButton({
  actorRole,
  actorName,
  defaultCompanyId,
  onImported,
  label = "Import Product from COA",
  shortLabel = "COA Import",
}: {
  actorRole: RoleType | undefined;
  actorName: string;
  defaultCompanyId: string;
  onImported: () => void;
  label?: string;
  shortLabel?: string;
}) {
  const allowed = actorRole === "super_admin" || actorRole === "supervisor";
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "processing" | "ready" | "pricing" | "saving"
  >("idle");
  const [companyId, setCompanyId] = useState(defaultCompanyId === "all" ? "asian" : defaultCompanyId);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64, setBase64] = useState("");
  const [extraction, setExtraction] = useState<CoaExtraction>(emptyCoaExtraction());
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [category, setCategory] = useState("");
  const [productCode, setProductCode] = useState("");

  const qtyPreview = useMemo(() => resolvedReceiveQuantity(extraction), [extraction]);

  if (!allowed) return null;

  const reset = () => {
    setStage("idle");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBase64("");
    setExtraction(emptyCoaExtraction());
    setWarning(null);
    setError("");
    setZoom(1);
    setUnitPrice("");
    setWholesalePrice("");
    setCategory("");
    setProductCode("");
  };

  const runExtract = async (selected: File) => {
    setError("");
    setWarning(null);
    setStage("uploading");
    try {
      const encoded = await fileToBase64(selected);
      setBase64(encoded);
      setStage("processing");
      if (!actorRole) throw new Error("No active session.");

      // Hosted sites: run Tesseract in the browser (Vercel serverless OCR is unreliable).
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

      // Prefer on-device OCR result so hosted Vercel does not depend on serverless Tesseract.
      if (browserExtraction) {
        setExtraction(browserExtraction);
        setWarning(null);
        setError("");
        if (browserExtraction.productGrade.value) setCategory(browserExtraction.productGrade.value);
        else if (browserExtraction.productName.value) {
          setCategory(browserExtraction.productName.value);
        }
        setStage("ready");
        toast.success("Extracted on this device. Review, then Confirm & Add to Inventory.");
        return;
      }

      // If browser OCR got text but mapping failed, still send text to server finalize.
      const res = await extractCoaDocument({
        data: {
          actorRole,
          fileName: selected.name,
          mimeType,
          base64: encoded,
          companyId,
          ...(ocrText.trim() ? { ocrText } : {}),
        },
      });
      if (!res.ok) {
        setError([res.error, browserError].filter(Boolean).join(" — "));
        setStage("ready");
        setExtraction(emptyCoaExtraction());
        setWarning(browserError || "Could not auto-read this COA. Fill the fields manually, then confirm.");
        toast.error(res.error);
        return;
      }

      setExtraction(res.extraction);
      const empty = res.engine === "empty";
      setWarning(
        empty
          ? browserError ||
              res.warning ||
              "Could not auto-read this COA. Fill the fields manually, then confirm."
          : res.warning,
      );
      if (res.extraction.productGrade.value) setCategory(res.extraction.productGrade.value);
      else if (res.extraction.productName.value) setCategory(res.extraction.productName.value);
      setStage("ready");
      if (empty) {
        toast.error(browserError || "Could not auto-read this COA. Fill fields manually.");
      } else {
        toast.success("Extracted into the form. Review, then Confirm & Add to Inventory.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not process COA.";
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

  const updateField = (key: keyof CoaExtraction, next: CoaField) => {
    setExtraction((prev) => ({ ...prev, [key]: next }));
  };

  const updateQuality = (index: number, patch: Partial<CoaQualityRow>) => {
    setExtraction((prev) => ({
      ...prev,
      qualityParameters: prev.qualityParameters.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const handleConfirmClick = () => {
    setError("");
    setUnitPrice("");
    setWholesalePrice("");
    setStage("pricing");
  };

  const handleConfirm = async () => {
    if (!file || !actorRole || !base64) return;
    const selling = parseFloat(unitPrice);
    const wholesale = parseFloat(wholesalePrice);
    if (!Number.isFinite(selling) || selling <= 0) {
      setError("Enter a valid selling price (₹).");
      toast.error("Enter selling price before adding to inventory.");
      return;
    }
    if (!Number.isFinite(wholesale) || wholesale <= 0) {
      setError("Enter a valid wholesale price (₹).");
      toast.error("Enter wholesale price before adding to inventory.");
      return;
    }

    setStage("saving");
    setError("");
    try {
      const normalized: CoaExtraction = {
        ...extraction,
        manufacturingDate: {
          ...extraction.manufacturingDate,
          value: normalizeDateValue(extraction.manufacturingDate.value) || extraction.manufacturingDate.value,
        },
        expiryDate: {
          ...extraction.expiryDate,
          value: normalizeDateValue(extraction.expiryDate.value) || extraction.expiryDate.value,
        },
        analysisDate: {
          ...extraction.analysisDate,
          value: normalizeDateValue(extraction.analysisDate.value) || extraction.analysisDate.value,
        },
        dispatchDate: {
          ...extraction.dispatchDate,
          value: normalizeDateValue(extraction.dispatchDate.value) || extraction.dispatchDate.value,
        },
      };
      const res = await confirmCoaImport({
        data: {
          actorRole,
          actorName,
          companyId,
          fileName: file.name,
          mimeType: guessCoaMimeType(file),
          base64,
          extraction: normalized,
          unitPrice: selling,
          wholesalePrice: wholesale,
          ...(category.trim() ? { category: category.trim() } : {}),
          ...(productCode.trim() ? { productCode: productCode.trim() } : {}),
        },
      });
      if (!res.ok) {
        setError(res.error);
        setStage("pricing");
        toast.error(res.error);
        return;
      }
      toast.success(
        res.createdProduct
          ? `Created ${res.productName} and batch ${res.batchNumber} (+${res.quantity} ${res.unit}).`
          : `Matched ${res.productName}; added batch ${res.batchNumber} (+${res.quantity} ${res.unit}).`,
      );
      setOpen(false);
      reset();
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save COA import.";
      setError(message);
      setStage("pricing");
      toast.error(message);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="inventory-toolbar-btn h-8 gap-1.5 text-xs font-semibold"
        onClick={() => {
          reset();
          setCompanyId(defaultCompanyId === "all" ? "asian" : defaultCompanyId);
          setOpen(true);
        }}
      >
        <FileUp className="size-3.5" />
        <span className="inventory-btn-full">{label}</span>
        <span className="inventory-btn-short">{shortLabel}</span>
      </Button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto !max-w-[min(96vw,1100px)] sm:!max-w-[min(96vw,1100px)] md:!max-w-[min(96vw,1100px)] lg:!max-w-[min(96vw,1100px)] pb-16">
          <SheetHeader className="shrink-0 pr-8">
            <SheetTitle>Import Product from COA</SheetTitle>
            <SheetDescription>
              Upload a Certificate of Analysis (PDF/JPG/PNG). Review OCR results before adding stock.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                Company
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px]"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                COA document
                <input
                  className="w-full min-w-0 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png,.pdf,.jpg,.jpeg,.png"
                  capture="environment"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {(stage === "uploading" || stage === "processing") && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                <div>
                  <p className="font-semibold text-foreground">
                    {stage === "uploading"
                      ? "Uploading document…"
                      : "Running built-in OCR model…"}
                  </p>
                  <p className="text-muted-foreground">
                    Reading the COA on this device (no API key). Product, batch, and table fields…
                  </p>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            {warning && <p className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>}

            {stage === "ready" || stage === "pricing" || stage === "saving" ? (
              <div className="space-y-5">
                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.1fr)]">
                  <div className="min-w-0 rounded-xl border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">Original COA</p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                        >
                          <ZoomOut className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                        >
                          <ZoomIn className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[min(70vh,640px)] overflow-auto rounded-md border border-border bg-muted/20 p-2">
                      {previewUrl && file?.type.startsWith("image/") ? (
                        <img
                          src={previewUrl}
                          alt="COA preview"
                          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                          className="max-w-full"
                        />
                      ) : previewUrl ? (
                        <iframe
                          title="COA PDF preview"
                          src={previewUrl}
                          className="h-[560px] w-full rounded-md bg-background"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">No preview</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <FieldInput
                        label="Product name"
                        field={extraction.productName}
                        className="sm:col-span-2"
                        onChange={(v) => updateField("productName", v)}
                      />
                      <FieldInput
                        label="Product grade"
                        field={extraction.productGrade}
                        onChange={(v) => updateField("productGrade", v)}
                      />
                      <FieldInput
                        label="Batch number"
                        field={extraction.batchNumber}
                        onChange={(v) => updateField("batchNumber", v)}
                      />
                      <FieldInput
                        label="Manufacturer"
                        field={extraction.manufacturerName}
                        className="sm:col-span-2"
                        onChange={(v) => updateField("manufacturerName", v)}
                      />
                      <FieldInput
                        label="Supplier / customer"
                        field={extraction.supplierName}
                        className="sm:col-span-2"
                        onChange={(v) => updateField("supplierName", v)}
                      />
                      <FieldInput
                        label="Manufacturing date"
                        field={extraction.manufacturingDate}
                        kind="date"
                        onChange={(v) => updateField("manufacturingDate", v)}
                      />
                      <FieldInput
                        label="Expiry date"
                        field={extraction.expiryDate}
                        kind="date"
                        onChange={(v) => updateField("expiryDate", v)}
                      />
                      <FieldInput
                        label="Analysis date"
                        field={extraction.analysisDate}
                        kind="date"
                        onChange={(v) => updateField("analysisDate", v)}
                      />
                      <FieldInput
                        label="Dispatch date"
                        field={extraction.dispatchDate}
                        kind="date"
                        onChange={(v) => updateField("dispatchDate", v)}
                      />
                      <FieldInput
                        label="Batch quantity"
                        field={extraction.batchQuantity}
                        kind="number"
                        onChange={(v) => updateField("batchQuantity", v)}
                      />
                      <FieldInput
                        label="Dispatch / received qty"
                        field={extraction.dispatchQuantity}
                        kind="number"
                        onChange={(v) => updateField("dispatchQuantity", v)}
                      />
                      <FieldInput
                        label="Bags / packages"
                        field={extraction.packageCount}
                        kind="number"
                        onChange={(v) => updateField("packageCount", v)}
                      />
                      <FieldInput
                        label="Package weight"
                        field={extraction.packageWeight}
                        kind="number"
                        onChange={(v) => updateField("packageWeight", v)}
                      />
                      <FieldInput
                        label="Unit"
                        field={extraction.unit}
                        onChange={(v) => updateField("unit", v)}
                      />
                    </div>

                    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                      Product description
                      <textarea
                        className="w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-2 text-[13px]"
                        rows={2}
                        value={extraction.productDescription.value || ""}
                        onChange={(e) =>
                          updateField("productDescription", {
                            value: e.target.value || null,
                            confidence: 0.9,
                          })
                        }
                      />
                    </label>

                    <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                        Category
                        <input
                          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px]"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                        Product code (only if creating new product)
                        <input
                          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px]"
                          value={productCode}
                          onChange={(e) => setProductCode(e.target.value)}
                          placeholder="Auto-generated if blank"
                        />
                      </label>
                    </div>

                    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                      Stock to receive:{" "}
                      <strong>
                        {qtyPreview.quantity} {qtyPreview.unit}
                      </strong>
                      . Existing product names are matched; a new product is created only when needed.
                      Duplicate batch numbers are blocked.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold">Quality parameters</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        setExtraction((prev) => ({
                          ...prev,
                          qualityParameters: [
                            ...prev.qualityParameters,
                            {
                              parameterName: "",
                              specification: "",
                              resultValue: "",
                              complianceStatus: "",
                              remarks: "",
                              confidence: 0.9,
                            },
                          ],
                        }))
                      }
                    >
                      Add row
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Specification</th>
                          <th>Result</th>
                          <th>Compliance</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraction.qualityParameters.map((row, index) => (
                          <tr key={`q-${index}`}>
                            <td>
                              <input
                                className="w-full"
                                value={row.parameterName}
                                onChange={(e) =>
                                  updateQuality(index, { parameterName: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="w-full"
                                value={row.specification || ""}
                                onChange={(e) =>
                                  updateQuality(index, { specification: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="w-full"
                                value={row.resultValue || ""}
                                onChange={(e) =>
                                  updateQuality(index, { resultValue: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="w-full"
                                value={row.complianceStatus || ""}
                                onChange={(e) =>
                                  updateQuality(index, { complianceStatus: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="w-full"
                                value={row.remarks || ""}
                                onChange={(e) => updateQuality(index, { remarks: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                        {extraction.qualityParameters.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              No quality rows extracted. Add rows if needed.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {stage === "pricing" || stage === "saving" ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Set prices to add stock</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enter selling and wholesale price for{" "}
                        <strong>{extraction.productName.value || "this product"}</strong> before
                        saving to inventory.
                      </p>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                        Selling price (₹) *
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-[13px]"
                          type="number"
                          min="0.01"
                          step="any"
                          autoFocus
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          placeholder="e.g. 85"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium">
                        Wholesale price (₹) *
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-[13px]"
                          type="number"
                          min="0.01"
                          step="any"
                          value={wholesalePrice}
                          onChange={(e) => setWholesalePrice(e.target.value)}
                          placeholder="e.g. 78"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Stock to receive:{" "}
                      <strong>
                        {qtyPreview.quantity} {qtyPreview.unit}
                      </strong>
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs"
                    disabled={stage === "saving" || !file}
                    onClick={() => file && void runExtract(file)}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" />
                    Retry OCR
                  </Button>
                  {stage === "pricing" || stage === "saving" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 text-xs"
                        disabled={stage === "saving"}
                        onClick={() => {
                          setError("");
                          setStage("ready");
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        className="h-9 text-xs font-semibold"
                        disabled={stage === "saving"}
                        onClick={() => void handleConfirm()}
                      >
                        {stage === "saving" ? (
                          <>
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save to Inventory"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="h-9 text-xs font-semibold"
                      onClick={handleConfirmClick}
                    >
                      Confirm & Add to Inventory
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
