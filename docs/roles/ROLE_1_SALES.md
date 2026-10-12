# IMPLEMENTATION PROMPT — ROLE 1: SALES

> Standalone build brief for the Sales role of the multi-company B2B food-ingredients ERP (Avighna Foods style).

---

## 0. Product Context

- **Multi-company**: Asian Apex & Co., Avighna Specialty Ingredients Pvt Ltd, Ganesh Inc, Atharva Associates (each has own customers, stock, invoices).
- Every API request sends `Authorization: Bearer <token>` and `X-Company-Id: <id>` (or per-form company override).
- Currency: **INR (₹)**; stock quantities in product unit (KG/MT/etc.).
- **Demo login**: `sales@avighnya.local` / `sales123` (or `sales@avighna.com` / `Password@123`).

---

## 1. End-to-End Workflow (Sales Slice)

```
Lead → (optional) Convert to Customer
  → Field Visit (follow-up OR new_order)
  → If new_order: Sales Order created (status pending_approval)
  → Owner/Super Admin APPROVES price/order
  → Supervisor confirms/adds vehicle (+ driver when required)
  → Accounts raises invoice
  → Supervisor/Sales books truck on Order desk (date + window + vehicle + driver)
  → Logistics driver sees trip → POD → Accounts receivables/payments
```

_Sales MAY suggest vehicle/driver on the visit form; driver does NOT see the trip until Order desk booking after invoice._

---

## 2. Permissions (RBAC Codes)

### Grant Sales:

- `dashboard.view`
- `companies.view`
- `customers.view`, `customers.create`, `customers.edit`
- `leads.view`, `leads.create`, `leads.edit`
- `visits.view`, `visits.create`
- `vehicles.view`
- `products.view`
- `inventory.view` (read-only stock for quoting)
- `purchases.view` (read)
- `quotations.view`, `quotations.create`, `quotations.edit`
- `sales.view`, `sales.create`, `sales.edit`
- `dispatch.view`, `dispatch.create`
- `invoices.view`, `payments.view` (visibility only; no create)

### Deny Sales:

- `invoices.create`, `payments.create`, `quotations.approve`, `purchases.approve`, `users.*`, `companies.create/edit`, `inventory.edit`, admin.

---

## 3. Shell / Navigation

**Phone-first shell** (cream + brand primary, NOT black chrome):

### Bottom Tabs:

| Tab Label     | Route                         | Purpose                                 |
| :------------ | :---------------------------- | :-------------------------------------- |
| **Today**     | `/`                           | Sales dashboard                         |
| **Visit**     | `/field` (or `/field-visits`) | Log field visit / place order           |
| **Inventory** | `/inventory`                  | View stock for a firm                   |
| **Allot**     | `/ops`                        | Order desk (allot driver after invoice) |
| **Orders**    | `/sales` (or `/orders`)       | Quotes & orders list                    |

**Also reachable**: Pending Collection (`/collection`), Leads (`/leads`), Customers (`/customers`), Profile (`/profile`).  
**Header**: Avatar/initials, user name, brand logo. Company can be picked per form (Visit) or via top firm switcher when on desktop-like pages.

---

## 4. Screen: Sales Dashboard (`/`)

**Purpose**: “What should I do today?”

### KPIs / Blocks:

- My sales target (₹)
- Achieved (₹)
- Achievement %
- Lead funnel counts: New, Contacted, Qualified, Visit, Quotation, Negotiation, Won
- Today’s activities: Follow-ups due, Customer visits, Pending quotations, Overdue follow-ups
- Performance: Conversion rate, Visit coverage, Quote win rate, Price-exception count

### Rules:

- No company-wide finance admin, no user management, no full warehouse write UI.
- If data empty, show empty states with CTA to Visit / Leads.

---

## 5. Screen: Leads (`/leads`)

### List Filters:

- Search text box — placeholder `Search` (name, phone, company)
- Assigned filter select
- Source select: All / WhatsApp / Call / Visit / Referral / Website / Other
- Type select: All / Wholesale / Retail
- Stage select: pipeline stages (`new`, `contacted`, `qualified`, `visit`, `quotation`, `negotiation`, `won`, `lost`)
- Date from & Date to
- Clear filters button

### Actions:

- Export CSV button
- Import CSV (file input)
- `+ Add lead` opens modal

### Add Lead Modal — Fields:

| Field                  | Control    | Required         | Notes                                           |
| :--------------------- | :--------- | :--------------- | :---------------------------------------------- |
| Company                | `<select>` | YES              | Firms user can access                           |
| Name (`business_name`) | text       | YES              |                                                 |
| Contact person         | text       | no               |                                                 |
| Phone                  | tel        | no               | Duplicate detection with GST                    |
| GSTIN                  | text       | no               | Duplicate detection                             |
| City (location)        | text       | no               |                                                 |
| Product interest       | text       | no               |                                                 |
| Estimated value (₹)    | number     | no               |                                                 |
| Source                 | select     | default WhatsApp | WhatsApp, Call, Visit, Referral, Website, Other |
| Type                   | select     |                  | wholesale / retail                              |
| Priority               | select     |                  | high / medium / low                             |
| Notes                  | textarea   | no               |                                                 |

### Lead Detail Sheet:

- Stage chips: move pipeline (`PATCH status`)
- Mark Lost button (sets `lost_reason`)
- Readouts: Source, Priority, GSTIN, Location, Est. value, Next follow-up (red if overdue), Notes
- Follow-up: textarea `Call notes / next action`, `datetime-local` next date, Save follow-up, Log activity
- Convert to customer button (disabled if already converted)

---

## 6. Screen: Customers (`/customers`)

### Filters & KPIs:

- Search: `Search customer, phone, GSTIN`
- Type: All / Wholesale / Retail
- Health: All / Good / Watch / Risk / Inactive
- Customer counts by health, outstanding visibility where permitted

### Add / Edit Customer Modal:

- Legal name (YES), Trade name, Phone, Email, GSTIN, Billing address, Shipping address, Customer type, Contact person, Credit limit (₹), Credit days.

### Detail:

- Shows orders count, last order, last payment, reorder suggestions, credit used vs limit, health badge.

---

## 7. Screen: Field Visit (`/field`) — CRITICAL

Mobile-first command studio. Pick Company first via `CompanyPick` grid (2-column firm cards with logo + trade name).

### Always-Visible Fields:

| Field                 | Control            | Required | Notes                                                                                  |
| :-------------------- | :----------------- | :------- | :------------------------------------------------------------------------------------- |
| Which firm?           | `CompanyPick`      | YES      | Sets `companyId` for all APIs                                                          |
| Customer              | searchable list    | YES      | Disabled until firm selected                                                           |
| Purpose               | select             | YES      | `Prospecting`, `New order`, `Follow-up`, `Collection`, `Complaint`, `Delivery support` |
| Requirement / outcome | textarea           | no       | Field discussion notes                                                                 |
| Voice note            | VoiceNote recorder | no       | Audio briefing attachment                                                              |
| I'm on site           | checkbox / HUD     |          | Satellite GPS lock + geotagged photos                                                  |

### When Purpose = New order:

- **Catalog**: Search items, per line qty, rate override, shortage dialog if qty > available.
- **Delivery Mode**: Two large buttons:
  1. _Own vehicle_
  2. _Manufacturer_ (no fleet; logistics not involved)
- **If Own vehicle** (planning block):
  - Date (default today)
  - Window: Morning / Afternoon / Evening
  - Vehicle: select from availability
  - Driver: select driver user
- **On-site block**: GPS pin radar + camera geotagged photos.
- **Submit buttons**: `Save visit` / `Place order`.

---

## 8. Screen: Quotes & Orders (`/sales`)

List sales orders with status labels:

- `Waiting Super Admin / Owner`
- `Waiting Supervisor vehicle`
- `Waiting invoice`
- `Ready to allot`
- `Driver allotted`
- Actions: open detail; link to Order desk for allot when allowed.

---

## 9. Screen: Inventory (Sales View) (`/inventory`)

- View-only. Pick firm first (`CompanyPick`).
- Products list with qty, unit, selling price, Low/Available badges.
- Search + filters All / Low stock / Fast moving.
- No inbound / product create for Sales.

---

## 10. Screen: Order Desk Allot (`/ops`)

Sales permitted actions after invoice:

- Date, Window, Vehicle, Driver
- Button `Book truck + assign order` (disabled until all 4 are set).

---

## 11. Pending Collection (`/collection`)

- Overdue/receivable follow-ups for Sales customers.
- Deep links for Call (`tel:`) and WhatsApp (`wa.me`).
- Read-only; no posting payments.

---

## 12. Acceptance Checklist

- [x] Sales cannot create invoices or post payments (API 403).
- [x] New order from Visit creates `pending_approval` order.
- [x] Manufacturer path skips vehicle/driver.
- [x] Own vehicle optional plan; incomplete vehicle/driver pair rejected.
- [x] After Owner approve + Supervisor vehicle + Accounts invoice, Allot books run and Logistics sees it.
- [x] All list screens company-safe.
