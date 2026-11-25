import { companies } from "@/lib/workspace-data";
import { amountInWords, indianFiscalYear } from "@/lib/sales-invoice";
import type { DBPurchaseOrder } from "@/lib/erp-service";

export type PoDocumentMeta = {
  remark?: string;
  documentName?: string;
  documentKey?: string;
  /** Supplier tax invoice uploaded by Accounts for this item */
  documentType?: "supplier_invoice" | "purchase_order";
  itemName?: string;
  invoiceNumber?: string;
  ewayBillNumber?: string;
  invoiceDate?: string;
  batchNumber?: string;
  invoiceAmount?: number;
};

/** Suggest PO reference like GI/PO/55/26-27 */
export function suggestPurchaseOrderNumber(companyId: string, serialHint?: string) {
  const company = companies.find((c) => c.id === companyId);
  const code = (company?.invPrefix || "INV/S").split("/")[0] || "INV";
  const digits = (serialHint || "").replace(/\D/g, "").slice(-2) || String(Date.now()).slice(-2);
  const serial = digits.padStart(2, "0");
  return `${code}/PO/${serial}/${indianFiscalYear()}`;
}

export function parsePoNotes(notes?: string | null): PoDocumentMeta & { text: string } {
  if (!notes?.trim()) return { text: "" };
  try {
    const parsed = JSON.parse(notes) as PoDocumentMeta & { text?: string };
    if (parsed && typeof parsed === "object") {
      return {
        text: String(parsed.text || parsed.remark || ""),
        remark: parsed.remark,
        documentName: parsed.documentName,
        documentKey: parsed.documentKey,
        documentType: parsed.documentType,
        itemName: parsed.itemName,
        invoiceNumber: parsed.invoiceNumber,
        ewayBillNumber: parsed.ewayBillNumber,
        invoiceDate: parsed.invoiceDate,
        batchNumber: parsed.batchNumber,
        invoiceAmount:
          parsed.invoiceAmount !== undefined ? Number(parsed.invoiceAmount) : undefined,
      };
    }
  } catch {
    // plain text notes
  }
  const docMatch = notes.match(/^\[DOC\]\s*(.+)$/m);
  const invoiceFromText = notes.match(/Invoice\s*No\.?\s*([A-Za-z0-9/.\-]{4,30})/i)?.[1];
  const ewayFromText = notes.match(/e-?Way\s*Bill\s*([0-9]{10,15})/i)?.[1];
  const batchFromText = notes.match(/\bbatch\s+([A-Za-z0-9/.\-_]+)/i)?.[1];
  return {
    text: notes.replace(/^\[DOC\]\s*.+$/m, "").trim(),
    documentName: docMatch?.[1]?.trim(),
    invoiceNumber: invoiceFromText?.trim(),
    ewayBillNumber: ewayFromText?.trim(),
    batchNumber: batchFromText?.trim(),
  };
}

export function encodePoNotes(meta: PoDocumentMeta & { text?: string }) {
  return JSON.stringify({
    text: meta.text || meta.remark || "",
    remark: meta.remark || meta.text || "",
    documentName: meta.documentName || undefined,
    documentKey: meta.documentKey || undefined,
    documentType: meta.documentType || undefined,
    itemName: meta.itemName || undefined,
    invoiceNumber: meta.invoiceNumber || undefined,
    ewayBillNumber: meta.ewayBillNumber || undefined,
    invoiceDate: meta.invoiceDate || undefined,
    batchNumber: meta.batchNumber || undefined,
    invoiceAmount:
      meta.invoiceAmount !== undefined && Number.isFinite(meta.invoiceAmount)
        ? meta.invoiceAmount
        : undefined,
  });
}

function inr(amount: number) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(iso?: string | null) {
  if (!iso) {
    return new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  }
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tally-style Purchase Order layout matching Purchase Order_55.pdf
 * (Invoice To company, Supplier bill-from, voucher/reference, goods lines).
 */
export function buildPurchaseOrderHtml(po: DBPurchaseOrder) {
  const company = companies.find((c) => c.id === po.company_id);
  const meta = parsePoNotes(po.notes);
  const dated = formatDisplayDate(po.created_at || po.eta);
  const qtyLabel = `${Number(po.quantity).toLocaleString("en-IN", {
    minimumFractionDigits: Number(po.quantity) % 1 ? 3 : 0,
    maximumFractionDigits: 3,
  })} ${po.unit}`;
  const amount = Number(po.total_amount || po.total_price || po.quantity * po.unit_price);
  const voucherNo = String(po.id).replace(/^PO-/i, "") || po.id;
  const reference =
    meta.documentName?.replace(/\.pdf$/i, "") ||
    suggestPurchaseOrderNumber(po.company_id, voucherNo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Purchase Order - ${esc(String(po.id))}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; font: 11px/1.35 Arial, Helvetica, sans-serif; background: #f4f4f4; }
    .bar { background:#111; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-size:12px; }
    .bar button { background:#166534; color:#fff; border:0; padding:8px 14px; font-weight:700; cursor:pointer; }
    .page { width: 210mm; max-width: 100%; margin: 12px auto; background:#fff; border:1px solid #222; }
    table { width:100%; border-collapse:collapse; }
    td, th { vertical-align: top; }
    .br { border-right:1px solid #222; }
    .bb { border-bottom:1px solid #222; }
    .pad { padding:6px 8px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .muted { color:#333; }
    .tiny { font-size:10px; }
    .title { font-size:16px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; padding:8px; border-bottom:1px solid #222; }
    .co { font-size:14px; font-weight:800; text-transform:uppercase; }
    .label { font-size:10px; color:#333; }
    .val { font-weight:700; }
    .meta .k { width:42%; font-size:10px; color:#333; padding:4px 6px; border-bottom:1px solid #ddd; }
    .meta .v { width:58%; font-weight:700; padding:4px 6px; border-bottom:1px solid #ddd; border-left:1px solid #ddd; }
    .items th { background:#f2f2f2; font-size:10px; text-transform:uppercase; padding:6px 5px; border:1px solid #222; }
    .items td { padding:6px 5px; border-left:1px solid #222; border-right:1px solid #222; border-bottom:1px solid #ddd; }
    .items tr.total td { border-top:1px solid #222; border-bottom:1px solid #222; font-weight:800; }
    .signbox { min-height:78px; }
    @media print {
      body { background:#fff; }
      .bar { display:none !important; }
      .page { margin:0; width:auto; border:1px solid #222; }
    }
  </style>
</head>
<body>
  <div class="bar">
    <div><strong>Purchase Order</strong> · ${esc(String(po.id))} · Accounts upload · Visible to logistics</div>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page">
    <div class="title center">Purchase Order</div>

    <table>
      <tr>
        <td class="br bb pad" style="width:52%;">
          <div class="label">Invoice To</div>
          <div class="co">${esc(company?.name || "Buyer")}</div>
          <div class="muted">${esc(company?.address || "")}</div>
          <div class="muted">${esc(company?.state || "Karnataka")}</div>
          <div class="muted">PAN No.${esc(company?.pan || "—")}</div>
          <div class="muted">Mob No: ${esc(company?.phone || "—")}</div>
          <div class="muted">GSTIN/UIN: ${esc(company?.gstin || "—")}</div>
          <div class="muted">State Name : ${esc(company?.state || "Karnataka")}, Code : ${esc(company?.stateCode || "29")}</div>
          <div class="muted">E-Mail : ${esc(company?.email || "—")}</div>
        </td>
        <td class="bb pad" style="width:48%; padding:0;">
          <table class="meta" style="width:100%;">
            <tr><td class="k">Voucher No.</td><td class="v">${esc(voucherNo)}</td></tr>
            <tr><td class="k">Reference No. &amp; Date.</td><td class="v">${esc(reference)}<br/><span class="tiny">dt. ${esc(dated)}</span></td></tr>
            <tr><td class="k">Dated</td><td class="v">${esc(dated)}</td></tr>
            <tr><td class="k">Mode/Terms of Payment</td><td class="v">30 Days</td></tr>
            <tr><td class="k">Other References</td><td class="v">${esc(meta.remark || meta.text || "")}</td></tr>
            <tr><td class="k">Dispatched through</td><td class="v"></td></tr>
            <tr><td class="k">Destination</td><td class="v">${esc(po.warehouse || company?.state || "Bangalore")}</td></tr>
            <tr><td class="k">Terms of Delivery</td><td class="v"></td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="br bb pad" colspan="2">
          <div class="label">Supplier (Bill from)</div>
          <div class="val" style="font-size:12px;margin-top:2px;">${esc(po.supplier_name)}</div>
          <div class="muted">GSTIN/UIN : —</div>
          <div class="muted">State Name : ${esc(company?.state || "Karnataka")}, Code : ${esc(company?.stateCode || "29")}</div>
        </td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:36px;">Sl<br/>No.</th>
          <th>Description of Goods</th>
          <th style="width:78px;">HSN/SAC</th>
          <th style="width:88px;">Due on</th>
          <th style="width:100px;" class="right">Quantity</th>
          <th style="width:72px;" class="right">Rate</th>
          <th style="width:40px;">per</th>
          <th style="width:100px;" class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center">1</td>
          <td><div class="val">${esc(po.product_name)}</div></td>
          <td>17023020</td>
          <td>${esc(formatDisplayDate(po.eta || po.created_at))}</td>
          <td class="right">${esc(qtyLabel)}</td>
          <td class="right">${inr(po.unit_price)}</td>
          <td>${esc(po.unit || "Kg")}</td>
          <td class="right">${inr(amount)}</td>
        </tr>
        <tr class="total">
          <td></td>
          <td>Total</td>
          <td></td>
          <td></td>
          <td class="right">${esc(qtyLabel)}</td>
          <td></td>
          <td></td>
          <td class="right">₹${inr(amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="pad bb">
      <div class="label">Amount Chargeable (in words) <span style="float:right;">E. &amp; O.E</span></div>
      <div class="val" style="margin-top:3px;">${esc(amountInWords(amount))}</div>
      <div class="label" style="margin-top:10px;">Remarks:</div>
      <div class="muted">${esc(meta.remark || meta.text || "GST Extra")}</div>
    </div>

    <table>
      <tr>
        <td class="pad signbox" style="width:100%;">
          <div class="right muted">for ${esc(company?.name || "Company")}</div>
          <div class="right val" style="margin-top:54px;">Authorised Signatory</div>
          <div class="right tiny muted">This is a Computer Generated Document</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
