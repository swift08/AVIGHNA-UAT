const STORAGE_KEY = "avighna.po.documents.v1";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type PoDocRecord = {
  name: string;
  dataUrl: string;
  uploadedAt: string;
  /** Product / line item this supplier document belongs to */
  itemName?: string;
  /** Supplier tax invoice, company PO copy, etc. */
  documentType?: "supplier_invoice" | "purchase_order";
  mimeType?: string;
  /** OCR / confirm fields from supplier invoice */
  invoiceNumber?: string;
  ewayBillNumber?: string;
  invoiceDate?: string;
  batchNumber?: string;
  invoiceAmount?: number;
};

export type PoInvoiceDocMeta = {
  itemName?: string;
  documentType?: PoDocRecord["documentType"];
  invoiceNumber?: string;
  ewayBillNumber?: string;
  invoiceDate?: string;
  batchNumber?: string;
  invoiceAmount?: number;
};

function readAll(): Record<string, PoDocRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PoDocRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PoDocRecord>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function guessMime(file: File): string {
  const raw = (file.type || "").toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (ALLOWED_MIME.has(raw)) return raw;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return raw;
}

export function getPurchaseOrderDocument(poId: string) {
  return readAll()[poId] || null;
}

export function listPurchaseOrderDocumentIds() {
  return Object.keys(readAll());
}

/** Guess supplier invoice no. from common Tally export names like Purchase_MH0026113992.pdf */
export function invoiceNumberFromFileName(name?: string | null): string | null {
  if (!name) return null;
  const base = name.replace(/\.[^.]+$/, "");
  const m =
    base.match(/Purchase[_\-\s]?([A-Za-z0-9][A-Za-z0-9/.\-]{4,30})$/i) ||
    base.match(/\b([A-Z]{2,6}\d{6,}|[A-Z]{2,6}\/\d{2}-\d{2}\/\d+)\b/);
  return m?.[1]?.trim() || null;
}

/** Logistics / supervisor: save supplier invoice file + OCR confirm fields. */
export async function savePurchaseOrderDocument(
  poId: string,
  file: File,
  opts?: PoInvoiceDocMeta,
) {
  const mime = guessMime(file);
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Upload a supplier invoice as PDF, JPG, PNG, or WebP.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Supplier invoice must be under 8 MB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
  const okPrefix =
    mime === "application/pdf"
      ? "data:application/pdf"
      : mime.startsWith("image/")
        ? `data:${mime === "image/jpg" ? "image/jpeg" : mime}`
        : "";
  if (!okPrefix || !dataUrl.startsWith("data:")) {
    throw new Error("Invalid invoice file.");
  }
  if (mime === "application/pdf" && !dataUrl.startsWith("data:application/pdf")) {
    throw new Error("Invalid PDF file.");
  }

  const map = readAll();
  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime.includes("png")
        ? "png"
        : mime.includes("webp")
          ? "webp"
          : "jpg";
  const fileName = file.name || `Supplier_Invoice_${poId}.${ext}`;
  const prev = map[poId];
  map[poId] = {
    name: fileName,
    dataUrl,
    uploadedAt: new Date().toISOString(),
    itemName: opts?.itemName ?? prev?.itemName,
    documentType: opts?.documentType || prev?.documentType || "supplier_invoice",
    mimeType: mime,
    invoiceNumber:
      opts?.invoiceNumber?.trim() ||
      prev?.invoiceNumber ||
      invoiceNumberFromFileName(fileName) ||
      undefined,
    ewayBillNumber: opts?.ewayBillNumber?.trim() || prev?.ewayBillNumber,
    invoiceDate: opts?.invoiceDate?.trim() || prev?.invoiceDate,
    batchNumber: opts?.batchNumber?.trim() || prev?.batchNumber,
    invoiceAmount:
      opts?.invoiceAmount !== undefined && Number.isFinite(opts.invoiceAmount)
        ? opts.invoiceAmount
        : prev?.invoiceAmount,
  };
  writeAll(map);
  return map[poId];
}

/** Update OCR fields on an already-saved PO document (no re-upload). */
export function patchPurchaseOrderDocumentMeta(poId: string, meta: PoInvoiceDocMeta) {
  const map = readAll();
  const prev = map[poId];
  if (!prev) return null;
  map[poId] = {
    ...prev,
    ...(meta.itemName !== undefined ? { itemName: meta.itemName } : {}),
    ...(meta.documentType ? { documentType: meta.documentType } : {}),
    ...(meta.invoiceNumber?.trim()
      ? { invoiceNumber: meta.invoiceNumber.trim() }
      : {}),
    ...(meta.ewayBillNumber?.trim()
      ? { ewayBillNumber: meta.ewayBillNumber.trim() }
      : {}),
    ...(meta.invoiceDate?.trim() ? { invoiceDate: meta.invoiceDate.trim() } : {}),
    ...(meta.batchNumber?.trim() ? { batchNumber: meta.batchNumber.trim() } : {}),
    ...(meta.invoiceAmount !== undefined && Number.isFinite(meta.invoiceAmount)
      ? { invoiceAmount: meta.invoiceAmount }
      : {}),
  };
  writeAll(map);
  return map[poId];
}

export function openPurchaseOrderDocument(poId: string) {
  const doc = getPurchaseOrderDocument(poId);
  if (!doc) return false;
  const win = window.open(doc.dataUrl, "_blank");
  return Boolean(win);
}
