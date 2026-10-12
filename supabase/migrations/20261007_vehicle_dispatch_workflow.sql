-- ============================================================================
-- VEHICLE FLEET & REAL TRANSPORT DISPATCH WORKFLOW
-- 1. Manufacturer Vehicle (Direct Collection) vs 2. Logistics / Assigned Vehicle
-- 4 Vehicle Availability States:
--   'Available / At Godown', 'Dispatched / On Delivery', 'Returned to Godown', 'Assigned / Booked'
-- ============================================================================

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

-- Seed default company vehicles
INSERT INTO public.vehicles (id, name, plate_number, status, driver_name, driver_phone, capacity) VALUES
  ('FL-101', 'Tata 1109', 'KA-01-AB-1024', 'Available / At Godown', 'Mahesh Patel', '+91 98450 11223', '5 Tons'),
  ('FL-102', 'Eicher Pro 2049', 'KA-05-CD-3312', 'Available / At Godown', 'Kiran Joshi', '+91 98450 44556', '3.5 Tons'),
  ('FL-103', 'Mahindra Bolero Maxi', 'KA-03-EF-9981', 'Available / At Godown', 'Ramesh Yadav', '+91 98450 77889', '1.5 Tons')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  name = EXCLUDED.name,
  driver_name = EXCLUDED.driver_name,
  driver_phone = EXCLUDED.driver_phone;

-- Ensure transport_mode and assigned vehicle fields exist on orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'Logistics / Assigned Vehicle',
  ADD COLUMN IF NOT EXISTS assigned_vehicle TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver_phone TEXT;

-- Ensure transport_mode and vehicle_id exist on deliveries
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'Logistics / Assigned Vehicle',
  ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
