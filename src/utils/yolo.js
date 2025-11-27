export function parseYoloTxt(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((l) => {
    const [cls, x, y, w, h] = l.trim().split(/\s+/).map(Number);
    return { cls, x, y, w, h };
  });
}
export function toYoloTxt(objs) {
  const fix = (n) => Number(n).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return (objs || [])
    .map((b) => [b.cls ?? 0, fix(b.x), fix(b.y), fix(b.w), fix(b.h)].join(" "))
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
