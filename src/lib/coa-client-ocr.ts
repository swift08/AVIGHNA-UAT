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

async function createOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  const localLang = `${window.location.origin}/tessdata`;
  // 1) Prefer bundled model on our host
  try {
    const probe = await fetch(`${localLang}/eng.traineddata`, { method: "HEAD" });
    if (probe.ok) {
      return createWorker("eng", 1, {
        langPath: localLang,
        gzip: false,
        cacheMethod: "none",
      });
    }
  } catch {
    // fall through to CDN
  }
  // 2) Default CDN language pack from tesseract.js
  return createWorker("eng", 1, {
    cacheMethod: "none",
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
    return { extraction: emptyCoaExtraction(), text: "", engine: "empty" };
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

    // Second layout pass only if first pass looks weak.
    const weak =
      texts.join(" ").length < 80 ||
      !/(product|batch|dextrose|sunmalt|maltodextrin|quantity|manufactur)/i.test(texts.join(" "));
    if (weak) {
      await worker.setParameters({
        tessedit_pageseg_mode: "4",
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
          ? "OCR read the image but could not map product/batch fields. Fill them manually."
          : "OCR returned no text from this image. Try a clearer photo.",
      };
    }
    return { extraction, text: corpus, engine: "browser" };
  } catch (err) {
    return {
      extraction: emptyCoaExtraction(),
      text: "",
      engine: "empty",
      error: err instanceof Error ? err.message : "Browser OCR failed.",
    };
  } finally {
    if (worker) await worker.terminate();
  }
}
