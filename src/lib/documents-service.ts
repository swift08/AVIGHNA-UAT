import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
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
    description: "Purchase orders uploaded by Supervisor. Visible to Super Admin, Supervisor & Logistics.",
    viewRoles: ["super_admin", "supervisor", "logistics", "accounts"],
    uploadRoles: ["supervisor", "accounts", "super_admin"],
  },
  {
    id: "purchase_invoice",
    label: "Purchase Invoices",
    shortLabel: "Purchase Invoice",
    description: "Supplier purchase invoices uploaded by Supervisor (stock intake).",
    viewRoles: ["super_admin", "supervisor", "accounts"],
    uploadRoles: ["supervisor", "accounts", "super_admin"],
  },
  {
    id: "sales_invoice",
    label: "Sales Invoices",
    shortLabel: "Sales Invoice",
    description: "Customer sales invoices uploaded by Supervisor.",
    viewRoles: ["super_admin", "supervisor", "accounts"],
    uploadRoles: ["supervisor", "accounts", "super_admin"],
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
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const BUCKET_OPTIONS = {
  public: true as const,
  fileSizeLimit: MAX_FILE_BYTES,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/json",
  ],
};

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

function adminClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "Server is missing Supabase service credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMissingTable(err: { message?: string } | null): boolean {
  return Boolean(
    err?.message && /Could not find the table|does not exist|schema cache|PGRST205/i.test(err.message),
  );
}

function decodeBase64(input: string) {
  const clean = input.replace(/^data:[^;]+;base64,/i, "").trim();
  return Buffer.from(clean, "base64");
}

async function ensureDocumentsBucket() {
  const admin = adminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  const existing = buckets?.find((b) => b.name === BUCKET || b.id === BUCKET);
  if (!existing) {
    const { error } = await admin.storage.createBucket(BUCKET, BUCKET_OPTIONS);
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  }
  await admin.storage.updateBucket(BUCKET, BUCKET_OPTIONS);
  return admin;
}

async function readManifest(
  admin: ReturnType<typeof adminClient>,
): Promise<DocumentRecord[]> {
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(MANIFEST_PATH);
    if (error || !data) return [];
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as DocumentRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeManifest(
  admin: ReturnType<typeof adminClient>,
  records: DocumentRecord[],
): Promise<void> {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const { error } = await admin.storage.from(BUCKET).upload(MANIFEST_PATH, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw new Error(error.message);
}

function filterDocuments(
  rows: DocumentRecord[],
  companyId: CompanyId,
  role: RoleType | undefined,
): DocumentRecord[] {
  return rows.filter((doc) => {
    if (!canViewCategory(doc.category, role)) return false;
    if (companyId !== "all" && doc.company_id !== "all" && doc.company_id !== companyId) {
      return false;
    }
    return true;
  });
}

export const listDocuments = createServerFn({ method: "POST" })
  .validator((input: { companyId: CompanyId; role: RoleType | undefined }) => input)
  .handler(async ({ data }) => {
    const admin = await ensureDocumentsBucket();
    const { data: rows, error } = await admin
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    let records: DocumentRecord[] = [];
    if (!error && rows) {
      records = rows as DocumentRecord[];
    } else if (isMissingTable(error)) {
      records = await readManifest(admin);
    } else if (error) {
      throw new Error(error.message);
    }

    return filterDocuments(records, data.companyId, data.role);
  });

export const saveDocument = createServerFn({ method: "POST" })
  .validator(
    (input: {
      base64: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      title: string;
      category: DocumentCategory;
      companyId: CompanyId;
      notes?: string;
      uploadedBy: string;
      uploadedByRole: RoleType;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!canUploadCategory(data.category, data.uploadedByRole)) {
      return {
        ok: false as const,
        error: "Your role is not permitted to upload to this document category.",
      };
    }

    const mime = (data.mimeType || "application/octet-stream").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return { ok: false as const, error: "Only PDF or image files (JPEG, PNG, WebP) are allowed." };
    }
    if (!data.fileSize || data.fileSize > MAX_FILE_BYTES) {
      return { ok: false as const, error: "File must be between 1 byte and 20 MB." };
    }

    const title = data.title.trim();
    if (!title) {
      return { ok: false as const, error: "Please enter a document title." };
    }

    const bytes = decodeBase64(data.base64);
    if (bytes.length !== data.fileSize && Math.abs(bytes.length - data.fileSize) > 64) {
      // Allow small variance from browser File.size vs decoded bytes; reject gross mismatches.
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
        return { ok: false as const, error: "Could not read the selected file." };
      }
    }
    if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
      return { ok: false as const, error: "File must be between 1 byte and 20 MB." };
    }

    const admin = await ensureDocumentsBucket();
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const filePath = `${data.category}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(filePath, bytes, {
      upsert: false,
      contentType: mime,
    });
    if (uploadErr) {
      return { ok: false as const, error: uploadErr.message };
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const record: DocumentRecord = {
      id: crypto.randomUUID(),
      company_id: data.companyId,
      category: data.category,
      title,
      notes: data.notes?.trim() || "",
      file_name: data.fileName,
      file_path: filePath,
      file_url: urlData.publicUrl,
      mime_type: mime,
      file_size: bytes.length,
      uploaded_by: data.uploadedBy,
      uploaded_by_role: data.uploadedByRole,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await admin
      .from("documents")
      .insert(record)
      .select()
      .single();

    if (!insertErr && inserted) {
      return { ok: true as const, document: inserted as DocumentRecord };
    }

    if (isMissingTable(insertErr)) {
      const current = await readManifest(admin);
      await writeManifest(admin, [record, ...current]);
      return { ok: true as const, document: record };
    }

    await admin.storage.from(BUCKET).remove([filePath]);
    return {
      ok: false as const,
      error: insertErr?.message || "Could not save document metadata.",
    };
  });

export const removeDocument = createServerFn({ method: "POST" })
  .validator(
    (input: {
      doc: DocumentRecord;
      role: RoleType | undefined;
      actorName?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const canDelete =
      data.role === "super_admin" ||
      (data.actorName && data.doc.uploaded_by === data.actorName);
    if (!canDelete) {
      return { ok: false as const, error: "You cannot delete this document." };
    }

    const admin = await ensureDocumentsBucket();
    await admin.storage.from(BUCKET).remove([data.doc.file_path]);

    const { error } = await admin.from("documents").delete().eq("id", data.doc.id);
    if (!error) {
      return { ok: true as const };
    }
    if (isMissingTable(error)) {
      const current = await readManifest(admin);
      await writeManifest(
        admin,
        current.filter((d) => d.id !== data.doc.id),
      );
      return { ok: true as const };
    }
    return { ok: false as const, error: error.message };
  });

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function fetchDocuments(
  companyId: CompanyId,
  role: RoleType | undefined,
): Promise<DocumentRecord[]> {
  return listDocuments({ data: { companyId, role } });
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

  const base64 = await fileToBase64(payload.file);
  const result = await saveDocument({
    data: {
      base64,
      fileName: payload.file.name,
      mimeType: payload.file.type || "application/octet-stream",
      fileSize: payload.file.size,
      title: payload.title,
      category: payload.category,
      companyId: payload.companyId,
      notes: payload.notes,
      uploadedBy: payload.uploadedBy,
      uploadedByRole: payload.uploadedByRole,
    },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.document;
}

export async function deleteDocument(
  doc: DocumentRecord,
  opts?: { role?: RoleType; actorName?: string },
): Promise<void> {
  const result = await removeDocument({
    data: {
      doc,
      role: opts?.role,
      actorName: opts?.actorName,
    },
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
}
