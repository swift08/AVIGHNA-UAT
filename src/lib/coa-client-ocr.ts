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
 * Vite production builds often break tesseract's relative worker/core paths.
 * Always load worker + core from jsDelivr; prefer our hosted eng.traineddata.
 */
async function createOcrWorker() {
  const { createWorker, OEM } = await import("tesseract.js");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let useLocalLang = false;
  if (origin) {
    try {
      const probe = await fetch(`${origin}/tessdata/eng.traineddata`, { method: "HEAD" });
      useLocalLang = probe.ok && Number(probe.headers.get("content-length") || 0) > 100000;
    } catch {
      useLocalLang = false;
    }
  }

  return createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
    ...(useLocalLang
      ? {
          langPath: `${origin}/tessdata`,
          gzip: false,
        }
      : {
          // Official default language CDN used by tesseract.js
          langPath: "https://tessdata.projectnaptha.com/4.0.0",
          gzip: true,
        }),
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
    const message = err instanceof Error ? err.message : "Browser OCR failed.";
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
