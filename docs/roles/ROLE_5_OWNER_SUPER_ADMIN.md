# IMPLEMENTATION PROMPT — ROLE 5: OWNER / SUPER ADMIN

> Standalone build brief for the Owner and Super Admin roles: cross-module oversight and executive gating.

---

## 0. Context & Logins

| Role            | Email                  | Password   |
| :-------------- | :--------------------- | :--------- |
| **Super Admin** | `admin@avighnya.local` | `admin123` |
| **Owner**       | `owner@avighnya.local` | `owner123` |

- Uses the full executive desktop shell (`ownerNav`).
- Super Admin is the root identity; Owner manages companies, users, fleet, and reviews orders/purchases.

---

## 1. Master Workflow (Owner Sits at the Gate)

```
Sales creates SO (maybe below floor / with vehicle suggestion)
  → OWNER/SUPER_ADMIN ApprovalPopup: Approve | Reject | Later
  → Supervisor confirms vehicle
  → Accounts invoices
  → Supervisor books truck
  → Logistics POD
  → Accounts collects

Shortage path:
  Supervisor raise PR → OWNER approve purchase → Supervisor receive + batch
```

---

## 2. Permissions (RBAC Codes)

- `ROLE_PERMS[OWNER] = "*"` and `ROLE_PERMS[SUPER_ADMIN] = "*"`
- Full access to all modules, including:
  - `quotations.approve`, `purchases.approve`
  - `users.view/create/edit`, `companies.create/edit`
  - `inventory.edit`, `payments.create`, `invoices.create`, `audit.view`

---

## 3. Navigation (Full ERP)

- **Overview**: Dashboard `/`
- **Sell**: Leads, Customers, Sales & approvals `/sales`, Field visits `/field`
- **Operate**: Order desk `/ops`, Inventory `/inventory`, Purchases `/purchases`, Dispatch `/dispatch`
- **Money**: Invoices, Receivables, Payments received, Credit control `/credit`, Accounts reports `/reports`, Analytics `/analytics`
- **Setup**: Administration `/admin`

---

## 4. Approval Popup (CRITICAL — Owner Only)

Triggered when pending orders or purchases require executive authorization:

### Sales Order Approval:

- Displays Customer, Operating Firm, Order total, Delivery mode, Line items table.
- Highlights if line price is below floor/wholesale rate.
- Buttons:
  - `Approve` → advances SO to `pending_vehicle_confirm` (own vehicle) or `awaiting_invoice` (manufacturer).
  - `Reject` → marks order rejected with notes.
  - `Later` → dismisses review without status change.

### Purchase Approval:

- Displays Manufacturer, Products, Quantities, Unit rates, Total expenditure.
- Buttons: `Approve` / `Reject`. On approve, unlocks GRN inward for Supervisor.

---

## 5. Administration (`/admin`)

### Tabs:

1. **Companies**: List & edit legal name, trade name, GSTIN, invoice prefix, logo, address.
2. **Users**: Create users, assign roles (`owner`, `supervisor`, `sales`, `accountant`, `logistics`), multi-company access checkboxes.
3. **Fleet**: Add & manage delivery trucks, number plates, driver linkages.
4. **Roles**: Read-only breakdown of the 5 organizational roles.
5. **Audit**: Complete filterable log of system events.

---

## 6. Acceptance Checklist

- [x] Only Owner/Super Admin see ApprovalPopup actions.
- [x] Approve unlocks Supervisor vehicle confirmation path.
- [x] Reject stores reason and halts order progression.
- [x] Purchase approve unlocks GRN inward.
- [x] Sales/Accounts/Logistics redirected away from `/admin`.
- [x] Full audit trail recorded for all approvals and financial events.
