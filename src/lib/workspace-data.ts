export const companies = [
  {
    id: "asian",
    name: "Asian Apex & Co.",
    short: "Asian Apex",
    logo: "/logos/logos/asian-apex.jpg",
    gstin: "29AAAAA0001A1Z1",
    invPrefix: "Inv AA-...",
    revenue: 0,
    growth: 0,
  },
  {
    id: "avighna",
    name: "Avighna Specialty Ingredients Pvt Ltd",
    short: "Avighna",
    logo: "/logos/logos/avighna.png",
    gstin: "29AAAAA0002A1Z2",
    invPrefix: "Inv AV-...",
    revenue: 0,
    growth: 0,
  },
  {
    id: "ganesh",
    name: "Ganesh Inc",
    short: "Ganesh Inc",
    logo: "/logos/logos/ganesh-inc.jpg",
    gstin: "29AAAAA0003A1Z3",
    invPrefix: "Inv GI-...",
    revenue: 0,
    growth: 0,
  },
  {
    id: "atharva",
    name: "Atharva Associates",
    short: "Atharva Associates",
    logo: "/logos/logos/atharva-associates.png",
    gstin: "29AAAAA0004A1Z4",
    invPrefix: "Inv AT-...",
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
