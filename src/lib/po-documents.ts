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

/** Logistics: upload supplier invoice photo/PDF only — no OCR review. */
export async function savePurchaseOrderDocument(
  poId: string,
  file: File,
  opts?: { itemName?: string; documentType?: PoDocRecord["documentType"] },
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
  map[poId] = {
    name: file.name || `Supplier_Invoice_${poId}.${ext}`,
    dataUrl,
    uploadedAt: new Date().toISOString(),
    itemName: opts?.itemName,
    documentType: opts?.documentType || "supplier_invoice",
    mimeType: mime,
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
