# IMPLEMENTATION PROMPT — ROLE 3: LOGISTICS (DRIVER)

> Standalone build brief for the Logistics / Driver role: a phone-first delivery app.

---

## 0. Context & Logins

- **Demo logins**: `logistics@avighnya.local` / `logistics123`, `ravi@avighnya.local` / `driver123`, `suresh@avighnya.local` / `driver123`.
- Brand shell: phone-first (cream + brand accent).
- **Flow Position**:

```
Invoice raised → Order desk ALLOCATE (date, slot, vehicle, driver)
  → LOGISTICS “Today” shows run
  → Start / arrive / POD
  → Accounts sees delivery for collections
```

---

## 1. Permissions (RBAC Codes)

### Grant Logistics:

- `dashboard.view`, `companies.view`
- `customers.view`, `customers.create`
- `products.view`
- `dispatch.view`, `dispatch.edit`
- `sales.view`, `invoices.view` (read invoice on stop)
- `vehicles.view`, `vehicles.edit`
- `deliveries.view`, `deliveries.edit`

### Deny Logistics:

- `invoices.create`, `payments.create`, `quotations.approve`, `inventory.edit`, admin.

---

## 2. Navigation (Phone Shell)

### Bottom Tabs:

| Tab         | Route      | Purpose                       |
| :---------- | :--------- | :---------------------------- |
| **Today**   | `/`        | Today’s assigned runs & stops |
| **History** | `/history` | Past delivery outcomes        |
| **Profile** | `/profile` | Driver profile & sign out     |

---

## 3. Screen: Today / Logistics Dashboard (`/`)

- **Empty State**: “No assignment yet. Sales or Supervisor opens Order desk, picks date + window + vehicle, then Assign.”
- **When Runs Exist**:
  - Date, slot (Morning / Afternoon / Evening), Vehicle plate, Driver name.
  - Stop sequence cards: Customer name, address, product + ordered qty.
  - 1-Tap Links: Phone (`tel:`), Google Maps navigation, WhatsApp (`wa.me`).
  - Invoice PDF overlay viewer if attached.
  - Status badges: `Pending` · `Going` · `Delivered` · `Failed` · `Partial`.
  - Actions: Start trip / Mark Going → Open stop detail for POD.

---

## 4. Proof of Delivery (POD) Form

### Outcome Toggle (3 Buttons):

1. **Complete (`delivered`)**
   - Received by (text, YES)
   - Remarks (text, optional)
   - POD photo (camera capture, YES)
2. **Partial (`partial`)**
   - Qty delivered (number, YES, `≤ qty_ordered`)
   - Received by (text, YES)
   - Remarks & Camera photo (YES)
3. **Failed (`failed`)**
   - Reason (select, YES)
     - `Customer unavailable`
     - `Address problem`
     - `Customer refused`
     - `Vehicle issue`
     - `Goods damaged`
     - `Other`
   - Return goods to warehouse (checkbox)
   - Camera photo (YES) & Remarks

---

## 5. Screen: History (`/history`)

- List past stops with outcome, timestamps, filtered by date. Read-only POD summary.

---

## 6. Acceptance Checklist

- [x] No runs visible before Order desk allocation.
- [x] Camera-only POD photos enforced.
- [x] All 6 fail reasons selectable without crashes.
- [x] Partial quantity validated `≤ ordered`.
- [x] Delivery complete triggers Accounts receivable updates.
