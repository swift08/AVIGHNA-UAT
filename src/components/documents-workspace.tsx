import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileImage,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspace } from "./workspace-provider";
import { DocumentExtractReviewSheet } from "./document-extract-review";
import { companies, type CompanyId } from "@/lib/workspace-data";
import {
  DOCUMENT_CATEGORIES,
  deleteDocument,
  fetchDocuments,
  uploadableCategoriesForRole,
  visibleCategoriesForRole,
  type DocumentCategory,
  type DocumentRecord,
} from "@/lib/documents-service";

function formatSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsWorkspace() {
  const { company, currentUser } = useWorkspace();
  const role = currentUser?.role;

  const visibleCategories = useMemo(() => visibleCategoriesForRole(role), [role]);
  const uploadableCategories = useMemo(() => uploadableCategoriesForRole(role), [role]);

  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "all">("all");
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Upload sheet state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(
    uploadableCategories[0]?.id || "coa",
  );
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCompany, setUploadCompany] = useState<CompanyId>(company);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // OCR confirm sheet
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewCategory, setReviewCategory] = useState<DocumentCategory>("coa");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewCompany, setReviewCompany] = useState<CompanyId>(company);
  const [reviewNotes, setReviewNotes] = useState("");

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    setUploadCompany(company);
  }, [company]);

  useEffect(() => {
    if (uploadableCategories.length > 0 && !uploadableCategories.some((c) => c.id === uploadCategory)) {
      setUploadCategory(uploadableCategories[0]!.id);
    }
  }, [uploadableCategories, uploadCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchDocuments(company, role);
      setDocs(list);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [company, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (activeCategory !== "all" && d.category !== activeCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.notes || "").toLowerCase().includes(q) ||
        d.uploaded_by.toLowerCase().includes(q)
      );
    });
  }, [docs, activeCategory, search]);

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      toast.error("Please enter a document title");
      return;
    }
    if (!uploadFile) {
      toast.error("Please choose a PDF or image file");
      return;
    }
    if (!role) return;

    setReviewFile(uploadFile);
    setReviewCategory(uploadCategory);
    setReviewTitle(uploadTitle.trim());
    setReviewCompany(uploadCompany);
    setReviewNotes(uploadNotes.trim());
    setUploadOpen(false);
    setReviewOpen(true);
  };

  const handleReviewCompleted = async () => {
    setUploadTitle("");
    setUploadNotes("");
    setUploadFile(null);
    setReviewFile(null);
    await load();
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`Permanently delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc, {
        ...(role ? { role } : {}),
        ...(currentUser?.name ? { actorName: currentUser.name } : {}),
      });
      toast.success("Document deleted");
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
    } catch (err) {
      toast.error("Could not delete document", {
        description: err instanceof Error ? err.message : "Delete failed.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Document Vault
          </p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload → auto-read → confirm details. Purchase invoices also receive stock against a PO.
            Record supplier and customer payments later on Accounts.
          </p>
        </div>
        {uploadableCategories.length > 0 && (
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold cursor-pointer"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="size-3.5" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Category tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({docs.length})
          </button>
          {visibleCategories.map((cat) => {
            const count = docs.filter((d) => d.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.shortLabel} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or filename..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-xs font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Documents grid */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-xs text-muted-foreground">
          Loading documents...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-2">
          <FolderOpen className="size-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-bold text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground">
            {uploadableCategories.length > 0
              ? 'Click "Upload Document" — we read the file and ask you to confirm the details.'
              : "Documents shared with your role will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const cat = DOCUMENT_CATEGORIES.find((c) => c.id === doc.category);
            const isPdf = doc.mime_type.includes("pdf") || doc.file_name.toLowerCase().endsWith(".pdf");
            const companyLabel =
              doc.company_id === "all"
                ? "All Companies"
                : companies.find((c) => c.id === doc.company_id)?.short || doc.company_id;
            const canDelete =
              role === "super_admin" ||
              (currentUser?.name && doc.uploaded_by === currentUser.name);

            return (
              <article
                key={doc.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      {isPdf ? <FileText className="size-3" /> : <FileImage className="size-3" />}
                      {cat?.shortLabel || doc.category}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {companyLabel}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground leading-snug">{doc.title}</h3>
                  <p className="text-[11px] text-muted-foreground truncate" title={doc.file_name}>
                    {doc.file_name} · {formatSize(doc.file_size)}
                  </p>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.notes}</p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">
                    By {doc.uploaded_by} · {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1 cursor-pointer"
                      onClick={() => setPreviewDoc(doc)}
                      title="Preview"
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      download={doc.file_name}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Download"
                    >
                      <Download className="size-3.5" />
                    </a>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={() => handleDelete(doc)}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* UPLOAD DOCUMENT SHEET */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Upload Document</SheetTitle>
            <SheetDescription>
              We read the full PDF or image, then ask you to confirm every field. Purchase invoices
              also receive stock against a PO. Payments stay on Accounts.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpload} className="mt-6 space-y-4">
            <label className="drawer-field">
              Document Category <span className="text-destructive">*</span>
              <select
                required
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
              >
                {uploadableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {DOCUMENT_CATEGORIES.find((c) => c.id === uploadCategory)?.description}
              </span>
            </label>

            <label className="drawer-field">
              Title <span className="text-destructive">*</span>
              <input
                required
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Culture FD-DVS CHN-11 Batch #402 COA"
              />
            </label>

            <label className="drawer-field">
              Company
              <select
                value={uploadCompany}
                onChange={(e) => setUploadCompany(e.target.value as CompanyId)}
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="drawer-field">
              File (PDF or Image) <span className="text-destructive">*</span>
              <input
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </label>

            <label className="drawer-field">
              Notes / Reference (Optional)
              <input
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Batch no., PO/Invoice ref, or remarks"
              />
            </label>

            <Button type="submit" className="w-full gap-1.5 cursor-pointer">
              <Upload className="size-3.5" />
              Read & confirm details
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <DocumentExtractReviewSheet
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setReviewFile(null);
        }}
        file={reviewFile}
        category={reviewCategory}
        title={reviewTitle}
        companyId={reviewCompany}
        notes={reviewNotes}
        actorRole={role}
        actorName={currentUser?.name || "User"}
        onCompleted={() => {
          void handleReviewCompleted();
        }}
      />

      {/* PREVIEW MODAL */}
      <Sheet open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{previewDoc?.title}</SheetTitle>
            <SheetDescription>
              {previewDoc?.file_name} · Uploaded by {previewDoc?.uploaded_by}
            </SheetDescription>
          </SheetHeader>
          {previewDoc && (
            <div className="mt-4 space-y-3">
              {previewDoc.mime_type.includes("pdf") ||
              previewDoc.file_name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewDoc.file_url}
                  title={previewDoc.title}
                  className="w-full h-[70vh] rounded-lg border border-border bg-muted/20"
                />
              ) : (
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.title}
                  className="w-full max-h-[70vh] object-contain rounded-lg border border-border bg-muted/20"
                />
              )}
              <div className="flex justify-end">
                <a
                  href={previewDoc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  download={previewDoc.file_name}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="size-3.5" />
                  Download Original
                </a>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
