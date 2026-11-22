const STORAGE_KEY = "avighna.po.documents.v1";

export type PoDocRecord = {
  name: string;
  dataUrl: string;
  uploadedAt: string;
  /** Product / line item this supplier document belongs to */
  itemName?: string;
  /** Supplier tax invoice, company PO copy, etc. */
  documentType?: "supplier_invoice" | "purchase_order";
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

export function getPurchaseOrderDocument(poId: string) {
  return readAll()[poId] || null;
}

export function listPurchaseOrderDocumentIds() {
  return Object.keys(readAll());
}

export async function savePurchaseOrderDocument(
  poId: string,
  file: File,
  opts?: { itemName?: string; documentType?: PoDocRecord["documentType"] },
) {
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF purchase documents can be uploaded.");
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("Purchase document PDF must be under 6 MB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the PDF."));
    reader.readAsDataURL(file);
  });
  if (!dataUrl.startsWith("data:application/pdf")) {
    throw new Error("Invalid PDF file.");
  }
  const map = readAll();
  map[poId] = {
    name: file.name || `Supplier_Invoice_${poId}.pdf`,
    dataUrl,
    uploadedAt: new Date().toISOString(),
    itemName: opts?.itemName,
    documentType: opts?.documentType || "supplier_invoice",
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
