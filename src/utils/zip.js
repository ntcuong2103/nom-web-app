import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toYoloTxt } from "./yolo.js";

export async function exportAll(pairs) {
  // If only one file, export directly as txt
  if (pairs.length === 1) {
    const p = pairs[0];
    if (p.annotations) {
      const txt = toYoloTxt(p.annotations);
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `${p.baseName}.txt`);
    }
    return;
  }

  // Multiple files: export as zip
  const zip = new JSZip();
  for (const p of pairs) {
    if (!p.annotations) continue;
    const txt = toYoloTxt(p.annotations);
    zip.file(`${p.baseName}.txt`, txt);
  }
  saveAs(await zip.generateAsync({ type: "blob" }), "annotations.zip");
}
