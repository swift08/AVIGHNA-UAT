# IMPLEMENTATION PROMPT — ROLE 4: SUPERVISOR

> Standalone build brief for the Supervisor role: operations + warehouse bridge.

---

## 0. Context & Logins

- **Demo login**: `supervisor@avighnya.local` / `super123` (or `supervisor@avighna.com` / `Password@123`).
- **Position in flow**:

```
Owner APPROVED
  → SUPERVISOR confirm/add vehicle (+ driver)
  → Accounts invoice
  → SUPERVISOR verify stock / Ready
  → SUPERVISOR book truck (date, window, vehicle, driver) [or Sales]
  → Logistics delivers
  → If shortage: SUPERVISOR raise PR → Owner approve PR → receive + batch
```

---

## 1. Permissions (RBAC Codes)

### Grant Supervisor:

- `dashboard.view`, `companies.view`, `users.view`
- `customers.*` (view/create/edit)
- `leads.*`
- `products.view/create`
- `inventory.view`, `inventory.edit`
- `purchases.view/create/edit` (NOT `purchases.approve`)
- `dispatch.*`
- `quotations` (view/create/edit, NOT approve)
- `sales.view/create/edit`
- `invoices.view`, `payments.view` (no create)
- `audit.view`, `visits.*`, `vehicles.*`, `deliveries.*`

### Deny Supervisor:

- `quotations.approve`, `payments.create`, `invoices.create`, `users.create/edit`, `companies.create`.

---

## 2. Navigation

| Group        | Item       | Route        |
| :----------- | :--------- | :----------- |
| **Overview** | Dashboard  | `/`          |
| **Sell**     | Leads      | `/leads`     |
| **Sell**     | Customers  | `/customers` |
| **Operate**  | Order desk | `/ops`       |
| **Operate**  | Inventory  | `/inventory` |
| **Operate**  | Purchases  | `/purchases` |

---

## 3. Screen: Order Desk (`/ops`) — CORE

### Filter Chips:

`All` · `Confirm vehicle` · `Ready to book` · `Shortage` · `Procuring` · `Booked`

### Lifecycle Handlers:

- **A) Status `pending_vehicle_confirm`**:
  Owner confirmed price. Confirm or add vehicle from empty dropdown so Accounts can invoice.
- **B) Status `awaiting_invoice`**:
  Assign vehicle + driver before invoice if needed.
- **C) Status `pending_verify`**:
  Button: `Confirm stock` → transitions to `Ready`.
- **D) Status `shortage`**:
  Raise purchase with manufacturer and notes; waits for Owner approval (`purchases.approve`).
- **E) Status `procuring` (after PR approved)**:
  Enter Batch & Manufacturer → `Receive + batch inward`.
- **F) Status `ready` — Book Truck**:
  Date (date), Window (Morning/Afternoon/Evening), Vehicle, Driver. Button `Book truck + assign order` gated until all 4 are selected.
- **G) Status `allocated`**:
  Booked summary. Reassign vehicle/driver before trip starts if necessary.

---

## 4. Screen: Inventory (`/inventory`) — Ops

- Add product: SKU, Name, Unit, Base/floor rate, Selling rate, Company selector.
- Inbound Stock: Company → Product → Warehouse → Quantity → Batch → Receive.
- Batch register with search, warehouse filter, and freshness filters.

---

## 5. Screen: Purchases (`/purchases`)

- List PRs/bills; create purchase; receive goods into inventory.
- Approval is strictly Owner's job.

---

## 6. Acceptance Checklist

- [x] Cannot approve quotations / below-floor prices.
- [x] Confirm vehicle fields start empty.
- [x] Book truck fields start empty; submit button gated until all set.
- [x] Driver sees nothing until allocate after invoice.
- [x] Shortage → PR → Owner approve → receive works seamlessly.
