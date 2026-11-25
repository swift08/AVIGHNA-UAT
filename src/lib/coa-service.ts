import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText, Output } from "ai";
import {
  coaExtractionSchema,
  emptyCoaExtraction,
  finalizeCoaExtraction,
  heuristicExtractFromText,
  mergeCoaExtractions,
  normalizeDateValue,
  parseQuantityNumber,
  resolvedReceiveQuantity,
  skuFromName,
  validateCoaFile,
  type CoaExtraction,
} from "./coa-ocr";
import type { RoleType } from "./auth-service";

const COA_BUCKET = "coa-docs";
const COA_BUCKET_OPTIONS = {
  public: false as const,
  fileSizeLimit: 8 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
};

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

function canImportCoa(role: RoleType | undefined) {
  return role === "super_admin" || role === "supervisor";
}

/** OCR/read-only — Accounts may extract invoice fields from Documents uploads. */
function canExtractDocument(role: RoleType | undefined) {
  return role === "super_admin" || role === "supervisor" || role === "accounts";
}

function normalizeProductKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashCoaBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function findExistingProduct(
  admin: ReturnType<typeof adminClient>,
  companyId: string,
  productName: string,
) {
  const { data: rows, error } = await admin
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .limit(200);
  if (error) throw new Error(error.message);
  const target = normalizeProductKey(productName);
  if (!target) return null;
  const exact = (rows || []).find((p) => normalizeProductKey(String(p.name || "")) === target);
  if (exact) return exact;
  // Soft match for Ambuja names (dextrose / sunmalt) so OCR punctuation differences don't recreate.
  return (
    (rows || []).find((p) => {
      const key = normalizeProductKey(String(p.name || ""));
      return key.includes(target) || target.includes(key);
    }) || null
  );
}

async function ensureCoaBucket() {
  const admin = adminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  const existing = buckets?.find((b) => b.name === COA_BUCKET || b.id === COA_BUCKET);
  if (!existing) {
    const { error } = await admin.storage.createBucket(COA_BUCKET, COA_BUCKET_OPTIONS);
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  }
  await admin.storage.updateBucket(COA_BUCKET, COA_BUCKET_OPTIONS);
  return admin;
}

function decodeBase64(input: string) {
  const clean = input.replace(/^data:[^;]+;base64,/i, "").trim();
  return Buffer.from(clean, "base64");
}

function extractionHasSignal(extraction: CoaExtraction) {
  return Boolean(
    extraction.productName.value ||
      extraction.batchNumber.value ||
      extraction.dispatchQuantity.value ||
      extraction.packageCount.value ||
      extraction.qualityParameters.length,
  );
}

async function extractWithAi(bytes: Buffer, mimeType: string): Promise<CoaExtraction | null> {
  // Only use explicit keys on hosted sites. VERCEL_OIDC_TOKEN alone often hits
  // "model not found" when AI Gateway is not enabled for the project.
  const hasGateway = Boolean(process.env["AI_GATEWAY_API_KEY"]);
  const hasOpenAi = Boolean(process.env["OPENAI_API_KEY"]);
  if (!hasGateway && !hasOpenAi) return null;

  const model = process.env["COA_OCR_MODEL"] || "openai/gpt-4o";
  const mediaType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  const isPdf = mediaType === "application/pdf";

  const result = await generateText({
    model,
    output: Output.object({ schema: coaExtractionSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract Certificate of Analysis (COA) or supplier Purchase / Tax Invoice data from this document.
Return only values that are visibly present. Use null when missing — never invent values.
Prefer ISO dates (YYYY-MM-DD) when possible.
Extract tabular quality parameters with specification and result columns when present (COA).
For bags × weight (e.g. 216 Bags × 25 KG), fill packageCount, packageWeight, packageUnit and total quantity fields.
For purchase / tax invoices (Tally etc.): put line Qty into dispatchQuantity + unit, and Grand Total / Invoice Total (₹) into invoiceAmount (digits only, no currency symbol).
Also extract: invoiceNumber (Supplier Invoice No. / Invoice No., e.g. MH0026113992), ewayBillNumber (e-Way Bill No., usually 12 digits — if glued to invoice no., split them), invoiceDate (Supplier Invoice date as YYYY-MM-DD).`,
          },
          isPdf
            ? { type: "file" as const, data: bytes, mediaType: "application/pdf" as const }
            : { type: "image" as const, image: bytes },
        ],
      },
    ],
  });

  return finalizeCoaExtraction(coaExtractionSchema.parse(result.output));
}

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

let sharedOcrWorker: TesseractWorker | null = null;
let sharedOcrWorkerPromise: Promise<TesseractWorker> | null = null;

function resolveTessdataPath() {
  const candidates = [
    path.join(process.cwd(), "tessdata"),
    path.join(process.cwd(), "public", "tessdata"),
    // Relative to compiled server module when Nitro/Vercel copies assets
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../tessdata"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "eng.traineddata"))) return dir;
  }

  // On Vercel the static file is served from /tessdata (public/). Tesseract can load via HTTPS.
  const host = process.env["VERCEL_PROJECT_PRODUCTION_URL"] || process.env["VERCEL_URL"];
  if (host) {
    return `https://${host.replace(/^https?:\/\//, "")}/tessdata`;
  }

  return path.join(process.cwd(), "tessdata");
}

/** Built-in OCR model (Tesseract) — bundled lang file, no API key / CDN download. */
async function getLocalOcrWorker() {
  if (sharedOcrWorker) return sharedOcrWorker;
  if (!sharedOcrWorkerPromise) {
    sharedOcrWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const langPath = resolveTessdataPath();
      const isRemote = /^https?:\/\//i.test(langPath);
      if (!isRemote && !existsSync(path.join(langPath, "eng.traineddata"))) {
        sharedOcrWorkerPromise = null;
        throw new Error(
          `OCR language model not found at ${langPath}/eng.traineddata. Redeploy with tessdata included.`,
        );
      }
      const cachePath =
        process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"] ? "/tmp" : langPath;
      try {
        const worker = await createWorker("eng", 1, {
          langPath,
          cachePath,
          gzip: false,
          cacheMethod: isRemote ? "write" : "none",
        });
        await worker.setParameters({
          preserve_interword_spaces: "1",
        });
        sharedOcrWorker = worker;
        return worker;
      } catch (err) {
        sharedOcrWorkerPromise = null;
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Local OCR model failed to load (${message}).`);
      }
    })();
  }
  return sharedOcrWorkerPromise;
}

async function tesseractText(image: Buffer, pageSegMode: "6" | "4" = "6"): Promise<string> {
  const worker = await getLocalOcrWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
    preserve_interword_spaces: "1",
  });
  const result = await worker.recognize(image);
  return result.data.text || "";
}

/** Split photo into header / full / table bands — Ambuja COAs read much better this way. */
async function buildCoaImageRegions(bytes: Buffer): Promise<Buffer[]> {
  const sharp = (await import("sharp")).default;
  const rotated = sharp(bytes).rotate();
  const meta = await rotated.metadata();
  const width = meta.width || 2000;
  const height = meta.height || 2800;
  const headerH = Math.max(200, Math.floor(height * 0.34));
  const tableTop = Math.floor(height * 0.26);
  const tableH = Math.max(200, Math.floor(height * 0.58));

  const enhance = (img: ReturnType<typeof sharp>) =>
    img.resize({ width: 2600, withoutEnlargement: false }).grayscale().normalize().sharpen().png().toBuffer();

  return Promise.all([
    enhance(rotated.clone()),
    enhance(rotated.clone().extract({ left: 0, top: 0, width, height: headerH })),
    enhance(
      rotated
        .clone()
        .extract({ left: 0, top: tableTop, width, height: Math.min(tableH, height - tableTop) })
        .linear(1.2, -8),
    ),
  ]);
}

function missingCriticalCount(extraction: CoaExtraction) {
  let missing = 0;
  if (!extraction.productName.value) missing += 1;
  if (!extraction.batchNumber.value) missing += 1;
  if (
    !extraction.dispatchQuantity.value &&
    !extraction.batchQuantity.value &&
    !extraction.packageCount.value
  ) {
    missing += 1;
  }
  return missing;
}

function isVercelRuntime() {
  return Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]);
}

/** Default COA OCR: PDF text always; Node Tesseract only on local/dev (not Vercel). */
async function extractWithLocalOcr(bytes: Buffer, mimeType: string): Promise<CoaExtraction | null> {
  if (mimeType === "application/pdf") {
    let text = "";
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      try {
        const parsed = await parser.getText();
        text = parsed.text || "";
      } finally {
        await parser.destroy?.();
      }
    } catch (err) {
      console.warn("COA pdf-parse failed:", err instanceof Error ? err.message : err);
      text = bytes.toString("latin1").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
    }
    if (!text.trim()) return null;
    const extraction = finalizeCoaExtraction(heuristicExtractFromText(text), text);
    return extractionHasSignal(extraction) ? extraction : null;
  }

  if (!mimeType.startsWith("image/")) return null;

  // tesseract.js uses __dirname internally and crashes on Vercel ESM serverless.
  // Hosted image OCR must run in the browser and send ocrText.
  if (isVercelRuntime()) {
    return null;
  }

  try {
    const texts: string[] = [];
    // Fast first pass on original
    texts.push(await tesseractText(bytes, "6"));
    try {
      const regions = await buildCoaImageRegions(bytes);
      for (const region of regions) {
        texts.push(await tesseractText(region, "6"));
      }
      // Second pass on header with sparse text mode
      if (regions[1]) texts.push(await tesseractText(regions[1], "4"));
    } catch (err) {
      console.warn("COA image region OCR failed:", err instanceof Error ? err.message : err);
    }

    const corpus = texts.join("\n");
    let extraction = emptyCoaExtraction();
    for (const text of texts) {
      if (!text.trim()) continue;
      extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(text));
    }
    extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(corpus));
    extraction = finalizeCoaExtraction(extraction, corpus);
    return extractionHasSignal(extraction) ? extraction : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("COA local OCR failed:", message);
    return null;
  }
}

export const extractCoaDocument = createServerFn({ method: "POST" })
  .validator(
    (input: {
      actorRole: RoleType;
      fileName: string;
      mimeType: string;
      base64: string;
      companyId: string;
      /** Browser OCR text — preferred on hosted Vercel where Node Tesseract is unreliable. */
      ocrText?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!canExtractDocument(data.actorRole)) {
      return {
        ok: false as const,
        error: "Only Super Admin, Supervisor, or Accounts can read document fields.",
      };
    }
    const mime = data.mimeType === "image/jpg" ? "image/jpeg" : data.mimeType;
    const bytes = decodeBase64(data.base64);
    // Allow Documents vault files up to 20 MB (COA import UI still targets ≤8 MB).
    const mimeCheck = validateCoaFile(mime, Math.min(bytes.length, 8 * 1024 * 1024));
    if (mimeCheck && !/under 8 MB/i.test(mimeCheck)) {
      return { ok: false as const, error: mimeCheck };
    }
    if (bytes.length <= 0 || bytes.length > 20 * 1024 * 1024) {
      return { ok: false as const, error: "File must be under 20 MB." };
    }

    try {
      let extraction: CoaExtraction | null = null;
      let engine: "browser" | "local" | "ai" | "empty" = "empty";

      // Prefer client-provided OCR text (works on hosted sites).
      if (data.ocrText && data.ocrText.trim()) {
        extraction = finalizeCoaExtraction(
          heuristicExtractFromText(data.ocrText),
          data.ocrText,
        );
        if (extractionHasSignal(extraction)) engine = "browser";
        else extraction = null;
      }

      // Server fallback for PDFs / when browser OCR was empty.
      if (!extraction) {
        extraction = await extractWithLocalOcr(bytes, mime);
        if (extraction) engine = "local";
      }

      // Optional cloud boost only when a key exists and local left critical gaps.
      const needsBoost = !extraction || missingCriticalCount(extraction) > 0;
      if (needsBoost) {
        try {
          const aiExtraction = await extractWithAi(bytes, mime);
          if (aiExtraction && extractionHasSignal(aiExtraction)) {
            extraction = extraction
              ? mergeCoaExtractions(extraction, aiExtraction)
              : aiExtraction;
            engine = "ai";
          }
        } catch (err) {
          console.warn("COA AI extraction failed:", err instanceof Error ? err.message : err);
        }
      }

      if (!extraction) {
        extraction = emptyCoaExtraction();
        engine = "empty";
      }

      const gaps = missingCriticalCount(extraction);
      return {
        ok: true as const,
        extraction,
        engine,
        previewMime: mime,
        warning:
          engine === "empty"
            ? isVercelRuntime() && mime.startsWith("image/")
              ? "On-device OCR did not return usable text. Use a clearer photo, or fill fields manually."
              : "Could not auto-read this COA. Fill the fields manually, then confirm."
            : gaps > 0
              ? "Some key fields need a quick check before confirming."
              : null,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "COA extraction failed.",
      };
    }
  });

export type CoaConfirmPayload = {
  actorRole: RoleType;
  actorName: string;
  companyId: string;
  fileName: string;
  mimeType: string;
  base64: string;
  extraction: CoaExtraction;
  unitPrice?: number;
  wholesalePrice?: number;
  category?: string;
  productCode?: string;
};

export const confirmCoaImport = createServerFn({ method: "POST" })
  .validator((input: CoaConfirmPayload) => input)
  .handler(async ({ data }) => {
    if (!canImportCoa(data.actorRole)) {
      return { ok: false as const, error: "Only Super Admin or Supervisor can import from COA." };
    }

    const productName = data.extraction.productName.value?.trim();
    const batchNumber = data.extraction.batchNumber.value?.trim();
    if (!productName) return { ok: false as const, error: "Product name is required." };
    if (!batchNumber) return { ok: false as const, error: "Batch number is required." };

    const companyId = data.companyId === "all" ? "asian" : data.companyId;
    const mime = data.mimeType === "image/jpg" ? "image/jpeg" : data.mimeType;
    const bytes = decodeBase64(data.base64);
    const invalid = validateCoaFile(mime, bytes.length);
    if (invalid) return { ok: false as const, error: invalid };

    const qty = resolvedReceiveQuantity(data.extraction);
    if (qty.quantity <= 0) {
      return { ok: false as const, error: "Received quantity must be greater than zero." };
    }

    const mfg = normalizeDateValue(data.extraction.manufacturingDate.value);
    const exp = normalizeDateValue(data.extraction.expiryDate.value);
    if (data.extraction.manufacturingDate.value && !mfg) {
      return { ok: false as const, error: "Manufacturing date is invalid." };
    }
    if (data.extraction.expiryDate.value && !exp) {
      return { ok: false as const, error: "Expiry date is invalid." };
    }

    const admin = await ensureCoaBucket();
    const contentHash = hashCoaBytes(bytes);

    // Same COA image/file must not create stock again for this company.
    const { data: sameFile } = await admin
      .from("product_batches")
      .select("id, batch_number, product_id")
      .eq("company_id", companyId)
      .eq("coa_content_hash", contentHash)
      .maybeSingle();
    if (sameFile) {
      return {
        ok: false as const,
        error: `This COA file was already imported as batch ${sameFile.batch_number}. Duplicate stock was not created.`,
      };
    }

    let product: Record<string, unknown> | null = null;
    try {
      product = await findExistingProduct(admin, companyId, productName);
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Product lookup failed." };
    }
    let createdProduct = false;

    if (!product) {
      const code = (data.productCode || skuFromName(productName)).trim();
      const selling = Number(data.unitPrice) || 1;
      const wholesale = Number(data.wholesalePrice) || selling;
      const { data: created, error: createErr } = await admin
        .from("products")
        .insert({
          company_id: companyId,
          code,
          name: productName,
          category: data.category || data.extraction.productGrade.value || "COA Import",
          unit: qty.unit,
          unit_price: selling,
          wholesale_price: wholesale,
          on_hand: 0,
          reserved: 0,
          reorder_level: 20,
        })
        .select()
        .single();
      if (createErr || !created) {
        return { ok: false as const, error: createErr?.message || "Could not create product." };
      }
      product = created as Record<string, unknown>;
      createdProduct = true;
      await admin.from("audit_logs").insert({
        user_name: data.actorName,
        company_id: companyId,
        module: "inventory",
        action: "product_created",
        record_id: String(product.id),
        description: `${data.actorName} created product from COA: ${productName} (${code})`,
      });
    }

    const productId = String(product.id);
    const productLabel = String(product.name || productName);
    const productOnHand = Number(product.on_hand) || 0;
    const productReserved = Number(product.reserved) || 0;

    const { data: existingBatch, error: batchLookupErr } = await admin
      .from("product_batches")
      .select("id, batch_number")
      .eq("product_id", productId)
      .eq("batch_number", batchNumber)
      .maybeSingle();
    if (batchLookupErr) {
      const missing = /schema cache|does not exist|Could not find the table/i.test(
        batchLookupErr.message,
      );
      return {
        ok: false as const,
        error: missing
          ? "COA batch tables are not installed yet. Run supabase/migrations/20261115_product_batches_coa.sql in the Supabase SQL editor, then retry."
          : batchLookupErr.message,
      };
    }
    if (existingBatch) {
      return {
        ok: false as const,
        error: `Batch ${batchNumber} already exists for ${productLabel}. Duplicate stock was not created.`,
      };
    }

    const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : "jpg";
    const storagePath = `${companyId}/${productId}/${batchNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage.from(COA_BUCKET).upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploadErr) return { ok: false as const, error: uploadErr.message };

    const { data: batch, error: batchErr } = await admin
      .from("product_batches")
      .insert({
        product_id: productId,
        company_id: companyId,
        batch_number: batchNumber,
        manufacturer_name: data.extraction.manufacturerName.value,
        supplier_name: data.extraction.supplierName.value,
        product_grade: data.extraction.productGrade.value,
        product_description: data.extraction.productDescription.value,
        mfg_date: mfg,
        expiry_date: exp,
        analysis_date: normalizeDateValue(data.extraction.analysisDate.value),
        dispatch_date: normalizeDateValue(data.extraction.dispatchDate.value),
        quantity: qty.quantity,
        unit: qty.unit,
        package_count: parseQuantityNumber(data.extraction.packageCount.value) || null,
        package_weight: parseQuantityNumber(data.extraction.packageWeight.value) || null,
        package_unit: data.extraction.packageUnit.value,
        coa_storage_path: storagePath,
        coa_file_name: data.fileName,
        coa_mime_type: mime,
        coa_content_hash: contentHash,
        ocr_payload: data.extraction,
        notes: data.extraction.coaRemarks.value || data.extraction.notes,
        created_by: data.actorName,
      })
      .select()
      .single();

    if (batchErr || !batch) {
      await admin.storage.from(COA_BUCKET).remove([storagePath]);
      const dupHash = /coa_content_hash|product_batches_company_coa_hash/i.test(batchErr?.message || "");
      return {
        ok: false as const,
        error: dupHash
          ? "This COA file was already imported. Duplicate stock was not created."
          : batchErr?.message || "Could not create batch.",
      };
    }

    const qualityRows = (data.extraction.qualityParameters || [])
      .filter((row) => row.parameterName.trim())
      .map((row, index) => ({
        batch_id: batch.id,
        parameter_name: row.parameterName.trim(),
        specification: row.specification,
        result_value: row.resultValue,
        compliance_status: row.complianceStatus,
        remarks: row.remarks,
        confidence: row.confidence,
        sort_order: index,
      }));
    if (qualityRows.length) {
      await admin.from("batch_quality_results").insert(qualityRows);
    }

    const previousOnHand = productOnHand;
    const newOnHand = previousOnHand + qty.quantity;
    const { error: stockErr } = await admin
      .from("products")
      .update({ on_hand: newOnHand, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (stockErr) return { ok: false as const, error: stockErr.message };

    await admin.from("inventory_logs").insert({
      company_id: companyId,
      product_id: productId,
      transaction_type: "GOODS_RECEIVED",
      quantity: qty.quantity,
      previous_on_hand: previousOnHand,
      new_on_hand: newOnHand,
      previous_reserved: productReserved,
      new_reserved: productReserved,
      reference_type: "product_batch",
      reference_id: batch.id,
      notes: `COA batch ${batchNumber} received`,
    });

    await admin.from("audit_logs").insert({
      user_name: data.actorName,
      company_id: companyId,
      module: "inventory",
      action: "coa_batch_imported",
      record_id: String(batch.id),
      description: `${data.actorName} imported COA batch ${batchNumber} for ${productLabel} (+${qty.quantity} ${qty.unit})`,
    });

    return {
      ok: true as const,
      productId,
      batchId: String(batch.id),
      createdProduct,
      quantity: qty.quantity,
      unit: qty.unit,
      productName: productLabel,
      batchNumber,
    };
  });

export const listProductBatches = createServerFn({ method: "POST" })
  .validator((input: { productId: string }) => input)
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: rows, error } = await admin
      .from("product_batches")
      .select(
        "id, product_id, batch_number, mfg_date, expiry_date, analysis_date, dispatch_date, quantity, unit, package_count, package_weight, package_unit, coa_file_name, coa_storage_path, coa_mime_type, supplier_name, manufacturer_name, product_grade, notes, created_at, purchase_order_id",
      )
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message, batches: [] as const };

    const batchIds = (rows || []).map((r) => r.id);
    let qualityByBatch: Record<string, Array<{ parameter_name: string; specification: string | null; result_value: string | null; compliance_status: string | null }>> = {};
    if (batchIds.length) {
      const { data: quality } = await admin
        .from("batch_quality_results")
        .select("batch_id, parameter_name, specification, result_value, compliance_status, sort_order")
        .in("batch_id", batchIds)
        .order("sort_order", { ascending: true });
      for (const row of quality || []) {
        const key = String(row.batch_id);
        if (!qualityByBatch[key]) qualityByBatch[key] = [];
        qualityByBatch[key].push({
          parameter_name: row.parameter_name,
          specification: row.specification,
          result_value: row.result_value,
          compliance_status: row.compliance_status,
        });
      }
    }

    return {
      ok: true as const,
      batches: (rows || []).map((row) => ({
        ...row,
        has_coa: Boolean(row.coa_storage_path),
        quality: qualityByBatch[String(row.id)] || [],
      })),
    };
  });

/**
 * Attach analysis report / COA to an existing stock batch.
 * Does NOT change product on_hand or batch quantity — report tagging only.
 */
export type AttachAnalysisReportPayload = {
  actorRole: RoleType;
  actorName: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  base64: string;
  extraction: CoaExtraction;
};

export const attachAnalysisReportToBatch = createServerFn({ method: "POST" })
  .validator((input: AttachAnalysisReportPayload) => input)
  .handler(async ({ data }) => {
    if (!canImportCoa(data.actorRole)) {
      return {
        ok: false as const,
        error: "Only Super Admin or Supervisor can attach an analysis report.",
      };
    }

    const mime = data.mimeType === "image/jpg" ? "image/jpeg" : data.mimeType;
    const bytes = decodeBase64(data.base64);
    const invalid = validateCoaFile(mime, bytes.length);
    if (invalid) return { ok: false as const, error: invalid };

    const admin = await ensureCoaBucket();
    const contentHash = hashCoaBytes(bytes);

    const { data: batch, error: batchErr } = await admin
      .from("product_batches")
      .select(
        "id, product_id, company_id, batch_number, quantity, unit, coa_storage_path, coa_content_hash",
      )
      .eq("id", data.batchId)
      .maybeSingle();
    if (batchErr || !batch) {
      return { ok: false as const, error: batchErr?.message || "Batch not found." };
    }
    if (batch.coa_storage_path) {
      return {
        ok: false as const,
        error: `Batch ${batch.batch_number} already has an analysis report attached.`,
      };
    }

    const { data: sameFile } = await admin
      .from("product_batches")
      .select("id, batch_number")
      .eq("company_id", batch.company_id)
      .eq("coa_content_hash", contentHash)
      .maybeSingle();
    if (sameFile) {
      return {
        ok: false as const,
        error: `This report file is already attached to batch ${sameFile.batch_number}.`,
      };
    }

    const mfg = normalizeDateValue(data.extraction.manufacturingDate.value);
    const exp = normalizeDateValue(data.extraction.expiryDate.value);
    if (data.extraction.manufacturingDate.value && !mfg) {
      return { ok: false as const, error: "Manufacturing date is invalid." };
    }
    if (data.extraction.expiryDate.value && !exp) {
      return { ok: false as const, error: "Expiry date is invalid." };
    }

    const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : "jpg";
    const storagePath = `${batch.company_id}/${batch.product_id}/${String(batch.batch_number).replace(/[^a-zA-Z0-9._-]/g, "_")}-report-${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage.from(COA_BUCKET).upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploadErr) return { ok: false as const, error: uploadErr.message };

    const patch: Record<string, unknown> = {
      coa_storage_path: storagePath,
      coa_file_name: data.fileName,
      coa_mime_type: mime,
      coa_content_hash: contentHash,
      ocr_payload: data.extraction,
      updated_at: new Date().toISOString(),
    };
    if (data.extraction.manufacturerName.value) {
      patch.manufacturer_name = data.extraction.manufacturerName.value;
    }
    if (data.extraction.supplierName.value) {
      patch.supplier_name = data.extraction.supplierName.value;
    }
    if (data.extraction.productGrade.value) {
      patch.product_grade = data.extraction.productGrade.value;
    }
    if (data.extraction.productDescription.value) {
      patch.product_description = data.extraction.productDescription.value;
    }
    if (mfg) patch.mfg_date = mfg;
    if (exp) patch.expiry_date = exp;
    const analysisDate = normalizeDateValue(data.extraction.analysisDate.value);
    if (analysisDate) patch.analysis_date = analysisDate;
    const dispatchDate = normalizeDateValue(data.extraction.dispatchDate.value);
    if (dispatchDate) patch.dispatch_date = dispatchDate;
    if (data.extraction.coaRemarks.value || data.extraction.notes) {
      patch.notes = data.extraction.coaRemarks.value || data.extraction.notes;
    }

    const { error: updateErr } = await admin
      .from("product_batches")
      .update(patch)
      .eq("id", batch.id);
    if (updateErr) {
      await admin.storage.from(COA_BUCKET).remove([storagePath]);
      return { ok: false as const, error: updateErr.message };
    }

    await admin.from("batch_quality_results").delete().eq("batch_id", batch.id);
    const qualityRows = (data.extraction.qualityParameters || [])
      .filter((row) => row.parameterName.trim())
      .map((row, index) => ({
        batch_id: batch.id,
        parameter_name: row.parameterName.trim(),
        specification: row.specification,
        result_value: row.resultValue,
        compliance_status: row.complianceStatus,
        remarks: row.remarks,
        confidence: row.confidence,
        sort_order: index,
      }));
    if (qualityRows.length) {
      await admin.from("batch_quality_results").insert(qualityRows);
    }

    await admin.from("audit_logs").insert({
      user_name: data.actorName,
      company_id: batch.company_id,
      module: "inventory",
      action: "analysis_report_attached",
      record_id: String(batch.id),
      description: `${data.actorName} attached analysis report to batch ${batch.batch_number} (stock qty unchanged: ${batch.quantity} ${batch.unit})`,
    });

    return {
      ok: true as const,
      batchId: String(batch.id),
      batchNumber: String(batch.batch_number),
      quantity: Number(batch.quantity) || 0,
      unit: String(batch.unit || "kg"),
    };
  });

/** Signed download URL + share text for a product batch COA report. */
export const getBatchCoaAccess = createServerFn({ method: "POST" })
  .validator((input: { batchId: string; productName?: string }) => input)
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: batch, error } = await admin
      .from("product_batches")
      .select(
        "id, batch_number, mfg_date, expiry_date, analysis_date, dispatch_date, quantity, unit, package_count, package_weight, package_unit, supplier_name, manufacturer_name, product_grade, coa_file_name, coa_storage_path, coa_mime_type, notes",
      )
      .eq("id", data.batchId)
      .maybeSingle();
    if (error || !batch) {
      return { ok: false as const, error: error?.message || "Batch not found." };
    }
    if (!batch.coa_storage_path) {
      return { ok: false as const, error: "No COA document is attached to this batch." };
    }

    const fileName = batch.coa_file_name || `COA-${batch.batch_number}`;
    const [{ data: signedView, error: viewErr }, { data: signedDl, error: dlErr }] =
      await Promise.all([
        admin.storage.from(COA_BUCKET).createSignedUrl(batch.coa_storage_path, 60 * 30),
        admin.storage.from(COA_BUCKET).createSignedUrl(batch.coa_storage_path, 60 * 30, {
          download: fileName,
        }),
      ]);
    const viewUrl = signedView?.signedUrl;
    const downloadUrl = signedDl?.signedUrl || viewUrl;
    if ((!viewUrl && !downloadUrl) || (viewErr && dlErr)) {
      return {
        ok: false as const,
        error: viewErr?.message || dlErr?.message || "Could not create download link.",
      };
    }

    const { data: quality } = await admin
      .from("batch_quality_results")
      .select("parameter_name, specification, result_value, compliance_status")
      .eq("batch_id", batch.id)
      .order("sort_order", { ascending: true });

    const productLabel = data.productName?.trim() || "Product";
    const qtyLine =
      batch.package_count && batch.package_weight
        ? `${batch.quantity} ${batch.unit} (${batch.package_count} × ${batch.package_weight} ${batch.package_unit || "kg"})`
        : `${batch.quantity} ${batch.unit}`;

    const qualityLines = (quality || [])
      .slice(0, 20)
      .map(
        (q) =>
          `- ${q.parameter_name}: ${q.result_value || "—"} (spec: ${q.specification || "—"}${q.compliance_status ? `; ${q.compliance_status}` : ""})`,
      )
      .join("\n");

    const shareText = [
      `COA Report — ${productLabel}`,
      `Batch: ${batch.batch_number}`,
      batch.product_grade ? `Grade: ${batch.product_grade}` : null,
      batch.manufacturer_name ? `Manufacturer: ${batch.manufacturer_name}` : null,
      batch.supplier_name ? `Supplier/Party: ${batch.supplier_name}` : null,
      `Mfg: ${batch.mfg_date || "—"} | Exp: ${batch.expiry_date || "—"}`,
      batch.analysis_date ? `Analysis: ${batch.analysis_date}` : null,
      batch.dispatch_date ? `Dispatch: ${batch.dispatch_date}` : null,
      `Quantity: ${qtyLine}`,
      batch.notes ? `Remarks: ${batch.notes}` : null,
      qualityLines ? `Quality:\n${qualityLines}` : null,
      `COA file: ${batch.coa_file_name || "attached"}`,
      `View / download (valid 30 min): ${viewUrl || downloadUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ok: true as const,
      viewUrl: viewUrl || downloadUrl!,
      downloadUrl: downloadUrl || viewUrl!,
      fileName,
      mimeType: batch.coa_mime_type || "application/octet-stream",
      shareText,
      batchNumber: batch.batch_number,
    };
  });
