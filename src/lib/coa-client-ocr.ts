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
 * Browser-side Tesseract OCR for hosted sites (Vercel serverless cannot run
 * multi-pass Node OCR reliably). Uses /tessdata/eng.traineddata from public/.
 */
export async function extractCoaInBrowser(file: File): Promise<{
  extraction: CoaExtraction;
  text: string;
  engine: "browser" | "empty";
}> {
  if (!file.type.startsWith("image/")) {
    return { extraction: emptyCoaExtraction(), text: "", engine: "empty" };
  }

  const { createWorker } = await import("tesseract.js");
  const langPath = `${window.location.origin}/tessdata`;
  const prepared = await prepareImageForOcr(file);
  const worker = await createWorker("eng", 1, {
    langPath,
    gzip: false,
    cacheMethod: "none",
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
    const pass1 = await worker.recognize(prepared);
    await worker.setParameters({
      tessedit_pageseg_mode: "4",
      preserve_interword_spaces: "1",
    });
    const pass2 = await worker.recognize(prepared);
    const texts = [pass1.data.text || "", pass2.data.text || ""].filter(Boolean);
    const corpus = texts.join("\n");

    let extraction = emptyCoaExtraction();
    for (const text of texts) {
      extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(text));
    }
    extraction = mergeCoaExtractions(extraction, heuristicExtractFromText(corpus));
    extraction = finalizeCoaExtraction(extraction, corpus);

    if (!extractionHasSignal(extraction)) {
      return { extraction: emptyCoaExtraction(), text: corpus, engine: "empty" };
    }
    return { extraction, text: corpus, engine: "browser" };
  } finally {
    await worker.terminate();
  }
}
