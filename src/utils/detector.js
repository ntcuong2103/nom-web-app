export async function remoteDetect(endpointUrl, file) {
  if (!endpointUrl) return null;
  const fd = new FormData();
  fd.append("image", file);
  const r = await fetch(endpointUrl, { method: "POST", body: fd });
  if (!r.ok) throw new Error("Remote detect failed " + r.status);
  const js = await r.json();
  return js?.boxes || null; // YOLO normalized
}
export function localGridDetect() {
  const cols = 12,
    rows = 18,
    padX = 0.08,
    padY = 0.07;
  const usableW = 1 - padX * 2,
    usableH = 1 - padY * 2;
  const cellW = (usableW / cols) * 0.7,
    cellH = (usableH / rows) * 0.9;
  const strideX = usableW / cols,
    strideY = usableH / rows;
  const boxes = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const cx = padX + strideX * c + cellW / 2,
        cy = padY + strideY * r + cellH / 2;
      boxes.push({ cls: 0, x: cx, y: cy, w: cellW, h: cellH });
    }
  return boxes;
}
export async function detectBoxes({ endpointUrl, file }) {
  try {
    const b = await remoteDetect(endpointUrl, file);
    if (b?.length) return b;
  } catch (e) {
    console.warn(e);
  }
  return localGridDetect();
}
