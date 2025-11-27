import JSZip from "jszip";
import { saveAs } from "file-saver";
export async function exportAll(pairs) {
  const zip = new JSZip();
  for (const p of pairs) {
    if (!p.annotations) continue;
    const txt = p.annotations
      .map((b) => [b.cls ?? 0, b.x, b.y, b.w, b.h].join(" "))
      .join("\n");
    zip.file(`${p.baseName}.txt`, txt);
  }
  saveAs(await zip.generateAsync({ type: "blob" }), "annotations.zip");
}
