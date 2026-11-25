import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  parseQuantityNumber,
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
  DOCUMENT_CATEGORIES,
  uploadDocument,
  type DocumentCategory,
  type DocumentRecord,
} from "@/lib/documents-service";
import { patchPurchaseOrderDocumentMeta } from "@/lib/po-documents";
import {
  fetchPurchaseOrders,
  markPurchaseOrderSent,
  poRemainingQuantity,
  receivePurchaseGoods,
  type DBPurchaseOrder,
} from "@/lib/erp-service";
import type { RoleType } from "@/lib/auth-service";
import { companies, type CompanyId } from "@/lib/workspace-data";

type Stage = "processing" | "review" | "saving" | "done";

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

function formatExtractedNotes(
  category: DocumentCategory,
  extraction: CoaExtraction,
  receiveQty: string,
  userNotes: string,
): string {
  const parts = [
    userNotes.trim(),
    `[extracted] category=${category}`,
    extraction.invoiceNumber.value ? `Invoice No. ${extraction.invoiceNumber.value}` : "",
    extraction.ewayBillNumber.value ? `e-Way ${extraction.ewayBillNumber.value}` : "",
    extraction.invoiceDate.value ? `Invoice date ${extraction.invoiceDate.value}` : "",
    extraction.invoiceAmount.value
      ? `Amount ₹${parseQuantityNumber(extraction.invoiceAmount.value) || extraction.invoiceAmount.value}`
      : "",
    extraction.supplierName.value
      ? category === "sales_invoice"
        ? `Customer ${extraction.supplierName.value}`
        : `Supplier ${extraction.supplierName.value}`
      : "",
    extraction.productName.value ? `Product ${extraction.productName.value}` : "",
    extraction.batchNumber.value ? `Batch ${extraction.batchNumber.value}` : "",
    receiveQty ? `Qty ${receiveQty}${extraction.unit.value ? ` ${extraction.unit.value}` : ""}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function DocumentExtractReviewSheet({
  open,
  onOpenChange,
  file,
  category,
  title,
  companyId,
  notes,
  actorRole,
  actorName,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  category: DocumentCategory;
  title: string;
  companyId: CompanyId;
  notes: string;
  actorRole: RoleType | undefined;
  actorName: string;
  onCompleted: (doc: DocumentRecord) => void;
}) {
  const [stage, setStage] = useState<Stage>("processing");
  const [extraction, setExtraction] = useState<CoaExtraction>(emptyCoaExtraction());
  const [reviewTitle, setReviewTitle] = useState(title);
  const [reviewNotes, setReviewNotes] = useState(notes);
  const [receiveQty, setReceiveQty] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pos, setPos] = useState<DBPurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [savedDoc, setSavedDoc] = useState<DocumentRecord | null>(null);
  const [receiveSummary, setReceiveSummary] = useState<string | null>(null);

  const categoryMeta = DOCUMENT_CATEGORIES.find((c) => c.id === category);
  const needsPoReceive = category === "purchase_invoice";
  const qtyPreview = useMemo(() => resolvedReceiveQuantity(extraction), [extraction]);

  const receivablePos = useMemo(() => {
    return pos.filter((p) => {
      if (companyId !== "all" && p.company_id !== companyId) return false;
      if (!p.product_id) return false;
      if (p.status !== "In transit" && p.status !== "Requested") return false;
      return poRemainingQuantity(p) > 0;
    });
  }, [pos, companyId]);

  const selectedPo = receivablePos.find((p) => p.id === selectedPoId) || null;
  const remaining = selectedPo ? poRemainingQuantity(selectedPo) : 0;

  const updateField = (key: keyof CoaExtraction, next: CoaField) => {
    setExtraction((prev) => ({ ...prev, [key]: next }));
  };

  const reset = () => {
    setStage("processing");
    setExtraction(emptyCoaExtraction());
    setReviewTitle(title);
    setReviewNotes(notes);
    setReceiveQty("");
    setWarning(null);
    setError("");
    setPos([]);
    setSelectedPoId("");
    setSavedDoc(null);
    setReceiveSummary(null);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open || !file || !actorRole) return;
    let cancelled = false;

    const run = async () => {
      setStage("processing");
      setError("");
      setWarning(null);
      setReviewTitle(title);
      setReviewNotes(notes);
      setSavedDoc(null);
      setReceiveSummary(null);

      try {
        const encoded = await fileToBase64(file);
        const mimeType = guessCoaMimeType(file);
        let ocrText = "";
        let browserExtraction: CoaExtraction | null = null;
        let browserError: string | undefined;

        if (isCoaImageFile(file)) {
          const browser = await extractCoaInBrowser(file);
          if (cancelled) return;
          ocrText = browser.text;
          browserError = browser.error;
          if (browser.engine === "browser") browserExtraction = browser.extraction;
        }

        let next = browserExtraction;
        if (!next) {
          const res = await extractCoaDocument({
            data: {
              actorRole,
              fileName: file.name,
              mimeType,
              base64: encoded,
              companyId: companyId === "all" ? "asian" : companyId,
              ...(ocrText.trim() ? { ocrText } : {}),
            },
          });
          if (cancelled) return;
          if (res.ok) {
            next = res.extraction;
            setWarning(res.warning || null);
          } else {
            setWarning(
              browserError ||
                res.error ||
                "Could not auto-read this file. Enter the details manually, then confirm.",
            );
            next = emptyCoaExtraction();
          }
        }

        const extractionNext = next || emptyCoaExtraction();
        if (!extractionNext.productName.value?.trim() && title.trim()) {
          extractionNext.productName = { value: title.trim(), confidence: 0.5 };
        }
        setExtraction(extractionNext);

        const resolved = resolvedReceiveQuantity(extractionNext);
        if (resolved.quantity > 0) setReceiveQty(String(resolved.quantity));
        else setReceiveQty("");

        if (needsPoReceive) {
          const list = await fetchPurchaseOrders(companyId === "all" ? "asian" : companyId);
          if (cancelled) return;
          setPos(list);
          const match = list.find((p) => {
            if (poRemainingQuantity(p) <= 0) return false;
            if (p.status !== "In transit" && p.status !== "Requested") return false;
            const supplier = (extractionNext.supplierName.value || "").toLowerCase();
            const product = (extractionNext.productName.value || "").toLowerCase();
            const supplierHit =
              !supplier || p.supplier_name.toLowerCase().includes(supplier) || supplier.includes(p.supplier_name.toLowerCase());
            const productHit =
              !product || p.product_name.toLowerCase().includes(product) || product.includes(p.product_name.toLowerCase());
            return supplierHit && productHit;
          });
          if (match) {
            setSelectedPoId(match.id);
            const rem = poRemainingQuantity(match);
            const qty =
              resolved.quantity > 0 ? Math.min(resolved.quantity, rem) : rem;
            setReceiveQty(String(qty || ""));
          }
        }

        setStage("review");
        toast.message("Review extracted details — confirm if correct.");
      } catch (err) {
        if (cancelled) return;
        setWarning(err instanceof Error ? err.message : "Could not read document.");
        setExtraction(emptyCoaExtraction());
        setStage("review");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, file, actorRole, category, companyId, title, notes, needsPoReceive]);

  const handleConfirm = async () => {
    if (!file || !actorRole) return;
    if (!reviewTitle.trim()) {
      setError("Enter a document title.");
      toast.error("Enter a document title.");
      return;
    }
    if (needsPoReceive) {
      if (!selectedPo) {
        setError("Select a purchase order to receive stock against.");
        toast.error("Select a purchase order for stock receive.");
        return;
      }
      const qty = Number(receiveQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Enter the quantity that arrived.");
        toast.error("Enter a valid receive quantity.");
        return;
      }
      if (qty > remaining + 1e-9) {
        setError(`Only ${remaining} ${selectedPo.unit} remaining on this PO.`);
        toast.error(`Cannot receive more than remaining (${remaining} ${selectedPo.unit}).`);
        return;
      }
      if (!selectedPo.product_id) {
        setError("Selected PO is not linked to a catalog product.");
        toast.error("Ask Accounts to recreate the PO with a product selected.");
        return;
      }
    }

    setStage("saving");
    setError("");
    try {
      const notesPayload = formatExtractedNotes(
        category,
        extraction,
        receiveQty,
        reviewNotes,
      );
      const doc = await uploadDocument({
        file,
        title: reviewTitle.trim(),
        category,
        companyId,
        notes: notesPayload,
        uploadedBy: actorName,
        uploadedByRole: actorRole,
      });

      let receiveMsg: string | null = null;
      if (needsPoReceive && selectedPo) {
        const qty = Number(receiveQty);
        const invoiceNo = extraction.invoiceNumber.value?.trim() || "";
        const ewayNo = extraction.ewayBillNumber.value?.trim() || "";
        const amountNum = parseQuantityNumber(extraction.invoiceAmount.value);
        const batchNumber =
          extraction.batchNumber.value?.trim() ||
          invoiceNo ||
          `INV-${selectedPo.id}-${Date.now().toString().slice(-4)}`;
        const mfg = normalizeDateValue(extraction.manufacturingDate.value);
        const exp = normalizeDateValue(extraction.expiryDate.value);

        const invDate = extraction.invoiceDate.value?.trim() || "";
        patchPurchaseOrderDocumentMeta(selectedPo.id, {
          itemName: selectedPo.product_name,
          documentType: "supplier_invoice",
          batchNumber,
          ...(invoiceNo ? { invoiceNumber: invoiceNo } : {}),
          ...(ewayNo ? { ewayBillNumber: ewayNo } : {}),
          ...(invDate ? { invoiceDate: invDate } : {}),
          ...(amountNum > 0 ? { invoiceAmount: amountNum } : {}),
        });

        let poForReceive = selectedPo;
        if (selectedPo.status === "Requested") {
          poForReceive = await markPurchaseOrderSent(
            selectedPo.id,
            selectedPo.company_id,
            actorName,
          );
        }

        const manufacturerName = extraction.manufacturerName.value?.trim() || "";
        const result = await receivePurchaseGoods(
          poForReceive.id,
          poForReceive.company_id,
          actorName,
          {
            productId: poForReceive.product_id ?? null,
            receiveQty: qty,
            allowAnyStatus: actorRole === "super_admin",
            batchNumber,
            mfgDate: mfg,
            expiryDate: exp,
            notes: [
              `Document: ${doc.title}`,
              extraction.productName.value
                ? `OCR product: ${extraction.productName.value}`
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
            ...(manufacturerName ? { manufacturerName } : {}),
            ...(invoiceNo ? { invoiceNumber: invoiceNo } : {}),
            ...(ewayNo ? { ewayBillNumber: ewayNo } : {}),
            ...(invDate ? { invoiceDate: invDate } : {}),
            ...(amountNum > 0 ? { invoiceAmount: amountNum } : {}),
          },
        );
        receiveMsg = `Received ${result.receivedThisTime} ${selectedPo.unit} on PO #${selectedPo.id} (${result.remaining} remaining). Record supplier payment on Accounts → Payables.`;
      }

      setSavedDoc(doc);
      setReceiveSummary(receiveMsg);
      setStage("done");
      toast.success("Document saved", {
        description:
          receiveMsg ||
          `"${doc.title}" stored. Record payments later on Accounts.`,
      });
      onCompleted(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save document.";
      setError(message);
      setStage("review");
      toast.error(message);
    }
  };

  const showPurchaseFields =
    category === "purchase_invoice" || category === "purchase_order" || category === "coa";
  const showSalesFields = category === "sales_invoice";

  return (
    <Sheet open={open && !!file} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col overflow-y-auto !max-w-[min(96vw,720px)] sm:!max-w-[min(96vw,720px)] pb-16">
        <SheetHeader className="shrink-0 pr-8">
          <SheetTitle>
            {stage === "done"
              ? "Saved"
              : stage === "processing"
                ? "Reading document…"
                : "Are these details correct?"}
          </SheetTitle>
          <SheetDescription>
            {stage === "done"
              ? "Document filed in the vault. Payments are recorded on Accounts."
              : `${categoryMeta?.label || category} · Confirm fields before saving${
                  needsPoReceive ? ". Purchase invoices also receive stock against a PO." : ""
                }`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4 pb-10">
          {stage === "processing" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Reading the full document…
            </p>
          )}

          {(stage === "review" || stage === "saving") && (
            <>
              {warning && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                  {warning}
                </p>
              )}

              <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                Title
                <input
                  className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                />
              </label>

              <p className="text-[11px] text-muted-foreground">
                Company:{" "}
                <strong className="text-foreground">
                  {companyId === "all"
                    ? "All Companies"
                    : companies.find((c) => c.id === companyId)?.name || companyId}
                </strong>
                {" · "}
                File: <strong className="text-foreground">{file?.name}</strong>
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {(showPurchaseFields || showSalesFields) && (
                  <FieldInput
                    label={showSalesFields ? "Customer / party" : "Supplier / party"}
                    field={extraction.supplierName}
                    onChange={(n) => updateField("supplierName", n)}
                  />
                )}
                {(showPurchaseFields || showSalesFields) && (
                  <FieldInput
                    label="Invoice No."
                    field={extraction.invoiceNumber}
                    onChange={(n) => updateField("invoiceNumber", n)}
                  />
                )}
                {showPurchaseFields && (
                  <FieldInput
                    label="e-Way Bill No."
                    field={extraction.ewayBillNumber}
                    onChange={(n) => updateField("ewayBillNumber", n)}
                  />
                )}
                {(showPurchaseFields || showSalesFields) && (
                  <FieldInput
                    label="Invoice date"
                    field={extraction.invoiceDate}
                    kind="date"
                    onChange={(n) => updateField("invoiceDate", n)}
                  />
                )}
                {(showPurchaseFields || showSalesFields) && (
                  <FieldInput
                    label="Invoice amount (₹)"
                    field={extraction.invoiceAmount}
                    kind="number"
                    onChange={(n) => updateField("invoiceAmount", n)}
                  />
                )}
                {showPurchaseFields && (
                  <>
                    <FieldInput
                      label="Product name"
                      field={extraction.productName}
                      onChange={(n) => updateField("productName", n)}
                    />
                    <FieldInput
                      label="Batch / lot"
                      field={extraction.batchNumber}
                      onChange={(n) => updateField("batchNumber", n)}
                    />
                    <FieldInput
                      label="Manufacturer"
                      field={extraction.manufacturerName}
                      onChange={(n) => updateField("manufacturerName", n)}
                    />
                    <FieldInput
                      label="Unit"
                      field={extraction.unit}
                      onChange={(n) => updateField("unit", n)}
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
                  </>
                )}
              </div>

              {needsPoReceive && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <p className="text-[12px] font-bold text-primary">Receive stock against PO</p>
                  <p className="text-[11px] text-muted-foreground">
                    Suggested qty from document:{" "}
                    <strong className="text-foreground">
                      {qtyPreview.quantity || "—"} {qtyPreview.unit || ""}
                    </strong>
                    . Payments are recorded later on Accounts → Payables.
                  </p>
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                    Purchase order
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px]"
                      value={selectedPoId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedPoId(id);
                        const po = receivablePos.find((p) => p.id === id);
                        if (po) {
                          const rem = poRemainingQuantity(po);
                          const suggested =
                            qtyPreview.quantity > 0
                              ? Math.min(qtyPreview.quantity, rem)
                              : rem;
                          setReceiveQty(String(suggested || ""));
                        }
                      }}
                    >
                      <option value="">Select PO…</option>
                      {receivablePos.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.id} · {p.product_name} · {p.supplier_name} · rem{" "}
                          {poRemainingQuantity(p)} {p.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  {receivablePos.length === 0 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      No open In-transit POs with remaining qty for this company. Mark a PO as sent
                      on Purchases first, or save the document without receiving (change category).
                    </p>
                  )}
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                    Quantity arrived {selectedPo ? `(${selectedPo.unit})` : ""}
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      max={remaining || undefined}
                      className="h-11 rounded-md border border-border bg-background px-3 text-[15px] font-semibold"
                      value={receiveQty}
                      onChange={(e) => setReceiveQty(e.target.value)}
                    />
                    {selectedPo && (
                      <span className="text-[10px] text-muted-foreground">
                        Max remaining on PO: {remaining} {selectedPo.unit}
                      </span>
                    )}
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1.5 text-[12px] font-medium">
                Notes (optional)
                <input
                  className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Batch no., PO/Invoice ref, or remarks"
                />
              </label>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={stage === "saving"}
                  onClick={() => close(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 text-xs"
                  disabled={stage === "saving"}
                  onClick={() => void handleConfirm()}
                >
                  {stage === "saving" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Saving…
                    </>
                  ) : needsPoReceive ? (
                    "Yes, save & receive stock"
                  ) : (
                    "Yes, details are correct — save"
                  )}
                </Button>
              </div>
            </>
          )}

          {stage === "done" && savedDoc && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                Saved “{savedDoc.title}” under {categoryMeta?.shortLabel}.
              </p>
              {receiveSummary && (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                  {receiveSummary}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-9 text-xs" onClick={() => close(false)}>
                  Done
                </Button>
                <Button type="button" variant="outline" className="h-9 text-xs" asChild>
                  <Link to="/accounts">Open Accounts</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
