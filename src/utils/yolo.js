export function parseYoloTxt(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((l) => {
    const parts = l.trim().split(/\s+/);

    // New format: <OCR_text> <cls> <x> <y> <w> <h> <IDS>
    // Old format: <cls> <x> <y> <w> <h>

    // Check if first part is a number (old format) or text (new format)
    const firstIsNumber = !isNaN(parseFloat(parts[0])) && parts.length <= 5;

    if (firstIsNumber && parts.length === 5) {
      // Old format: cls x y w h
      const [cls, x, y, w, h] = parts.map(Number);
      return { cls, x, y, w, h };
    } else {
      // New format: ocrText cls x y w h ids
      const ocrText = parts[0];
      const cls = Number(parts[1]);
      const x = Number(parts[2]);
      const y = Number(parts[3]);
      const w = Number(parts[4]);
      const h = Number(parts[5]);
      const ids = parts[6] || "";

      return { cls, x, y, w, h, ocrText, ids };
    }
  });
}
export function toYoloTxt(objs) {
  const fix = (n) => Number(n).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return (objs || [])
    .map((b) => {
      // Format: <OCR_text> <cls> <x> <y> <w> <h> <IDS>
      const ocrText = b.ocrText || "—"; // Use '—' if no OCR result
      const ids = b.ids || "";
      const parts = [
        ocrText,
        b.cls ?? 0,
        fix(b.x),
        fix(b.y),
        fix(b.w),
        fix(b.h),
      ];

      // Only add IDS if it exists
      if (ids) {
        parts.push(ids);
      }

      return parts.join(" ");
    })
    .join("\n");
}
export const absToNorm = (r, W, H) => ({
  x: (r.x + r.w / 2) / W,
  y: (r.y + r.h / 2) / H,
  w: r.w / W,
  h: r.h / H,
});
export const normToAbs = (b, W, H) => ({
  x: b.x * W - (b.w * W) / 2,
  y: b.y * H - (b.h * H) / 2,
  w: b.w * W,
  h: b.h * H,
});
