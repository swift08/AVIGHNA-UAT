# MASTER ROLE & LIFECYCLE SPECIFICATION — AVIGHNA ONE ERP

> Complete architectural reference and role contract for all 5 enterprise personas.

---

## 1. Persona Matrix & Credentials

| Role                   | Standard Email                                                                 | Standard Password                            | Shell Experience   | Primary Scope                                            |
| :--------------------- | :----------------------------------------------------------------------------- | :------------------------------------------- | :----------------- | :------------------------------------------------------- |
| **Super Admin**        | `admin@avighnya.local`                                                         | `admin123`                                   | Full Desktop Shell | Root Administrator & Configuration                       |
| **Owner**              | `owner@avighnya.local`                                                         | `owner123`                                   | Full Desktop Shell | Price & Purchase Approvals, Cross-module Oversight       |
| **Sales**              | `sales@avighnya.local`                                                         | `sales123`                                   | Phone-First Shell  | CRM Leads, Field Visits, Order Booking, Stock Quoting    |
| **Supervisor**         | `supervisor@avighnya.local`                                                    | `super123`                                   | Operations Desktop | Vehicle Allocation, Stock Verify, PR Raising, GRN Inward |
| **Accounts**           | `accounts@avighnya.local`                                                      | `accounts123`                                | Finance Desktop    | GST Invoicing, Receivables Ageing, Payment Posting       |
| **Logistics (Driver)** | `logistics@avighnya.local`<br>`ravi@avighnya.local`<br>`suresh@avighnya.local` | `logistics123`<br>`driver123`<br>`driver123` | Phone-First Shell  | Daily Runs, 1-Tap Navigation, Proof of Delivery (POD)    |

---

## 2. Universal Order Handoff Lifecycle

```
[SALES] Field Visit / Order Creation
   │  Creates Sales Order (status: pending_approval)
   ▼
[OWNER / SUPER ADMIN] Price & Margin Gate (ApprovalPopup)
   │  Approve ──► Own Vehicle: pending_vehicle_confirm
   │             Manufacturer: awaiting_invoice
   ▼
[SUPERVISOR] Order Desk (/ops)
   │  Confirms/Adds Delivery Vehicle (+ Driver)
   ▼
[ACCOUNTS] Invoicing (/invoices)
   │  Raises GST-compliant Commercial Invoice (order: Ready to dispatch)
   ▼
[SUPERVISOR / SALES] Order Desk Truck Booking (/ops)
   │  Books Date + Window + Vehicle + Driver
   ▼
[LOGISTICS] Driver Today Run (/)
   │  Driver views run sequence, navigates, executes POD (Complete / Partial / Failed)
   ▼
[ACCOUNTS] Receivables (/receivables)
   │  Records Customer Settlement (UPI / NEFT / Cheque / Cash)
```

---

## 3. Dedicated Role Documentation

- [Role 1: Sales Build Brief](./ROLE_1_SALES.md)
- [Role 2: Accounts Build Brief](./ROLE_2_ACCOUNTS.md)
- [Role 3: Logistics (Driver) Build Brief](./ROLE_3_LOGISTICS.md)
- [Role 4: Supervisor Build Brief](./ROLE_4_SUPERVISOR.md)
- [Role 5: Owner / Super Admin Build Brief](./ROLE_5_OWNER_SUPER_ADMIN.md)
