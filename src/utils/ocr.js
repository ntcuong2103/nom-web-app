/**
 * OCR Utility for Han-Nom character recognition
 * Sends bounding box and image to backend OCR API
 */

/**
 * Crop image to bounding box and send to OCR API
 * @param {string} endpointUrl - OCR API endpoint URL
 * @param {File} imageFile - Original image file
 * @param {Object} bbox - Bounding box in normalized coordinates {x, y, w, h}
 * @param {number} naturalWidth - Natural width of the image
 * @param {number} naturalHeight - Natural height of the image
 * @returns {Promise<Object>} OCR result with {text, ids, confidence}
 */
export async function recognizeCharacter(
  endpointUrl,
  imageFile,
  bbox,
  naturalWidth,
  naturalHeight
) {
  if (!endpointUrl) {
    throw new Error("OCR endpoint URL is required");
  }

  if (!imageFile || !bbox) {
    throw new Error("Image file and bounding box are required");
  }

  try {
    // Convert normalized coordinates to absolute pixel coordinates
    const x = bbox.x * naturalWidth;
    const y = bbox.y * naturalHeight;
    const width = bbox.w * naturalWidth;
    const height = bbox.h * naturalHeight;

    // Create FormData with image and bounding box info
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("x", x.toString());
    formData.append("y", y.toString());
    formData.append("width", width.toString());
    formData.append("height", height.toString());

    // Send request to OCR API
    const response = await fetch(endpointUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `OCR API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    // Expected format: { text: "字", ids: "U+1234", confidence: 0.95 }
    return {
      text: result.text || "",
      ids: result.ids || "",
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("OCR recognition error:", error);
    throw error;
  }
}

/**
 * Batch OCR recognition for multiple bounding boxes
 * @param {string} endpointUrl - OCR API endpoint URL
 * @param {File} imageFile - Original image file
 * @param {Array<Object>} bboxes - Array of bounding boxes
 * @param {number} naturalWidth - Natural width of the image
 * @param {number} naturalHeight - Natural height of the image
 * @returns {Promise<Array<Object>>} Array of OCR results
 */
export async function recognizeCharactersBatch(
  endpointUrl,
  imageFile,
  bboxes,
  naturalWidth,
  naturalHeight
) {
  if (!endpointUrl) {
    throw new Error("OCR endpoint URL is required");
  }
  if (!Array.isArray(bboxes) || bboxes.length === 0 || !imageFile) {
    return [];
  }

  try {
    // Process sequentially with multipart single-box requests (matches backend implementation)
    const results = [];
    for (let i = 0; i < bboxes.length; i++) {
      const bbox = bboxes[i];
      try {
        const result = await recognizeCharacter(
          endpointUrl,
          imageFile,
          bbox,
          naturalWidth,
          naturalHeight
        );
        results.push({
          index: i,
          bbox,
          ...result,
        });
      } catch (error) {
        console.error(`OCR failed for bbox ${i}:`, error);
        results.push({
          index: i,
          bbox,
          text: "",
          ids: "",
          confidence: 0,
          error: error.message,
        });
      }
    }
    return results;
  } catch (error) {
    console.error("Batch OCR error:", error);
    throw error;
  }
}

/**
 * Test OCR endpoint availability
 * @param {string} endpointUrl - OCR API endpoint URL
 * @returns {Promise<boolean>} True if endpoint is available
 */
export async function testOcrEndpoint(endpointUrl) {
  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
    });
    return response.ok;
  } catch (error) {
    console.error("OCR endpoint test failed:", error);
    return false;
  }
}
