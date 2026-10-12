# IMPLEMENTATION PROMPT — ROLE 2: ACCOUNTS

> Standalone build brief for the Accounts (Accountant) role of the multi-company B2B food-ingredients ERP.

---

## 0. Context & Logins

- **Demo login**: `accounts@avighnya.local` / `accounts123` (or `accounts@avighna.com` / `Password@123`).
- Company header `X-Company-Id` on every call; multi-firm switcher in shell.
- **Order Flow Position**:

```
Owner approved → Supervisor vehicle (+ driver if required) → ACCOUNTS invoices
  → Supervisor/Sales book truck → Logistics POD → ACCOUNTS collects payment
```

_Manufacturer delivery: invoice after Owner approval without logistics vehicle._

---

## 1. Permissions (RBAC Codes)

### Grant Accounts:

- `dashboard.view`, `companies.view`
- `customers.view`, `customers.edit` (credit fields visibility)
- `products.view`, `sales.view`, `dispatch.view`
- `invoices.view`, `invoices.create`
- `payments.view`, `payments.create`
- `audit.view`

### Deny Accounts:

- `sales.create`, `dispatch.create/edit`, `inventory.edit`, `purchases.approve`, `users.*`, `quotations.approve`.

---

## 2. Navigation (Desktop Sidebar)

| Group        | Item              | Route                                          |
| :----------- | :---------------- | :--------------------------------------------- |
| **Accounts** | Dashboard         | `/`                                            |
| **Money**    | Invoices          | `/invoices`                                    |
| **Money**    | Receivables       | `/receivables`                                 |
| **Money**    | Payments received | `/payments`                                    |
| **Money**    | Customers         | `/clients` (or `/customers`)                   |
| **Money**    | More              | `/more` (`/credit`, `/reports`, `/collection`) |

---

## 3. Accounts Dashboard (`/`)

### KPIs / Checklist:

- Ready to invoice (count)
- Pending payments
- Overdue amount / count
- Credit alerts
- Today’s collection
- **Popup**: Invoice request notifications when Supervisor marks orders billable (`InvoiceRequestPopup`).

---

## 4. Screen: Invoices (`/invoices`)

### Top KPIs:

- Dispatch inbox count — “Loads Accounts can see”
- Ready to invoice — count of billable sales orders
- Invoiced — sum of document totals
- Awaiting payment — open/partial count

### Panel A — Ready to Invoice:

- Filters: Search customer / company / SO-#; Credit filter (All / Within limit / Exceeded).
- Table columns: `Company | Order | Customer | Delivery | Est. total | Credit | Action`.
- Action button: **Enter details** → opens invoice draft modal/page.
- Empty state: “No orders waiting to bill. Owner must confirm price, then Supervisor must confirm or add the vehicle.”

### Raise Invoice Form:

- Header: company name hero, customer, SO id, delivery mode summary.
- Fields: Invoice date (YES), Due date (YES), Credit days, Invoice number, Remarks, Locked product lines from SO with editable GST %.
- Running estimate = `sum(qty × price × (1 + gst/100))`.
- Credit badge: `Within limit` / `Limit exceeded`.
- Buttons: `Raise invoice` or `Raise anyway` (calls API with `override_credit=true`).

### Panel C — Issued Invoices:

- Filters: Search, Status (Unpaid / Partially paid / Paid / Overdue / Cancelled), Month, Overdue only checkbox.
- Actions: Preview (PDF modal), Download PDF, WhatsApp (`wa.me` message + mark sent).

---

## 5. Screen: Receivables (`/receivables`)

### KPIs & Register:

- Total outstanding, Overdue, Due soon (next 7 days), Cost of delay (interest penalty).
- Table: Invoice, customer, due date, outstanding, ageing bucket (Current, 1–30, 31–60, 61–90, 90+), actions: Receive / Detail.

### Receive Payment Modal:

- Partial / Full settlement toggle
- Amount received (YES)
- Quick chips: 25% / 50% / 75% of outstanding (partial only)
- Mode: `NEFT`, `UPI`, `Cheque`, `Cash`, `Adjustment`, `Bank transfer`
- Reference: UTR / cheque no. (YES)
- Paid on date (YES)

---

## 6. Screen: Payments Received (`/payments`)

- View register: Today amount, All receipts, search filters.
- Deep-links back to receivables for posting.

---

## 7. Credit Control (`/credit`) & Reports (`/reports`)

- Credit Control: limit, days, outstanding, overdue, headroom status, Debit/Credit notes.
- Reports tabs: Invoice register, Collections, Cost of delay, Export CSV/Excel.

---

## 8. Acceptance Checklist

- [x] Cannot allocate vehicles or edit stock.
- [x] Ready-to-invoice only shows eligible approved SOs.
- [x] Invoice PDF preview + download + WhatsApp work smoothly.
- [x] Partial payment leaves remaining outstanding.
- [x] Company isolation enforced across all lists.
- [x] Credit override explicitly audited.
