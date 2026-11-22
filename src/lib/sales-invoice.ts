import { companies } from "@/lib/workspace-data";
import type { DBCustomer, DBDelivery, DBInvoice, DBOrder } from "@/lib/erp-service";
import { parseOrderItemsSummary } from "@/lib/erp-service";

export function indianFiscalYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const start = month >= 3 ? year : year - 1;
  const a = String(start).slice(-2);
  const b = String(start + 1).slice(-2);
  return `${a}-${b}`;
}

/** Suggest accounts sales invoice no. like GI/S235/26-27 */
export function suggestSalesInvoiceNumber(companyId: string, orderId?: string) {
  const company = companies.find((c) => c.id === companyId);
  const prefix = company?.invPrefix || "INV/S";
  const digits = (orderId || "").replace(/\D/g, "").slice(-3) || "001";
  const serial = digits.padStart(3, "0");
  return `${prefix}${serial}/${indianFiscalYear()}`;
}

function inr(amount: number) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n] || "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`.trim();
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h && r) return `${ONES[h]} Hundred ${twoDigits(r)}`;
  if (h) return `${ONES[h]} Hundred`;
  return twoDigits(r);
}

/** Indian numbering: crore / lakh / thousand */
export function amountInWords(amount: number) {
  const abs = Math.abs(Number(amount) || 0);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  if (rupees === 0 && paise === 0) return "INR Zero Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = `INR ${parts.join(" ").replace(/\s+/g, " ").trim()}`;
  if (paise > 0) words += ` and ${twoDigits(paise)} paise`;
  return `${words} Only`;
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
 * Tally-style Tax Invoice layout matching Sales_GI_S235_26-27.pdf
 * (company header, buyer, dispatch meta, HSN lines, CGST/SGST, declaration).
 */
export function buildSalesInvoiceHtml(opts: {
  invoice: DBInvoice;
  order?: DBOrder | null;
  customer?: DBCustomer | null;
  delivery?: DBDelivery | null;
}) {
  const { invoice, order, customer, delivery } = opts;
  const company = companies.find((c) => c.id === invoice.company_id);
  const issueDate = formatDisplayDate(invoice.created_at);
  const creditDays = invoice.due_date
    ? Math.max(
        1,
        Math.round(
          (new Date(invoice.due_date).getTime() -
            new Date(invoice.created_at || Date.now()).getTime()) /
            86400000,
        ),
      )
    : 30;
  const dueLabel = `${creditDays} Days`;

  const line = parseOrderItemsSummary(order?.items_summary);
  const qty = line?.quantity || 1;
  const productName = line?.productName || order?.items_summary || "Commercial goods";
  const unitMatch = (order?.items_summary || "").match(
    /\b(kg|Kg|KG|MT|pcs|Pcs|litre|L|bag|Bags)\b/,
  );
  const unit = unitMatch?.[1] || "Kg";

  const grand = Number(invoice.amount) || 0;
  // Default intra-state 5% GST (2.5% CGST + 2.5% SGST) like the sample invoice.
  const taxableRaw = Number(order?.subtotal);
  const taxable =
    Number.isFinite(taxableRaw) && taxableRaw > 0 ? taxableRaw : grand / 1.05;
  const rate = qty > 0 ? taxable / qty : taxable;
  const taxTotalRaw = Number(order?.tax);
  const taxTotal =
    Number.isFinite(taxTotalRaw) && taxTotalRaw > 0 ? taxTotalRaw : grand - taxable;
  const cgst = taxTotal / 2;
  const sgst = taxTotal / 2;
  const roundedGrand = Math.round(grand * 100) / 100;
  const preRound = Math.round((taxable + taxTotal) * 100) / 100;
  const roundOff = Math.round((roundedGrand - preRound) * 100) / 100;

  const destination =
    order?.destination_city ||
    order?.delivery_address ||
    customer?.city ||
    customer?.address ||
    "As per buyer";
  const vehicle = delivery?.vehicle_number || order?.assigned_vehicle || "";
  const buyerGst = customer?.notes?.match(/GSTIN[:\s]*([0-9A-Z]{15})/i)?.[1] || "";
  const buyerPhone = customer?.phone || "";
  const buyerAddress =
    customer?.address || order?.delivery_address || "As per buyer records";
  const buyerOrderNo = order?.notes?.match(/PO[:\s#-]*([A-Z0-9/-]+)/i)?.[1] || order?.id || "";
  const qtyLabel = `${qty.toLocaleString("en-IN", {
    minimumFractionDigits: qty % 1 ? 3 : 0,
    maximumFractionDigits: 3,
  })} ${unit}`;

  const companyName = esc(company?.name || "Seller");
  const invNo = esc(String(invoice.id));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tax Invoice - ${invNo}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; font: 11px/1.35 Arial, Helvetica, sans-serif; background: #f4f4f4; }
    .bar { background:#111; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-size:12px; }
    .bar button { background:#166534; color:#fff; border:0; padding:8px 14px; font-weight:700; cursor:pointer; }
    .page { width: 210mm; max-width: 100%; margin: 12px auto; background:#fff; border:1px solid #222; }
    table { width:100%; border-collapse:collapse; }
    td, th { vertical-align: top; }
    .b { border:1px solid #222; }
    .bb { border-bottom:1px solid #222; }
    .br { border-right:1px solid #222; }
    .bt { border-top:1px solid #222; }
    .bl { border-left:1px solid #222; }
    .pad { padding:6px 8px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .muted { color:#333; }
    .tiny { font-size:10px; }
    .title { font-size:16px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; padding:8px; border-bottom:1px solid #222; }
    .co { font-size:14px; font-weight:800; text-transform:uppercase; }
    .label { font-size:10px; color:#333; }
    .val { font-weight:700; }
    .meta td { width:50%; }
    .meta .k { width:42%; font-size:10px; color:#333; padding:4px 6px; border-bottom:1px solid #ddd; }
    .meta .v { width:58%; font-weight:700; padding:4px 6px; border-bottom:1px solid #ddd; border-left:1px solid #ddd; }
    .items th { background:#f2f2f2; font-size:10px; text-transform:uppercase; padding:6px 5px; border:1px solid #222; }
    .items td { padding:6px 5px; border-left:1px solid #222; border-right:1px solid #222; border-bottom:1px solid #ddd; }
    .items tr.total td { border-top:1px solid #222; border-bottom:1px solid #222; font-weight:800; }
    .tax th, .tax td { border:1px solid #222; padding:5px 6px; font-size:10px; }
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
    <div><strong>Tax Invoice</strong> · ${invNo} · Accounts sales invoice · Driver / logistics copy</div>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page">
    <div class="title center">Tax Invoice</div>

    <table>
      <tr>
        <td class="br bb pad" style="width:52%;">
          <div class="tiny muted">e-Invoice</div>
          <div class="co">${companyName}</div>
          <div class="muted">${esc(company?.address || "")}</div>
          <div class="muted">${esc(company?.state || "Karnataka")}</div>
          <div class="muted">PAN No.${esc(company?.pan || "—")}</div>
          <div class="muted">Mob No: ${esc(company?.phone || "—")}</div>
          <div class="muted">GSTIN/UIN: ${esc(company?.gstin || "—")}</div>
          <div class="muted">State Name : ${esc(company?.state || "Karnataka")}, Code : ${esc(company?.stateCode || "29")}</div>
          <div class="muted">E-Mail : ${esc(company?.email || "—")}</div>
        </td>
        <td class="bb pad" style="width:48%; padding:0;">
          <table class="meta">
            <tr>
              <td class="k">Invoice No.</td>
              <td class="v">${invNo}</td>
            </tr>
            <tr>
              <td class="k">e-Way Bill No.</td>
              <td class="v">—</td>
            </tr>
            <tr>
              <td class="k">Dated</td>
              <td class="v">${esc(issueDate)}</td>
            </tr>
            <tr>
              <td class="k">Delivery Note</td>
              <td class="v"></td>
            </tr>
            <tr>
              <td class="k">Reference No. &amp; Date.</td>
              <td class="v">${invNo}<br/><span class="tiny">dt. ${esc(issueDate)}</span></td>
            </tr>
            <tr>
              <td class="k">Buyer's Order No.</td>
              <td class="v">${esc(buyerOrderNo)}</td>
            </tr>
            <tr>
              <td class="k">Dated</td>
              <td class="v">${esc(issueDate)}</td>
            </tr>
            <tr>
              <td class="k">Dispatch Doc No.</td>
              <td class="v"></td>
            </tr>
            <tr>
              <td class="k">Delivery Note Date</td>
              <td class="v"></td>
            </tr>
            <tr>
              <td class="k">Dispatched through</td>
              <td class="v">${esc(delivery?.driver_name || order?.assigned_driver || "")}</td>
            </tr>
            <tr>
              <td class="k">Destination</td>
              <td class="v">${esc(destination)}</td>
            </tr>
            <tr>
              <td class="k">Bill of Lading/LR-RR No.</td>
              <td class="v">${esc(delivery?.lr_number || "")}</td>
            </tr>
            <tr>
              <td class="k">Motor Vehicle No.</td>
              <td class="v">${esc(vehicle)}</td>
            </tr>
            <tr>
              <td class="k">Mode/Terms of Payment</td>
              <td class="v">${esc(dueLabel)}</td>
            </tr>
            <tr>
              <td class="k">Terms of Delivery</td>
              <td class="v">Door Delivery</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="br bb pad" colspan="1">
          <div class="label">Buyer (Bill to)</div>
          <div class="val" style="font-size:12px;margin-top:2px;">${esc(invoice.customer_name)}</div>
          <div class="muted">${esc(buyerAddress)}${buyerPhone ? `, Phone No.-${esc(buyerPhone)}` : ""}</div>
          <div class="muted">GSTIN/UIN : ${esc(buyerGst || "—")}</div>
          <div class="muted">State Name : ${esc(company?.state || "Karnataka")}, Code : ${esc(company?.stateCode || "29")}</div>
          <div class="muted">Place of Supply : ${esc(company?.state || "Karnataka")}</div>
        </td>
        <td class="bb pad">
          <div class="label">Other References</div>
          <div class="val" style="margin-top:4px;">Order ${esc(order?.id || invoice.order_id || "—")}</div>
          <div class="muted" style="margin-top:8px;">Sales invoice raised by Accounts for logistics delivery.</div>
        </td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:36px;">Sl<br/>No.</th>
          <th>Description of Goods</th>
          <th style="width:78px;">HSN/SAC</th>
          <th style="width:100px;" class="right">Quantity</th>
          <th style="width:72px;" class="right">Rate</th>
          <th style="width:40px;">per</th>
          <th style="width:100px;" class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center">1</td>
          <td>
            <div class="val">${esc(productName)}</div>
            <div class="tiny muted">Against Order ${esc(order?.id || invoice.order_id || "")}</div>
          </td>
          <td>11081200</td>
          <td class="right">${esc(qtyLabel)}</td>
          <td class="right">${inr(rate)}</td>
          <td>${esc(unit)}</td>
          <td class="right">${inr(taxable)}</td>
        </tr>
        <tr>
          <td></td>
          <td>OUTPUT CGST @ 2.5%</td>
          <td></td>
          <td></td>
          <td class="right">2.50</td>
          <td>%</td>
          <td class="right">${inr(cgst)}</td>
        </tr>
        <tr>
          <td></td>
          <td>Output SGST @ 2.5%</td>
          <td></td>
          <td></td>
          <td class="right">2.50</td>
          <td>%</td>
          <td class="right">${inr(sgst)}</td>
        </tr>
        ${
          Math.abs(roundOff) >= 0.005
            ? `<tr>
          <td></td>
          <td>Round Off</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td class="right">${inr(roundOff)}</td>
        </tr>`
            : ""
        }
        <tr class="total">
          <td></td>
          <td>Total</td>
          <td></td>
          <td class="right">${esc(qtyLabel)}</td>
          <td></td>
          <td></td>
          <td class="right">₹${inr(roundedGrand)}</td>
        </tr>
      </tbody>
    </table>

    <div class="pad bb">
      <div class="label">Amount Chargeable (in words) <span style="float:right;">E. &amp; O.E</span></div>
      <div class="val" style="margin-top:3px;">${esc(amountInWords(roundedGrand))}</div>
    </div>

    <table class="tax">
      <thead>
        <tr>
          <th>Taxable Value</th>
          <th>CGST Rate</th>
          <th>CGST Amount</th>
          <th>SGST/UTGST Rate</th>
          <th>SGST/UTGST Amount</th>
          <th>Total Tax Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr class="center">
          <td class="right">${inr(taxable)}</td>
          <td>2.50%</td>
          <td class="right">${inr(cgst)}</td>
          <td>2.50%</td>
          <td class="right">${inr(sgst)}</td>
          <td class="right">${inr(taxTotal)}</td>
        </tr>
        <tr>
          <td class="right val">Total: ${inr(taxable)}</td>
          <td></td>
          <td class="right val">${inr(cgst)}</td>
          <td></td>
          <td class="right val">${inr(sgst)}</td>
          <td class="right val">${inr(taxTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="pad bb">
      <div class="label">Tax Amount (in words) :</div>
      <div class="val" style="margin-top:3px;">${esc(amountInWords(taxTotal))}</div>
    </div>

    <table>
      <tr>
        <td class="br pad" style="width:58%;">
          <div class="label">Declaration</div>
          <div class="muted" style="margin-top:4px;">
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
          <div class="tiny muted" style="margin-top:18px;">Customer's Seal and Signature</div>
        </td>
        <td class="pad signbox" style="width:42%;">
          <div class="right muted">for ${companyName}</div>
          <div class="right val" style="margin-top:54px;">Authorised Signatory</div>
          <div class="right tiny muted">This is a Computer Generated Invoice</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
