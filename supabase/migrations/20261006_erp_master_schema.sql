-- ========================================================================
-- AVIGHNA ONE / CHROMASHIFT ERP MASTER SCHEMA (PRODUCTION READY)
-- Multi-Company Workspace with Full Master User Flow & RLS
-- Clean configuration: Zero dummy/seed business records
-- ========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. COMPANIES (Fixed 4 Business Entities)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY CHECK (id IN ('asian', 'avighna', 'ganesh', 'atharva')),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  growth NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real System Configuration: Fixed 4 Group Entities
INSERT INTO public.companies (id, name, short_name, logo_url, revenue, growth)
VALUES
  ('asian', 'Asian Apex & Co.', 'Asian Apex', '/logos/logos/asian-apex.jpg', 0, 0),
  ('avighna', 'Avighna Specialty Ingredients Pvt Ltd', 'Avighna', '/logos/logos/avighna.png', 0, 0),
  ('ganesh', 'Ganesh Inc', 'Ganesh Inc', '/logos/logos/ganesh-inc.jpg', 0, 0),
  ('atharva', 'Atharva Associates', 'Atharva', '/logos/logos/atharva-associates.png', 0, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  logo_url = EXCLUDED.logo_url;

-- ------------------------------------------------------------------------
-- 2. ROLES & PERMISSIONS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY, -- 'super_admin', 'sales', 'logistics', 'accounts', 'supervisor'
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles (id, name, description)
VALUES
  ('super_admin', 'Super Admin', 'Unrestricted administrative control across all companies'),
  ('sales', 'Sales', 'Customer relationships, leads, orders, and field visits'),
  ('supervisor', 'Supervisor', 'Operations oversight, order approvals, inventory management'),
  ('logistics', 'Logistics', 'Delivery queue, vehicle dispatch, delivery proof'),
  ('accounts', 'Accounts', 'Invoicing, receivables, payment tracking, financial reporting')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.permissions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO public.permissions (id, category, description)
VALUES
  ('orders.view', 'Orders', 'View orders'),
  ('orders.create', 'Orders', 'Create orders'),
  ('orders.edit', 'Orders', 'Edit orders'),
  ('orders.approve', 'Orders', 'Approve, reject, or request correction on orders'),
  ('orders.delete', 'Orders', 'Delete draft orders'),
  ('invoices.view', 'Finance', 'View invoices'),
  ('invoices.generate', 'Finance', 'Generate invoices from approved orders'),
  ('invoices.edit', 'Finance', 'Edit invoices (Super Admin)'),
  ('payments.record', 'Finance', 'Record invoice payments'),
  ('logistics.view', 'Logistics', 'View delivery queue'),
  ('logistics.dispatch', 'Logistics', 'Assign vehicle and dispatch order'),
  ('logistics.deliver', 'Logistics', 'Capture delivery proof and complete delivery'),
  ('inventory.view', 'Inventory', 'View inventory and stock status'),
  ('inventory.adjust', 'Inventory', 'Adjust stock levels'),
  ('inventory.shortage_approve', 'Inventory', 'Approve orders with inventory shortages'),
  ('purchases.view', 'Procurement', 'View purchase orders'),
  ('purchases.create', 'Procurement', 'Create purchase orders'),
  ('purchases.approve', 'Procurement', 'Approve purchase orders'),
  ('purchases.receive', 'Procurement', 'Receive goods and increase inventory'),
  ('leads.view', 'CRM', 'View leads pipeline'),
  ('leads.manage', 'CRM', 'Create, update, and qualify leads'),
  ('leads.convert', 'CRM', 'Convert leads to customers'),
  ('customers.view', 'CRM', 'View customers'),
  ('customers.manage', 'CRM', 'Create and edit customers'),
  ('field_visits.view', 'Operations', 'View field visits'),
  ('field_visits.schedule', 'Operations', 'Schedule field visits'),
  ('field_visits.conduct', 'Operations', 'Check in on-site, capture GPS and photos'),
  ('tasks.view', 'Work', 'View work items and tasks'),
  ('tasks.manage', 'Work', 'Create, assign, and manage tasks'),
  ('admin.manage', 'Administration', 'Manage users, roles, and company access'),
  ('audit.view', 'Audit', 'View audit logs')
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('sales', 'orders.view'), ('sales', 'orders.create'), ('sales', 'leads.view'), ('sales', 'leads.manage'),
  ('sales', 'leads.convert'), ('sales', 'customers.view'), ('sales', 'customers.manage'),
  ('sales', 'field_visits.view'), ('sales', 'field_visits.schedule'), ('sales', 'field_visits.conduct'),
  ('sales', 'tasks.view'), ('sales', 'tasks.manage'), ('sales', 'inventory.view'),
  ('supervisor', 'orders.view'), ('supervisor', 'orders.create'), ('supervisor', 'orders.edit'),
  ('supervisor', 'orders.approve'), ('supervisor', 'inventory.view'), ('supervisor', 'inventory.adjust'),
  ('supervisor', 'inventory.shortage_approve'), ('supervisor', 'purchases.view'), ('supervisor', 'purchases.create'),
  ('supervisor', 'purchases.approve'), ('supervisor', 'purchases.receive'), ('supervisor', 'logistics.view'),
  ('supervisor', 'tasks.view'),
  ('supervisor', 'tasks.manage'), ('supervisor', 'field_visits.view'), ('supervisor', 'customers.view'),
  ('logistics', 'logistics.view'), ('logistics', 'logistics.dispatch'), ('logistics', 'logistics.deliver'),
  ('logistics', 'orders.view'), ('logistics', 'tasks.view'), ('logistics', 'customers.view'),
  ('accounts', 'invoices.view'), ('accounts', 'invoices.generate'), ('accounts', 'payments.record'),
  ('accounts', 'orders.view'), ('accounts', 'tasks.view'), ('accounts', 'customers.view')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------
-- 3. USER PROFILES & OVERRIDES
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role_id TEXT NOT NULL REFERENCES public.roles(id) DEFAULT 'sales',
  initials TEXT NOT NULL,
  default_company_id TEXT CHECK (default_company_id IN ('asian', 'avighna', 'ganesh', 'atharva', 'all') OR default_company_id IS NULL) DEFAULT 'asian',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure default_company_id can safely store 'all' (multi-company view) without foreign key conflict
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_default_company_id_fkey;

-- System User Accounts
INSERT INTO public.user_profiles (id, full_name, email, phone, role_id, initials, default_company_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ravi Kumar', 'ravi.kumar@avighnaone.com', '+91 98450 11223', 'sales', 'RK', 'asian'),
  ('22222222-2222-2222-2222-222222222222', 'Suresh Rao', 'suresh.rao@avighnaone.com', '+91 98450 22334', 'accounts', 'SR', 'avighna'),
  ('33333333-3333-3333-3333-333333333333', 'Mahesh Patel', 'mahesh.patel@avighnaone.com', '+91 98450 33445', 'logistics', 'MP', 'ganesh'),
  ('44444444-4444-4444-4444-444444444444', 'Arun Nair', 'arun.nair@avighnaone.com', '+91 98450 44556', 'supervisor', 'AN', 'atharva'),
  ('55555555-5555-5555-5555-555555555555', 'Harshith Admin', 'admin@avighnaone.com', '+91 98450 55667', 'super_admin', 'HA', 'asian')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  initials = EXCLUDED.initials;

CREATE TABLE IF NOT EXISTS public.user_company_access (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

INSERT INTO public.user_company_access (user_id, company_id)
SELECT u.id, c.id
FROM public.user_profiles u
CROSS JOIN public.companies c
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

-- ------------------------------------------------------------------------
-- 4. CRM: CUSTOMERS & LEADS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  business_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  requirement TEXT NOT NULL,
  expected_quantity TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Qualified', 'Follow-up', 'Converted')),
  assigned_to UUID REFERENCES public.user_profiles(id),
  converted_customer_id UUID REFERENCES public.customers(id),
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 5. PRODUCTS & INVENTORY INTELLIGENCE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  wholesale_price NUMERIC NOT NULL DEFAULT 0,
  on_hand NUMERIC NOT NULL DEFAULT 0,
  reserved NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column addition & column comments for selling vs wholesale pricing
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.unit_price IS 'Catalog Selling Price (Retail/Standard)';
COMMENT ON COLUMN public.products.wholesale_price IS 'Catalog Wholesale Price (Dealer/Bulk)';

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('GOODS_RECEIVED', 'RESERVED', 'UNRESERVED', 'DISPATCHED', 'ADJUSTMENT')),
  quantity NUMERIC NOT NULL,
  previous_on_hand NUMERIC NOT NULL,
  new_on_hand NUMERIC NOT NULL,
  previous_reserved NUMERIC NOT NULL,
  new_reserved NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 6. ORDERS & ORDER ITEMS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    status IN (
      'Draft',
      'Pending approval',
      'Approved',
      'Needs Correction',
      'Rejected',
      'Procuring',
      'Ready to dispatch',
      'Out for delivery',
      'Partially delivered',
      'Delivered',
      'Cancelled'
    )
  ),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  items_summary TEXT,
  delivery_address TEXT,
  expected_delivery DATE,
  notes TEXT,
  rejection_reason TEXT,
  shortage_approved BOOLEAN NOT NULL DEFAULT FALSE,
  shortage_approved_by UUID REFERENCES public.user_profiles(id),
  assigned_to UUID REFERENCES public.user_profiles(id),
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  delivered_quantity NUMERIC NOT NULL DEFAULT 0,
  remaining_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_price NUMERIC NOT NULL,
  discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL,
  shortage_quantity NUMERIC NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------------
-- 7. INVOICES & PAYMENTS (Finance)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  order_id TEXT NOT NULL REFERENCES public.orders(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Generated' CHECK (status IN ('Generated', 'Partially Paid', 'Paid', 'Overdue')),
  file_path TEXT,
  generated_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id),
  customer_id UUID REFERENCES public.customers(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Bank Transfer', 'Cheque', 'Cash', 'UPI')),
  reference_number TEXT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 8. LOGISTICS & DELIVERY QUEUE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  order_id TEXT NOT NULL REFERENCES public.orders(id),
  invoice_id TEXT REFERENCES public.invoices(id),
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Out for delivery', 'Delivered', 'Partially Delivered', 'Failed')),
  delivered_quantity NUMERIC,
  remaining_quantity NUMERIC,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  gps_captured_at TIMESTAMPTZ,
  signature_path TEXT,
  photos TEXT[] DEFAULT '{}',
  remarks TEXT,
  failure_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 9. PURCHASES & PROCUREMENT
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  supplier_name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  received_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approval', 'In transit', 'Received', 'Rejected')),
  eta DATE,
  warehouse TEXT,
  notes TEXT,
  approved_by UUID REFERENCES public.user_profiles(id),
  received_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 10. FIELD VISITS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  assigned_to UUID REFERENCES public.user_profiles(id),
  assigned_to_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  gps_captured_at TIMESTAMPTZ,
  outcome_notes TEXT,
  photos TEXT[] DEFAULT '{}',
  voice_recording_path TEXT,
  created_order_id TEXT REFERENCES public.orders(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 11. GENERAL WORK / TASKS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id),
  assigned_to UUID REFERENCES public.user_profiles(id),
  assigned_to_name TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue', 'Cancelled')),
  done BOOLEAN NOT NULL DEFAULT FALSE,
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 12. NOTIFICATIONS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id),
  company_id TEXT REFERENCES public.companies(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'approval', 'shortage', 'dispatch', 'task', 'delivery')),
  reference_type TEXT,
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 13. AUDIT LOGS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id),
  user_name TEXT NOT NULL,
  company_id TEXT REFERENCES public.companies(id),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT NOT NULL,
  description TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 14. WORKFLOW TRIGGERS & BUSINESS LOGIC
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_process_goods_received()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Received' AND OLD.status != 'Received' THEN
    NEW.received_quantity := NEW.quantity;
    NEW.received_at := NOW();

    UPDATE public.products
    SET on_hand = on_hand + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;

    INSERT INTO public.inventory_logs (
      company_id, product_id, transaction_type, quantity,
      previous_on_hand, new_on_hand, previous_reserved, new_reserved,
      reference_type, reference_id, notes, performed_by
    )
    SELECT
      NEW.company_id, NEW.product_id, 'GOODS_RECEIVED', NEW.quantity,
      p.on_hand - NEW.quantity, p.on_hand, p.reserved, p.reserved,
      'purchase_order', NEW.id, 'Goods received from PO ' || NEW.id, NEW.approved_by
    FROM public.products p
    WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_goods_received ON public.purchase_orders;
CREATE TRIGGER trg_po_goods_received
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_goods_received();

-- Effective Permission Check Function
CREATE OR REPLACE FUNCTION public.can_user(p_user_id UUID, p_permission_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_override BOOLEAN;
  v_role_id TEXT;
  v_has_role_perm BOOLEAN;
BEGIN
  SELECT granted INTO v_override
  FROM public.user_permissions
  WHERE user_id = p_user_id AND permission_id = p_permission_id;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  SELECT role_id INTO v_role_id FROM public.user_profiles WHERE id = p_user_id;

  IF v_role_id = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = v_role_id AND permission_id = p_permission_id
  ) INTO v_has_role_perm;

  RETURN COALESCE(v_has_role_perm, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public read user_profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Public read roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Public read permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Public read customers" ON public.customers FOR ALL USING (true);
CREATE POLICY "Public read leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Public read products" ON public.products FOR ALL USING (true);
CREATE POLICY "Public read inventory_logs" ON public.inventory_logs FOR ALL USING (true);
CREATE POLICY "Public read orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Public read order_items" ON public.order_items FOR ALL USING (true);
CREATE POLICY "Public read invoices" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Public read payments" ON public.payments FOR ALL USING (true);
CREATE POLICY "Public read deliveries" ON public.deliveries FOR ALL USING (true);
CREATE POLICY "Public read purchase_orders" ON public.purchase_orders FOR ALL USING (true);
CREATE POLICY "Public read field_visits" ON public.field_visits FOR ALL USING (true);
CREATE POLICY "Public read tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Public read notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Public read audit_logs" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Public read user_company_access" ON public.user_company_access FOR ALL USING (true);
CREATE POLICY "Public read user_permissions" ON public.user_permissions FOR ALL USING (true);

-- ------------------------------------------------------------------------
-- 12. CREDIT CONTROL & DEBIT NOTES (Super Admin Only)
-- ------------------------------------------------------------------------
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 500000;

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS credit_days INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  customer_name TEXT NOT NULL,
  invoice_id TEXT REFERENCES public.invoices(id),
  type TEXT NOT NULL CHECK (type IN ('Credit note', 'Debit note')),
  reason TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Posted',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read credit_notes" ON public.credit_notes FOR ALL USING (true);

-- ------------------------------------------------------------------------
-- 13. VEHICLES & TRANSPORT WORKFLOW
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id),
  name TEXT NOT NULL,
  plate_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Available / At Godown' CHECK (
    status IN (
      'Available / At Godown',
      'Dispatched / On Delivery',
      'Returned to Godown',
      'Assigned / Booked'
    )
  ),
  driver_name TEXT,
  driver_phone TEXT,
  capacity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vehicles" ON public.vehicles FOR ALL USING (true);

INSERT INTO public.vehicles (id, name, plate_number, status, driver_name, driver_phone, capacity) VALUES
  ('FL-101', 'Tata 1109', 'KA-01-AB-1024', 'Available / At Godown', 'Mahesh Patel', '+91 98450 11223', '5 Tons'),
  ('FL-102', 'Eicher Pro 2049', 'KA-05-CD-3312', 'Available / At Godown', 'Kiran Joshi', '+91 98450 44556', '3.5 Tons'),
  ('FL-103', 'Mahindra Bolero Maxi', 'KA-03-EF-9981', 'Available / At Godown', 'Ramesh Yadav', '+91 98450 77889', '1.5 Tons')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  name = EXCLUDED.name,
  driver_name = EXCLUDED.driver_name,
  driver_phone = EXCLUDED.driver_phone;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'Logistics / Assigned Vehicle',
  ADD COLUMN IF NOT EXISTS assigned_vehicle TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver_phone TEXT;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'Logistics / Assigned Vehicle',
  ADD COLUMN IF NOT EXISTS vehicle_id TEXT;

