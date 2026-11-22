export const companies = [
  {
    id: "asian",
    name: "Asian Apex & Co.",
    short: "Asian Apex",
    logo: "/logos/logos/asian-apex.jpg",
    gstin: "29AAAAA0001A1Z1",
    invPrefix: "AA/S",
    pan: "AAAAA0001A",
    phone: "+91-9845000001",
    email: "billing@asianapex.com",
    address: "Plot 12, Peenya Industrial Area, Bengaluru-560058",
    state: "Karnataka",
    stateCode: "29",
    revenue: 0,
    growth: 0,
  },
  {
    id: "avighna",
    name: "Avighna Specialty Ingredients Pvt Ltd",
    short: "Avighna",
    logo: "/logos/logos/avighna.png",
    gstin: "29AAAAA0002A1Z2",
    invPrefix: "AV/S",
    pan: "AAAAA0002A",
    phone: "+91-9845000002",
    email: "billing@avighna.com",
    address: "No. 42, Industrial Growth Centre, Bengaluru-560100",
    state: "Karnataka",
    stateCode: "29",
    revenue: 0,
    growth: 0,
  },
  {
    id: "ganesh",
    name: "Ganesh Inc",
    short: "Ganesh Inc",
    logo: "/logos/logos/ganesh-inc.jpg",
    gstin: "29ACNPY2585M2ZE",
    invPrefix: "GI/S",
    pan: "ACNPY2585M",
    phone: "+91-7019477940",
    email: "ashita@ganeshinc.org",
    address:
      "No.1963, Sri Ganapa, Shani Mahatma Temple Street, BCCHS Layout, Raghuvanahalli, Thalagattapura, Bangalore-560109",
    state: "Karnataka",
    stateCode: "29",
    revenue: 0,
    growth: 0,
  },
  {
    id: "atharva",
    name: "Atharva Associates",
    short: "Atharva Associates",
    logo: "/logos/logos/atharva-associates.png",
    gstin: "29AAAAA0004A1Z4",
    invPrefix: "AT/S",
    pan: "AAAAA0004A",
    phone: "+91-9845000004",
    email: "billing@atharva.com",
    address: "Warehouse 7, Bommasandra Industrial Area, Bengaluru-560099",
    state: "Karnataka",
    stateCode: "29",
    revenue: 0,
    growth: 0,
  },
] as const;
export type CompanyId = "all" | (typeof companies)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";
export function resolveMode(mode: ThemeMode, systemDark: boolean) {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export interface Order {
  id: string;
  customer: string;
  initials: string;
  company: string;
  amount: number;
  status: string;
  date: string;
  items: string;
  owner: string;
  transport_mode?: "Manufacturer Vehicle" | "Logistics / Assigned Vehicle" | undefined;
  assigned_vehicle?: string | undefined;
  assigned_driver?: string | undefined;
  assigned_driver_phone?: string | undefined;
}

export const orders: Order[] = [];

export function filterCompany<T extends { company: string } | { company_id: string }>(
  rows: T[],
  id: CompanyId,
) {
  if (id === "all") return rows;
  return rows.filter((row) => ("company" in row ? row.company === id : row.company_id === id));
}

export function companyRevenue(id: CompanyId) {
  return companies
    .filter((c) => id === "all" || c.id === id)
    .reduce((sum, c) => sum + c.revenue, 0);
}

export const money = (value: number) => "₹" + Math.round(value).toLocaleString("en-IN");

/** Mask financial amounts when the viewer lacks finance.view_amounts. */
export const displayMoney = (value: number, canView: boolean) =>
  canView ? money(value) : "—";

export interface TaskItem {
  id: number | string;
  name: string;
  company: string;
  due: string;
  person: string;
  priority: string;
  done: boolean;
}

export const initialTasks: TaskItem[] = [];

export interface ProductItem {
  name: string;
  code: string;
  company: string;
  onhand: number;
  reserved: number;
  unit: string;
  category: string;
}

export const products: ProductItem[] = [];
