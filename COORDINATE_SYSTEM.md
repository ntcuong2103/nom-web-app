# Hệ Thống Tọa Độ & Convert Bbox

## Tổng Quan

Dự án sử dụng **4 hệ tọa độ khác nhau** cho bbox tùy theo context:

1. **YOLO Normalized** (0–1, center-based)
2. **Natural Pixels** (pixels, center-based hoặc top-left)
3. **W3C Media Fragments** (natural pixels, top-left)
4. **API Payload** (natural pixels, center-based)

---

## Chi Tiết Từng Hệ Tọa Độ

### 1. YOLO Normalized (Normalized, Center-Based)

**Định dạng:**
```javascript
{
  x: 0.5,      // center-x (0–1, tương đối width)
  y: 0.3,      // center-y (0–1, tương đối height)
  w: 0.1,      // width (0–1, tương đối width)
  h: 0.08      // height (0–1, tương đối height)
}
```

**Đặc điểm:**
- Được sử dụng bởi YOLO detection models
- Center-based (cx, cy) → dễ augmentation & data symmetry
- Normalized → scale-invariant, dễ training trên ảnh khác kích thước
- Lưu trữ trong file `.txt` export (VD: `DVSKTT_thu_III_1a.txt`)

**Ví dụ từ file:**
```
từ,từ 0 0.815517 0.694444 0.058621 0.037778 ⊞木□人人
```
→ class=0, cx=0.815517, cy=0.694444, w=0.058621, h=0.037778

---

### 2. Natural Pixels (Pixels, Center-Based)

**Định dạng:**
```javascript
{
  x: 848,       // center-x in pixels
  y: 625,       // center-y in pixels
  w: 61,        // width in pixels
  h: 34         // height in pixels
}
```

**Đặc điểm:**
- Pixels thực tế của ảnh gốc
- Center-based (dễ crop mở rộng đối xứng)
- Kết quả sau chuyển từ YOLO normalized
- Dùng trong YOLO→W3C conversion

**Công thức chuyển từ Normalized:**
```javascript
naturalX = normX × imageWidth
naturalY = normY × imageHeight
naturalW = normW × imageWidth
naturalH = normH × imageHeight
```

---

### 3. W3C Media Fragments (Natural Pixels, Top-Left)

**Định dạng:**
```
xywh=pixel:x,y,w,h
```

**Ví dụ:**
```
xywh=pixel:232,102,20,16
```

**Đặc điểm:**
- Chuẩn W3C Media Fragments (được Annotorious dùng)
- Top-left based (x, y là góc trái trên)
- Natural pixels (không normalized)
- Lưu trữ trong Annotorious annotation object

**Chuyển từ Center → Top-Left:**
```javascript
topLeftX = centerX - w / 2
topLeftY = centerY - h / 2
```

**Chuyển từ Top-Left → Center:**
```javascript
centerX = topLeftX + w / 2
centerY = topLeftY + h / 2
```

---

### 4. API Payload (Natural Pixels, Center-Based)

**Định dạng (FormData):**
```
x: 848          // center-x in pixels
y: 625          // center-y in pixels
width: 61       // width in pixels
height: 34      // height in pixels
```

**Đặc điểm:**
- Backend OCR API yêu cầu center-based
- Natural pixels (không normalized)
- Dùng để crop mở rộng: `x1 = cx - w/2`, `y1 = cy - h/2`
- Tương thích với `_ocr_crop_equal()` backend

---

## Các Hàm Convert

### File: `src/utils/yolo.js`

#### 1. `normToAbs(bbox, imgWidth, imgHeight)`
**YOLO Normalized → Natural Pixels (Center)**

```javascript
function normToAbs(bbox, imgWidth, imgHeight) {
  return {
    x: bbox.x * imgWidth,
    y: bbox.y * imgHeight,
    w: bbox.w * imgWidth,
    h: bbox.h * imgHeight
  };
}
```

**Dùng khi:**
- Import YOLO detection output
- Chuyển từ file `.txt` normalized sang pixels
- Chuẩn bị cho W3C conversion

**Ví dụ:**
```javascript
const norm = { x: 0.815517, y: 0.694444, w: 0.058621, h: 0.037778 };
const natural = normToAbs(norm, 1040, 900);
// → { x: 848.1, y: 625, w: 61, h: 34 }
```

---

#### 2. `absToNorm(bbox, imgWidth, imgHeight)`
**Natural Pixels → YOLO Normalized (Center)**

```javascript
function absToNorm(bbox, imgWidth, imgHeight) {
  return {
    x: bbox.x / imgWidth,
    y: bbox.y / imgHeight,
    w: bbox.w / imgWidth,
    h: bbox.h / imgHeight
  };
}
```

**Dùng khi:**
- Export annotation để training YOLO
- Chuyển từ pixels sang normalized format
- Lưu vào file `.txt`

**Ví dụ:**
```javascript
const natural = { x: 848, y: 625, w: 61, h: 34 };
const norm = absToNorm(natural, 1040, 900);
// → { x: 0.815385, y: 0.694444, w: 0.058654, h: 0.037778 }
```

---

#### 3. `yoloToW3C(yoloBbox, imgNaturalSize)`
**YOLO Normalized → W3C Media Fragments (Top-Left)**

```javascript
function yoloToW3C(yoloBbox, imgNaturalSize) {
  // Step 1: Normalize → Natural pixels (center)
  const natural = normToAbs(yoloBbox, imgNaturalSize.w, imgNaturalSize.h);
  
  // Step 2: Center → Top-left
  const topLeftX = Math.round(natural.x - natural.w / 2);
  const topLeftY = Math.round(natural.y - natural.h / 2);
  
  return `xywh=pixel:${topLeftX},${topLeftY},${Math.round(natural.w)},${Math.round(natural.h)}`;
}
```

**Dùng khi:**
- Import YOLO detection để tạo annotation
- Tạo W3C Media Fragments từ YOLO output
- Chuẩn bị data cho Annotorious

**Ví dụ:**
```javascript
const yolo = { x: 0.815517, y: 0.694444, w: 0.058621, h: 0.037778 };
const w3c = yoloToW3C(yolo, { w: 1040, h: 900 });
// → "xywh=pixel:817,608,61,34"
```

---

#### 4. `w3cToYolo(w3cString, imgNaturalSize)`
**W3C Media Fragments → YOLO Normalized (Center)**

```javascript
function w3cToYolo(w3cString, imgNaturalSize) {
  // Step 1: Parse xywh=pixel:x,y,w,h
  const match = w3cString.match(/xywh=pixel:(\d+),(\d+),(\d+),(\d+)/);
  if (!match) return null;
  
  const [, x, y, w, h] = match.map(Number);
  
  // Step 2: Top-left → Center
  const natural = {
    x: x + w / 2,
    y: y + h / 2,
    w: w,
    h: h
  };
  
  // Step 3: Natural pixels → Normalized
  return absToNorm(natural, imgNaturalSize.w, imgNaturalSize.h);
}
```

**Dùng khi:**
- Extract annotation từ Annotorious
- Export annotation cho training YOLO
- Chuyển W3C sang YOLO format

**Ví dụ:**
```javascript
const w3c = "xywh=pixel:817,608,61,34";
const yolo = w3cToYolo(w3c, { w: 1040, h: 900 });
// → { x: 0.8149..., y: 0.694..., w: 0.0586..., h: 0.0377... }
```

---

### File: `src/components/OCRRecognizer.jsx`

#### 5. `extractBbox(annotation)`
**Extract W3C từ Annotorious Object → Natural Pixels (Top-Left)**

```javascript
const extractBbox = (annotation) => {
  const value = annotation?.target?.selector?.value || "";
  const match = value.match(
    /xywh=pixel:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/
  );
  if (!match) return null;

  const [, x, y, w, h] = match.map(Number);

  console.log("[extractBbox] Natural (top-left) bbox from annotation:", { x, y, w, h });
  return { x, y, w, h };
};
```

**Dùng khi:**
- Lấy bbox từ annotation đã lưu
- Chuẩn bị gửi OCR API
- Zoom-safe (lấy trực tiếp từ annotation, không phụ thuộc rendered size)

**Tính năng quan trọng:**
- ✅ **Zoom-invariant:** Giá trị không thay đổi khi zoom in/out
- ✅ **Natural pixels:** Tọa độ ảnh gốc, không ảnh hưởng canvas size

**Ví dụ:**
```javascript
const anno = { target: { selector: { value: 'xywh=pixel:817,608,61,34' } } };
const bbox = extractBbox(anno);
// → { x: 817, y: 608, w: 61, h: 34 }
```

---

### File: `src/utils/ocr.js`

#### 6. `recognizeCharacter(endpointUrl, imageFile, bbox, naturalWidth, naturalHeight)`
**W3C Top-Left → API Center-Based Payload**

```javascript
export async function recognizeCharacter(
  endpointUrl,
  imageFile,
  bbox,
  naturalWidth,
  naturalHeight
) {
  // Input: bbox = { x, y, w, h } (top-left, natural pixels)
  
  // Convert top-left → center
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const width = bbox.w;
  const height = bbox.h;

  // Send to API (center-based)
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("x", String(cx));
  formData.append("y", String(cy));
  formData.append("width", String(width));
  formData.append("height", String(height));

  const response = await fetch(endpointUrl, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`OCR API error: ${response.status} ${response.statusText}`);

  const result = await response.json();
  return {
    text: result.text || "",
    ids: result.ids || "",
    confidence: result.confidence || 0,
  };
}
```

**Dùng khi:**
- Gửi OCR request từ FE sang backend
- Convert từ Annotorious format (top-left) → API format (center)
- Ranh giới FE ↔ BE

**Ví dụ:**
```javascript
const bbox = { x: 817, y: 608, w: 61, h: 34 }; // top-left
// → center payload: x=847.5, y=643, width=61, height=34
```

---

### File: `src/components/AnnotationEditor.jsx`

#### 7. `xywh(x, y, w, h)`
**Create W3C Media Fragments String**

```javascript
const xywh = (x, y, w, h) =>
  `xywh=pixel:${x.toFixed(6)},${y.toFixed(6)},${w.toFixed(6)},${h.toFixed(6)}`;
```

**Dùng khi:**
- Tạo W3C selector khi lưu annotation
- Format chuẩn Annotorious
- Store natural pixels (top-left)
- Giữ subpixel precision (6 chữ số thập phân)

**Ví dụ:**
```javascript
const w3cString = xywh(817.5, 608.25, 61, 34);
// → "xywh=pixel:817.500000,608.250000,61.000000,34.000000"
```

---

## Luồng Convert Chính

### 1. Import YOLO Detection → Annotorious Annotation

```
YOLO Output File (.txt)
  ↓ [read normalized coords]
YOLO Normalized { x: 0.815, y: 0.694, w: 0.058, h: 0.037 }
  ↓ [yoloToW3C]
W3C String "xywh=pixel:817,608,61,34"
  ↓ [xywh() + store in Annotorious]
Annotorious Annotation Object
```

**Code:**
```javascript
const yoloBbox = { x: 0.815517, y: 0.694444, w: 0.058621, h: 0.037778 };
const w3cString = yoloToW3C(yoloBbox, { w: 1040, h: 900 });
const annotation = createAnnotation(w3cString);
```

---

### 2. Send Annotation to OCR API

```
Annotorious Annotation (stored)
  ↓ [extractBbox]
W3C Top-Left { x: 817, y: 608, w: 61, h: 34 }
  ↓ [recognizeCharacter: top-left → center]
API Center Payload { x: 847.5, y: 643, width: 61, height: 34 }
  ↓ [POST /ocr]
Backend _ocr_crop_equal(cx=847.5, cy=643, w=61, h=34)
  ↓ [crop with expand_ratio]
Cropped Image (square, centered)
  ↓ [model inference]
OCR Result (text, ids)
```

**Code:**
```javascript
const anno = getSelectedAnnotation();
const bbox = extractBbox(anno);  // top-left
const result = await recognizeCharacter(apiUrl, imageFile, bbox);
```

---

### 3. Export Annotation for Training

```
Annotorious Annotation (stored)
  ↓ [extractBbox]
W3C Top-Left { x: 817, y: 608, w: 61, h: 34 }
  ↓ [w3cToYolo]
YOLO Normalized { x: 0.815, y: 0.694, w: 0.058, h: 0.037 }
  ↓ [write to .txt file]
Export File "0 0.815 0.694 0.058 0.037"
```

**Code:**
```javascript
const anno = annotations[i];
const bbox = extractBbox(anno);
const w3cStr = `xywh=pixel:${bbox.x},${bbox.y},${bbox.w},${bbox.h}`;
const yolo = w3cToYolo(w3cStr, imgSize);
// → write yolo to file
```

---

## Bảng So Sánh

| Hệ Tọa Độ | Định Dạng | Loại | Ứng Dụng |
|-----------|-----------|------|---------|
| **YOLO Norm** | `{x: 0.5, y: 0.3, w: 0.1, h: 0.08}` | Center, Normalized | Models, Training |
| **Natural Center** | `{x: 848, y: 625, w: 61, h: 34}` | Center, Pixels | Internal Convert |
| **W3C Top-Left** | `xywh=pixel:817,608,61,34` | Top-Left, Pixels | Annotorious Storage |
| **API Center** | `{x: 847.5, y: 643, width: 61, height: 34}` | Center, Pixels | OCR API POST |

---

## Tính Năng Quan Trọng

### ✅ Zoom-Invariant
- W3C annotations lưu **natural pixels** từ ảnh gốc
- `extractBbox()` lấy trực tiếp, không phụ thuộc zoom
- Tọa độ gửi API **luôn chính xác** dù zoom in/out

### ✅ Chuẩn W3C
- Annotorious dùng W3C Media Fragments tiêu chuẩn
- Top-left format tương thích với DOM/CSS
- Dễ render selection/preview

### ✅ Center-Based API
- Backend dùng center cho crop mở rộng đối xứng
- Công thức: `x1 = cx - w/2, y1 = cy - h/2`
- Dễ apply `expand_ratio` đều trên 4 phía

### ✅ Scale-Invariant YOLO
- Normalized format (0–1) independent của image size
- Training trên ảnh 640×480 hoặc 1040×900 cùng giá trị
- Dễ augmentation

### ✅ Subpixel Precision
- `xywh()` giữ 6 chữ số thập phân khi lưu
- Tránh mất precision từ rounding
- Kết quả OCR chính xác với Swagger manual test

---

## Ví Dụ Hoàn Chỉnh

### Scenario: Import Detection → Annotate → Export

```javascript
// Step 1: Read YOLO detection from file
const yoloLine = "từ 0 0.815517 0.694444 0.058621 0.037778";
const [char, classId, cx, cy, w, h] = yoloLine.split(' ').map(parseFloat);

// Step 2: Convert to W3C
const yolo = { x: cx, y: cy, w: w, h: h };
const w3cString = yoloToW3C(yolo, { w: 1040, h: 900 });
// → "xywh=pixel:817.500000,608.250000,61.000000,34.000000"

// Step 3: Create Annotorious annotation
const annotation = {
  type: 'Annotation',
  target: {
    selector: { value: w3cString }
  }
};
annotorious.addAnnotation(annotation);

// Step 4: User selects annotation, runs OCR
const selectedAnno = annotorious.getSelected()[0];
const bbox = extractBbox(selectedAnno);  
// → {x: 817.5, y: 608.25, w: 61, h: 34}

const result = await recognizeCharacter(apiUrl, imageFile, bbox);
// → API gets: x=848.5, y=643, width=61, height=34

// Step 5: Export for training
const exported = w3cToYolo(
  `xywh=pixel:${bbox.x},${bbox.y},${bbox.w},${bbox.h}`, 
  { w: 1040, h: 900 }
);
// → { x: 0.815..., y: 0.694..., w: 0.058..., h: 0.037... }
```

---

## Tính Toán Ảnh Gốc 1040×900

```
YOLO: từ 0 0.815517 0.694444 0.058621 0.037778
  ↓
Natural Center (pixels):
  cx = 0.815517 × 1040 = 848.1
  cy = 0.694444 × 900  = 625
  w  = 0.058621 × 1040 = 60.97 ≈ 61
  h  = 0.037778 × 900  = 34

  ↓
Top-Left (for W3C):
  x = 848.1 - 61/2 = 817.6 ≈ 817.5
  y = 625 - 34/2 = 608
  → "xywh=pixel:817.500000,608.000000,61.000000,34.000000"

  ↓
API Center Payload (sent to backend):
  x = 817.5 + 61/2 = 848.5
  y = 608 + 34/2 = 625
  width = 61
  height = 34
  → { x: 848.5, y: 625, width: 61, height: 34 }

  ↓
Backend crop (expand_ratio = 1.2):
  side = max(61, 34) × 1.2 = 73.2
  x1 = 848.5 - 73.2/2 = 812
  y1 = 625 - 73.2/2 = 588
  x2 = 848.5 + 73.2/2 = 885
  y2 = 625 + 73.2/2 = 662
  → Crop region: [812:885, 588:662] (73×74 pixels, near square)
```

---

## Lưu Ý Khi Debug

1. **Kiểm tra format W3C:**
   ```javascript
   console.log(anno.target.selector.value);
   // Expected: "xywh=pixel:817.500000,608.000000,61.000000,34.000000"
   ```

2. **Verify API payload:**
   ```javascript
   console.log('[OCR] Sending:', { x, y, width, height });
   // Compare with Swagger manual test
   ```

3. **Kiểm tra natural size:**
   ```javascript
   console.log('Image size:', { width: img.naturalWidth, height: img.naturalHeight });
   ```

4. **Test zoom stability:**
   - Zoom in/out, chọn cùng bbox
   - Kiểm tra console: `x, y, width, height` phải giống nhau
   - Nếu khác → check `extractBbox()` không bị ảnh hưởng rendered size

5. **So sánh với Swagger:**
   - Test thủ công trên Swagger: x=269.65, y=111.29, w=19.78, h=15.86
   - Test trên web: in console payload gửi lên
   - Nếu giống → result OCR phải giống
   - Nếu khác → check conversion logic (top-left vs center)

---

## Reference

- [W3C Media Fragments URI](https://www.w3.org/TR/media-frags/)
- [Annotorious Documentation](https://annotorious.dev/)
- [YOLO Format](https://docs.ultralytics.com/datasets/detect/)
- Backend OCR API: `_ocr_crop_equal()` in `main.py`
- YOLO conversion: `src/utils/yolo.js`
- OCR client: `src/utils/ocr.js`

---

**Last Updated:** December 22, 2025
