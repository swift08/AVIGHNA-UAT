import {
  emptyCoaExtraction,
  finalizeCoaExtraction,
  heuristicExtractFromText,
  mergeCoaExtractions,
  type CoaExtraction,
} from "./coa-ocr";

function extractionHasSignal(extraction: CoaExtraction) {
  return Boolean(
    extraction.productName.value ||
      extraction.batchNumber.value ||
      extraction.dispatchQuantity.value ||
      extraction.packageCount.value ||
      extraction.qualityParameters.length,
  );
}

function ocrErrorMessage(err: unknown) {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return "Browser OCR failed.";
}

export function isCoaImageFile(file: File) {
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || "");
}

export function guessCoaMimeType(file: File) {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type === "image/jpg" ? "image/jpeg" : file.type;
  }
  const name = file.name || "";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  return "image/jpeg";
}

/** Downscale large phone photos so browser OCR stays fast and accurate. */
async function prepareImageForOcr(file: File): Promise<Blob> {
  if (typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxW = 2200;
    const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.filter = "grayscale(1) contrast(1.15)";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    return blob || file;
  } catch {
    return file;
  }
}

/**
 * Load worker/core/lang from our own origin.
 * Hosted CSP blocks jsDelivr/tessdata CDN (script-src/connect-src 'self' only).
 */
async function createOcrWorker() {
  const { createWorker, OEM } = await import("tesseract.js");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) {
    throw new Error("Browser OCR requires a window origin.");
  }

  const langProbe = await fetch(`${origin}/tessdata/eng.traineddata`, {
    method: "HEAD",
  }).catch(() => null);
  const langOk =
    Boolean(langProbe?.ok) &&
    Number(langProbe?.headers.get("content-length") || 0) > 100000;
  if (!langOk) {
    throw new Error(
      "OCR language model missing at /tessdata/eng.traineddata. Redeploy with tessdata included.",
    );
  }

  return createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${origin}/tesseract/worker.min.js`,
    // Directory URL — tesseract picks simd-lstm / lstm builds from here.
    corePath: `${origin}/tesseract`,
    langPath: `${origin}/tessdata`,
    gzip: false,
    cacheMethod: "none",
    logger: () => {},
  });
}

/**
 * Browser-side Tesseract OCR for hosted sites (Vercel serverless cannot run
 * multi-pass Node OCR reliably).
 */
export async function extractCoaInBrowser(file: File): Promise<{
  extraction: CoaExtraction;
  text: string;
  engine: "browser" | "empty";
  error?: string;
}> {
  if (!isCoaImageFile(file)) {
    return {
      extraction: emptyCoaExtraction(),
      text: "",
      engine: "empty",
      error: "Only image COA files can be OCR’d in the browser.",
    };
  }

  const prepared = await prepareImageForOcr(file);
  let worker: Awaited<ReturnType<typeof createOcrWorker>> | null = null;

  try {
    worker = await createOcrWorker();
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
    const pass1 = await worker.recognize(prepared);
    let texts = [pass1.data.text || ""].filter(Boolean);

    const weak =
      texts.join(" ").length < 80 ||
      !/(product|batch|dextrose|sunmalt|maltodextrin|quantity|manufactur|coa|analysis)/i.test(
        texts.join(" "),
      );
    if (weak) {
      await worker.setParameters({
        tessedit_pageseg_mode: "3",
        preserve_interword_spaces: "1",
      });
      const pass2 = await worker.recognize(prepared);
      texts = [...texts, pass2.data.text || ""].filter(Boolean);
    }

    const corpus = texts.join("\n");
    let extraction = emptyCoaExtraction();
    for (const text of texts) {
      extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(text));
    }
    extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(corpus));
    extraction = finalizeCoaExtraction(extraction, corpus);

    if (!extractionHasSignal(extraction)) {
      return {
        extraction: emptyCoaExtraction(),
        text: corpus,
        engine: "empty",
        error: corpus.trim()
          ? "OCR read text but could not map product/batch fields. Fill them manually."
          : "OCR returned no text. Use a clearer, well-lit photo of the full COA.",
      };
    }
    return { extraction, text: corpus, engine: "browser" };
  } catch (err) {
    const message = ocrErrorMessage(err);
    console.error("COA browser OCR error:", err);
    return {
      extraction: emptyCoaExtraction(),
      text: "",
      engine: "empty",
      error: message,
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore terminate errors
      }
    }
  }
}
