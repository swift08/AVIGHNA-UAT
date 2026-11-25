import { supabase } from "./supabase";
import type { RoleType } from "./auth-service";
import type { CompanyId } from "./workspace-data";

export type DocumentCategory =
  | "coa"
  | "purchase_order"
  | "purchase_invoice"
  | "sales_invoice";

export interface DocumentCategoryMeta {
  id: DocumentCategory;
  label: string;
  shortLabel: string;
  description: string;
  /** Roles allowed to view documents in this category ("*" = all roles). */
  viewRoles: RoleType[] | "*";
  /** Roles allowed to upload documents in this category. */
  uploadRoles: RoleType[];
}

export const DOCUMENT_CATEGORIES: DocumentCategoryMeta[] = [
  {
    id: "coa",
    label: "COA (Certificate of Analysis)",
    shortLabel: "COA",
    description: "Product quality & edibility certificates uploaded by Supervisor. Visible to all roles.",
    viewRoles: "*",
    uploadRoles: ["supervisor", "super_admin"],
  },
  {
    id: "purchase_order",
    label: "Purchase Orders",
    shortLabel: "Purchase Order",
    description: "Purchase orders uploaded by Accounts. Visible to Super Admin & Warehouse Supervisor.",
    viewRoles: ["super_admin", "logistics", "accounts"],
    uploadRoles: ["accounts", "super_admin"],
  },
  {
    id: "purchase_invoice",
    label: "Purchase Invoices",
    shortLabel: "Purchase Invoice",
    description: "Supplier purchase invoices uploaded by Accounts or Supervisor (stock intake). Visible to Super Admin, Supervisor & Accounts.",
    viewRoles: ["super_admin", "supervisor", "accounts"],
    uploadRoles: ["accounts", "supervisor", "super_admin"],
  },
  {
    id: "sales_invoice",
    label: "Sales Invoices",
    shortLabel: "Sales Invoice",
    description: "Customer sales invoices uploaded by Accounts. Visible to Super Admin & Accounts.",
    viewRoles: ["super_admin", "accounts"],
    uploadRoles: ["accounts", "super_admin"],
  },
];

export interface DocumentRecord {
  id: string;
  company_id: string;
  category: DocumentCategory;
  title: string;
  notes?: string;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_by_role: string;
  created_at: string;
}

const BUCKET = "documents";
const MANIFEST_PATH = "_manifest/documents.json";

export function canViewCategory(category: DocumentCategory, role: RoleType | undefined): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  const meta = DOCUMENT_CATEGORIES.find((c) => c.id === category);
  if (!meta) return false;
  if (meta.viewRoles === "*") return true;
  return meta.viewRoles.includes(role);
}

export function canUploadCategory(category: DocumentCategory, role: RoleType | undefined): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  const meta = DOCUMENT_CATEGORIES.find((c) => c.id === category);
  if (!meta) return false;
  return meta.uploadRoles.includes(role);
}

export function visibleCategoriesForRole(role: RoleType | undefined): DocumentCategoryMeta[] {
  return DOCUMENT_CATEGORIES.filter((c) => canViewCategory(c.id, role));
}

export function uploadableCategoriesForRole(role: RoleType | undefined): DocumentCategoryMeta[] {
  return DOCUMENT_CATEGORIES.filter((c) => canUploadCategory(c.id, role));
}

function isMissingTable(err: { message?: string } | null): boolean {
  return Boolean(err?.message && /Could not find the table|does not exist|schema cache/i.test(err.message));
}

async function readManifest(): Promise<DocumentRecord[]> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(MANIFEST_PATH);
    if (error || !data) return [];
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as DocumentRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeManifest(records: DocumentRecord[]): Promise<void> {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(MANIFEST_PATH, blob, {
    upsert: true,
    contentType: "application/json",
  });
}

export async function fetchDocuments(
  companyId: CompanyId,
  role: RoleType | undefined,
): Promise<DocumentRecord[]> {
  let rows: DocumentRecord[] = [];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (!error && data) {
    rows = data as DocumentRecord[];
  } else if (isMissingTable(error)) {
    rows = await readManifest();
  }

  return rows.filter((doc) => {
    if (!canViewCategory(doc.category, role)) return false;
    if (companyId !== "all" && doc.company_id !== "all" && doc.company_id !== companyId) {
      return false;
    }
    return true;
  });
}

export async function uploadDocument(payload: {
  file: File;
  title: string;
  category: DocumentCategory;
  companyId: CompanyId;
  notes?: string;
  uploadedBy: string;
  uploadedByRole: RoleType;
}): Promise<DocumentRecord> {
  if (!canUploadCategory(payload.category, payload.uploadedByRole)) {
    throw new Error("Your role is not permitted to upload to this document category.");
  }

  const safeName = payload.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filePath = `${payload.category}/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filePath, payload.file, {
    upsert: false,
    contentType: payload.file.type || "application/octet-stream",
  });
  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const fileUrl = urlData.publicUrl;

  const record: DocumentRecord = {
    id: crypto.randomUUID(),
    company_id: payload.companyId,
    category: payload.category,
    title: payload.title.trim(),
    notes: payload.notes?.trim() || "",
    file_name: payload.file.name,
    file_path: filePath,
    file_url: fileUrl,
    mime_type: payload.file.type || "application/octet-stream",
    file_size: payload.file.size,
    uploaded_by: payload.uploadedBy,
    uploaded_by_role: payload.uploadedByRole,
    created_at: new Date().toISOString(),
  };

  const { data, error: insertErr } = await supabase
    .from("documents")
    .insert(record)
    .select()
    .single();

  if (!insertErr && data) {
    return data as DocumentRecord;
  }

  if (isMissingTable(insertErr)) {
    const current = await readManifest();
    await writeManifest([record, ...current]);
    return record;
  }

  throw insertErr;
}

export async function deleteDocument(doc: DocumentRecord): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error && isMissingTable(error)) {
    const current = await readManifest();
    await writeManifest(current.filter((d) => d.id !== doc.id));
  } else if (error) {
    throw error;
  }
}
