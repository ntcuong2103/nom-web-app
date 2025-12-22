// Clean minimal module that matches the backend's API (center-based bbox)

export async function recognizeCharacter(
  endpointUrl,
  imageFile,
  bbox,
  naturalWidth,
  naturalHeight
) {
  if (!endpointUrl) throw new Error("OCR endpoint URL is required");
  if (!imageFile || !bbox)
    throw new Error("Image file and bounding box are required");
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("x", String(cx));
  formData.append("y", String(cy));
  formData.append("width", String(bbox.w));
  formData.append("height", String(bbox.h));
  const response = await fetch(endpointUrl, { method: "POST", body: formData });
  if (!response.ok)
    throw new Error(`OCR API error: ${response.status} ${response.statusText}`);
  const result = await response.json();
  return {
    text: result.text || "",
    ids: result.ids || "",
    confidence: result.confidence || 0,
  };
}

export async function recognizeCharactersBatch(
  endpointUrl,
  imageFile,
  bboxes,
  naturalWidth,
  naturalHeight
) {
  if (!endpointUrl) throw new Error("OCR endpoint URL is required");
  if (!Array.isArray(bboxes) || bboxes.length === 0 || !imageFile) return [];
  const out = [];
  for (let i = 0; i < bboxes.length; i++) {
    try {
      const r = await recognizeCharacter(
        endpointUrl,
        imageFile,
        bboxes[i],
        naturalWidth,
        naturalHeight
      );
      out.push({ index: i, bbox: bboxes[i], ...r });
    } catch (e) {
      out.push({
        index: i,
        bbox: bboxes[i],
        text: "",
        ids: "",
        confidence: 0,
        error: String(e),
      });
    }
  }
  return out;
}

export async function testOcrEndpoint(endpointUrl) {
  try {
    const r = await fetch(endpointUrl, { method: "GET" });
    return r.ok;
  } catch (e) {
    console.error("OCR endpoint test failed:", e);
    return false;
  }
}
