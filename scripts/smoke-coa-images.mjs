import { readFileSync, writeFileSync } from "fs";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

async function preprocess(buf) {
  return sharp(buf)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(160)
    .png()
    .toBuffer();
}

const worker = await createWorker("eng", 1, {
  logger: () => {},
});
await worker.setParameters({
  tessedit_pageseg_mode: "6",
  preserve_interword_spaces: "1",
});

for (const name of ["sunmalt-coa.jpg", "dextrose-coa.jpg"]) {
  const raw = readFileSync(`tmp-coa-samples/${name}`);
  const processed = await preprocess(raw);
  writeFileSync(`tmp-coa-samples/${name.replace(".jpg", "-prep.png")}`, processed);
  const { data } = await worker.recognize(processed);
  writeFileSync(`tmp-coa-samples/${name.replace(".jpg", "-ocr2.txt")}`, data.text);
  console.log("====", name, "====");
  console.log(data.text);
  console.log("\n");
}
await worker.terminate();
