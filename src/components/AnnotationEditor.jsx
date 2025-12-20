import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { absToNorm, normToAbs, toYoloTxt } from "../utils/yolo.js";
import { exportAll } from "../utils/zip.js";
import { detectBoxes } from "../utils/detector.js";
import { Annotorious } from "@recogito/annotorious";
import OcrRecognizer from "./OCRRecognizer.jsx";

const xywh = (x, y, w, h) =>
  `xywh=pixel:${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(
    h
  )}`;

// Convert a File to base64 string (data portion only)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });

// Create a storable object for localStorage
const fileToStorable = async (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
  data: await fileToBase64(file),
});

// Upsert a label file into localStorage so File Manager can reload it later
const persistLabelToLocalStorage = async (labelFile) => {
  const existingLabels = JSON.parse(
    localStorage.getItem("hn_saved_labels") || "[]"
  );

  const filtered = existingLabels.filter((s) => s.name !== labelFile.name);
  const storable = await fileToStorable(labelFile);

  localStorage.setItem(
    "hn_saved_labels",
    JSON.stringify([...filtered, storable])
  );
};

function usePairs() {
  const [pairs, setPairs] = useState([]);

  useEffect(() => {
    // Check if we have a single file to edit
    const currentFileStr = sessionStorage.getItem("hn_currentFile");
    if (currentFileStr) {
      console.log("Loading single file mode");
      const currentFile = JSON.parse(currentFileStr);
      console.log("Current file data:", currentFile);

      const map = window.__HN_FILES__ || {};

      // Try to find the file using different keys
      const possibleKeys = [
        currentFile.key,
        currentFile.fullName,
        currentFile.baseName,
        currentFile.image?.name,
      ].filter(Boolean);

      for (const key of possibleKeys) {
        const r = map[key];
        if (r) {
          console.log(`Found single file using key: ${key}`);
          currentFile.image = r.image;
          currentFile.label = r.label;
          setPairs([currentFile]);
          return;
        }
      }

      console.warn(
        "Could not find single file in __HN_FILES__",
        possibleKeys,
        map
      );
    }

    // Fall back to loading all pairs
    const j = sessionStorage.getItem("hn_pairs");
    if (!j) return;
    const parsed = JSON.parse(j);
    const map = window.__HN_FILES__ || {};

    console.log("Loading pairs from sessionStorage:", parsed);
    console.log("Available files in __HN_FILES__:", Object.keys(map));

    parsed.forEach((p) => {
      // Try multiple keys to find the file
      const possibleKeys = [
        p.key,
        p.fullName,
        p.baseName,
        p.image?.name,
        p.label?.name,
      ].filter(Boolean);

      let found = false;
      for (const key of possibleKeys) {
        const r = map[key];
        if (r) {
          console.log(`Found file for pair ${p.baseName} using key: ${key}`);
          p.image = r.image;
          p.label = r.label;
          found = true;
          break;
        }
      }

      if (!found) {
        console.warn(
          `Could not find file for pair: ${p.baseName}`,
          possibleKeys
        );
      }
    });
    setPairs(parsed);
  }, []);
  return [pairs, setPairs];
}

export default function AnnotationEditor() {
  const [pairs, setPairs] = usePairs();
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan position for dragging zoomed image
  const [isPanning, setIsPanning] = useState(false); // Is currently panning
  const [panStart, setPanStart] = useState({ x: 0, y: 0 }); // Mouse position when pan started
  const [selId, setSelId] = useState(null);
  const [annotations, setAnnotations] = useState([]); // Direct state management like working project
  const [annotationsReady, setAnnotationsReady] = useState(false); // Trigger for annotations
  // OCR multi-select support
  const [ocrSelectedIds, setOcrSelectedIds] = useState([]);
  const [ocrMultiSelect, setOcrMultiSelect] = useState(false);
  // Refs to hold current values for formatter closure
  const ocrSelectedIdsRef = useRef([]);
  const ocrMultiSelectRef = useRef(false);
  const [imageContainerSize, setImageContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const [ocrEndpoint, setOcrEndpoint] = useState(
    localStorage.getItem("hn_ocrUrl") || ""
  );
  // moved below to ensure `loc` is initialized
  const [ocrResults, setOcrResults] = useState(new Map());

  const loc = useLocation();
  const nav = useNavigate();
  const apiMode = loc.state?.apiMode;
  const apiUrl = loc.state?.apiUrl || localStorage.getItem("hn_apiUrl") || "";
  const singleFile = loc.state?.singleFile;
  const fileIndex = loc.state?.fileIndex;

  // Ensure OCR endpoint stays in sync after navigation or external changes
  useEffect(() => {
    const stored = localStorage.getItem("hn_ocrUrl") || "";
    if (stored !== ocrEndpoint) setOcrEndpoint(stored);
  }, [loc.state]);

  // Refs for scroll functionality
  const annotationsListRef = useRef(null);

  // Keep ref in sync with state for formatter
  useEffect(() => {
    ocrSelectedIdsRef.current = ocrSelectedIds;
    ocrMultiSelectRef.current = ocrMultiSelect;
  }, [ocrSelectedIds, ocrMultiSelect]);

  // Set index from navigation state for single file mode
  useEffect(() => {
    if (singleFile && fileIndex !== undefined) {
      console.log("Setting index for single file mode:", fileIndex);
      setIdx(0); // Always use index 0 for single file since we only have one pair
    } else if (fileIndex !== undefined) {
      console.log("Setting index for multi-file mode:", fileIndex);
      setIdx(fileIndex);
    }
  }, [singleFile, fileIndex, pairs.length]);

  const pair = pairs[idx] || {};
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const annoRef = useRef(null); // Annotorious instance
  const [imgURL, setImgURL] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  // Calculate optimal image size to fit container
  const calculateOptimalSize = useCallback(() => {
    if (!containerRef.current || !natural.w || !natural.h)
      return { width: 0, height: 0 };

    const container = containerRef.current.getBoundingClientRect();
    const containerWidth = container.width - 40; // padding
    const containerHeight = container.height - 40; // padding

    const aspectRatio = natural.w / natural.h;

    let width, height;
    if (containerWidth / containerHeight > aspectRatio) {
      // Container is wider than image aspect ratio
      height = Math.min(containerHeight, natural.h);
      width = height * aspectRatio;
    } else {
      // Container is taller than image aspect ratio
      width = Math.min(containerWidth, natural.w);
      height = width / aspectRatio;
    }

    return { width: width * zoom, height: height * zoom };
  }, [natural, zoom]);

  const imageSize = calculateOptimalSize();

  // Load image and size
  useEffect(() => {
    if (!pair?.image) {
      setImgURL(null);
      return;
    }
    const url = URL.createObjectURL(pair.image);
    setImgURL(url);
    const im = new Image();
    im.onload = () => {
      setNatural({ w: im.naturalWidth, h: im.naturalHeight });
      // Reset zoom and pan when new image loads
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    im.src = url;

    return () => URL.revokeObjectURL(url);
  }, [pair]);

  // Update container size on window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setImageContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Convert YOLO -> W3C
  const yoloToW3C = (yolos) => {
    // Guard against invalid natural dimensions
    if (!natural.w || !natural.h) {
      console.warn("yoloToW3C: Invalid natural dimensions", natural);
      return [];
    }

    return (yolos || [])
      .map((b, i) => {
        if (!b || typeof b.x !== "number" || typeof b.y !== "number") {
          console.warn("yoloToW3C: Invalid bounding box", b);
          return null;
        }

        const r = normToAbs(b, natural.w, natural.h);

        // Build annotation bodies
        const bodies = [];

        // Add OCR result if exists
        if (b.ocrText && b.ocrText !== "—") {
          // Add OCR result body (JSON format)
          const ocrResult = {
            text: b.ocrText,
            ids: b.ids || "",
            confidence: 1.0, // Default confidence when importing
          };

          bodies.push({
            type: "TextualBody",
            value: JSON.stringify(ocrResult),
            purpose: "ocrResult",
          });

          // Add tagging body with OCR text
          bodies.push({
            type: "TextualBody",
            value: b.ocrText,
            purpose: "tagging",
          });

          // Store in ocrResults map for display
          const annotationId = `${pair.baseName}-${i}`;
          setOcrResults((prev) => new Map(prev).set(annotationId, ocrResult));
        } else {
          // No OCR result, add default class tag
          bodies.push({
            type: "TextualBody",
            value: `Class ${b.cls ?? 0}`,
            purpose: "tagging",
          });
        }

        return {
          id: `${pair.baseName}-${i}`,
          type: "Annotation",
          body: bodies,
          target: {
            source: imgURL,
            selector: {
              type: "FragmentSelector",
              conformsTo: "http://www.w3.org/TR/media-frags/",
              value: xywh(r.x, r.y, r.w, r.h),
            },
          },
        };
      })
      .filter(Boolean);
  };

  // Convert W3C -> YOLO (đọc từ Annotorious)
  const w3cToYolo = (w3c) => {
    if (!natural.w || !natural.h) {
      console.warn("w3cToYolo: Invalid natural dimensions", natural);
      return [];
    }

    const out = [];
    for (const a of w3c || []) {
      const v = a?.target?.selector?.value || ""; // "xywh=pixel:x,y,w,h"
      const m = v.match(
        /xywh=pixel:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/
      );
      if (!m) {
        console.warn("w3cToYolo: Invalid selector value:", v);
        continue;
      }
      const [, x, y, w, h] = m.map(Number);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(w) ||
        !Number.isFinite(h)
      ) {
        console.warn("w3cToYolo: Non-finite values", { x, y, w, h });
        continue;
      }

      const norm = absToNorm({ x, y, w, h }, natural.w, natural.h);

      // Extract OCR text and IDS from annotation body
      let ocrText = "";
      let ids = "";

      if (a.body && Array.isArray(a.body)) {
        // Find OCR result body
        const ocrBody = a.body.find((b) => b.purpose === "ocrResult");
        if (ocrBody && ocrBody.value) {
          try {
            const ocrResult = JSON.parse(ocrBody.value);
            ocrText = ocrResult.text || "";
            ids = ocrResult.ids || "";
          } catch (e) {
            console.warn("Failed to parse OCR result:", e);
          }
        }

        // Fallback: try to find tagging body with OCR text
        if (!ocrText) {
          const tagBody = a.body.find(
            (b) =>
              b.purpose === "tagging" &&
              b.value &&
              b.value !== "Class 0" &&
              !b.value.startsWith("Class ")
          );
          if (tagBody) {
            ocrText = tagBody.value;
          }
        }
      }

      out.push({
        cls: 0,
        ...norm,
        ocrText: ocrText || "—",
        ids: ids || "",
      });
    }
    return out;
  };

  // Init Annotorious on image
  useEffect(() => {
    if (!imgRef.current || !imgURL) return;

    // Destroy old instance
    if (annoRef.current) {
      try {
        annoRef.current.destroy();
      } catch {}
    }

    const anno = new Annotorious({
      image: imgRef.current,
      drawOnSingleClick: true,
      allowEmpty: true,
      formatter: (annotation) => {
        const hasOcrResult = annotation.body?.some(
          (b) => b.purpose === "ocrResult"
        );
        const isOcrTarget = ocrSelectedIdsRef.current.includes(annotation.id);
        // Priority: ocr-completed (green) takes precedence over ocr-target (yellow)
        if (hasOcrResult) {
          return "ocr-completed";
        }
        if (isOcrTarget) {
          return "ocr-target";
        }
        return "";
      },
    });
    annoRef.current = anno;

    // Handle selection changes
    anno.on("selectAnnotation", (annotation) => {
      const id = annotation?.id || null;
      setSelId(id);
      // In OCR multi-select mode, toggle into the selection set
      if (id && ocrMultiSelectRef.current) {
        setOcrSelectedIds((prev) => {
          const set = new Set(prev);
          if (set.has(id)) set.delete(id);
          else set.add(id);
          return Array.from(set);
        });
      }

      // Auto scroll to selected annotation in list (center in the list container)
      if (annotation?.id && annotationsListRef.current) {
        setTimeout(() => {
          const annotationElement = annotationsListRef.current.querySelector(
            `[data-annotation-id="${annotation.id}"]`
          );
          console.log("🔄 Auto-scroll attempt:", annotation.id);
          console.log("  Container ref:", annotationsListRef.current);
          console.log("  Found element:", annotationElement);

          if (annotationElement) {
            console.log("✅ Found element, scrolling within container only");

            // Manual scroll calculation to prevent page scroll
            const container = annotationsListRef.current;
            const elementTop = annotationElement.offsetTop;
            const elementHeight = annotationElement.offsetHeight;
            const containerHeight = container.clientHeight;
            const containerScrollTop = container.scrollTop;

            // Calculate target scroll to center element
            const scrollTo =
              elementTop - containerHeight / 2 + elementHeight / 2;
            const maxScroll = container.scrollHeight - containerHeight;
            const targetScroll = Math.max(0, Math.min(scrollTo, maxScroll));

            // Scroll only within container
            container.scrollTo({
              top: targetScroll,
              behavior: "smooth",
            });

            // Add highlight pulse after scroll
            setTimeout(() => {
              annotationElement.style.transform = "scale(1.02)";
              annotationElement.style.transition = "transform 0.2s ease-out";
              setTimeout(() => {
                annotationElement.style.transform = "scale(1)";
                setTimeout(() => {
                  annotationElement.style.transition = "";
                  annotationElement.style.transform = "";
                }, 200);
              }, 100);
            }, 600); // Wait for scroll to complete

            /* Alternative manual calculation (commented out for testing)
            // Scroll within the container only, not the entire page
            const container = annotationsListRef.current;
            const elementTop = annotationElement.offsetTop;
            const elementHeight = annotationElement.offsetHeight;
            const containerHeight = container.clientHeight;
            const containerScrollTop = container.scrollTop;
            
            // Calculate if element is visible
            const elementBottom = elementTop + elementHeight;
            const containerBottom = containerScrollTop + containerHeight;
            
            console.log('📏 Scroll calculation:');
            console.log('  elementTop:', elementTop, 'elementHeight:', elementHeight);
            console.log('  containerScrollTop:', containerScrollTop, 'containerHeight:', containerHeight);
            console.log('  Need to scroll?', elementTop < containerScrollTop || elementBottom > containerBottom);
            
            if (elementTop < containerScrollTop || elementBottom > containerBottom) {
              // Scroll to center the element in the container - improved calculation
              const scrollTo = elementTop - (containerHeight / 2) + (elementHeight / 2);
              const maxScroll = container.scrollHeight - containerHeight;
              const targetScroll = Math.max(0, Math.min(scrollTo, maxScroll));
              
              console.log('🎯 Improved scroll calculation:');
              console.log('  scrollTo (raw):', scrollTo);
              console.log('  maxScroll:', maxScroll);
              console.log('  targetScroll (clamped):', targetScroll);
              
              container.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
              });
            } else {
              console.log('✅ Element already visible, no scroll needed');
            }
            */
          } else {
            console.log("❌ Element not found for auto-scroll!");
          }
        }, 500); // Increased timeout for better reliability
      }
    });

    anno.on("cancelSelected", () => {
      setSelId(null);
    });

    // Handle annotation changes to prevent duplicates
    anno.on("createAnnotation", (annotation) => {
      console.log("Annotation created:", annotation);
      // Update React state to sync with Annotorious
      setAnnotations((prev) => {
        const exists = prev.find((a) => a.id === annotation.id);
        if (exists) return prev;
        return [...prev, annotation];
      });
    });

    anno.on("updateAnnotation", (annotation, previous) => {
      console.log("Annotation updated:", annotation);
      // Update React state
      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotation.id ? annotation : a))
      );
    });

    anno.on("deleteAnnotation", (annotation) => {
      console.log("Annotation deleted:", annotation);
      // Update React state
      setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    });

    // Seed annotations from YOLO (nếu có)
    // Only seed if we have valid dimensions
    if (pair.annotations?.length && natural.w && natural.h) {
      const w3cAnnotations = yoloToW3C(pair.annotations);
      if (w3cAnnotations.length > 0) {
        anno.setAnnotations(w3cAnnotations);
        // 🔧 FIX: Set React state directly like working project
        setAnnotations(w3cAnnotations);
        console.log(
          "✅ Seeded annotations to both Annotorious and React state:",
          w3cAnnotations.length
        );
        // Trigger annotations re-computation
        setAnnotationsReady(true);
      }
    }

    // API mode: auto-detect nếu chưa có (và đồng bộ VỚI React state)
    (async () => {
      if (
        apiMode &&
        (!pair.annotations || !pair.annotations.length) &&
        natural.w &&
        natural.h
      ) {
        try {
          const detections = await detectBoxes({
            endpointUrl: apiUrl,
            file: pair.image,
          });

          // 1) Lọc dữ liệu hợp lệ, tránh NaN
          const valid = (detections || []).filter(
            (b) =>
              Number.isFinite(b.x) &&
              Number.isFinite(b.y) &&
              (Number.isFinite(b.w) || Number.isFinite(b.width)) &&
              (Number.isFinite(b.h) || Number.isFinite(b.height))
          );

          if (!valid.length) {
            console.warn("No valid detections found");
            return;
          }

          // 2) Chuẩn hoá về YOLO normalized (center x, center y, width, height)
          const W = natural.w;
          const H = natural.h;
          pair.annotations = valid.map((b) => {
            // Handle both formats: (x, y, w, h) or (x, y, width, height)
            const w = b.w ?? b.width ?? 0;
            const h = b.h ?? b.height ?? 0;
            return {
              cls: 0,
              x: (b.x + w / 2) / W, // Center X in normalized coordinates
              y: (b.y + h / 2) / H, // Center Y in normalized coordinates
              w: w / W, // Width in normalized coordinates
              h: h / H, // Height in normalized coordinates
            };
          });

          // 3) Convert sang W3C và gán cho Annotorious
          const w3cAnnotations = yoloToW3C(pair.annotations);
          anno.clearAnnotations();
          anno.setAnnotations(w3cAnnotations);

          // 4) ***QUAN TRỌNG***: đồng bộ với React state để list & panel hiển thị
          setAnnotations(w3cAnnotations);
          setSelId(null);
          setAnnotationsReady(true);

          console.log("✅ API detection completed:", {
            boxes: w3cAnnotations.length,
            W,
            H,
            detections: pair.annotations,
          });
        } catch (e) {
          console.error("❌ Remote detect failed:", e);
        }
      }
    })();
    return () => {
      try {
        anno.destroy();
      } catch {}
      // Reset state on cleanup
      setAnnotations([]);
      setAnnotationsReady(false);
    };
  }, [imgURL, natural.w, natural.h, apiMode, apiUrl, pair]);

  // Zoom functions
  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.1));
  const zoomFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 }); // Reset pan when fitting
  };

  // Pan handlers - only pan when clicking on container background, not on image
  const handlePanStart = (e) => {
    // Only start panning if clicking on the container background (not on image or its wrapper)
    // Check if the click target is NOT the image or inside the image wrapper
    const clickedOnImage =
      imgRef.current &&
      (e.target === imgRef.current || imgRef.current.contains(e.target));

    if (
      !clickedOnImage &&
      (e.target === containerRef.current ||
        e.target.classList.contains("pan-handle"))
    ) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handlePanMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Add pan move/end listeners
  useEffect(() => {
    if (isPanning) {
      window.addEventListener("mousemove", handlePanMove);
      window.addEventListener("mouseup", handlePanEnd);
      return () => {
        window.removeEventListener("mousemove", handlePanMove);
        window.removeEventListener("mouseup", handlePanEnd);
      };
    }
  }, [isPanning, panStart, pan]);

  // Add new annotation
  const addAnnotation = () => {
    if (!annoRef.current) return;

    // Create a new annotation in the center of the visible area
    const centerX = natural.w * 0.4;
    const centerY = natural.h * 0.4;
    const width = natural.w * 0.2;
    const height = natural.h * 0.2;

    const newAnnotation = {
      id: `${pair.baseName}-${Date.now()}`,
      type: "Annotation",
      body: [
        {
          type: "TextualBody",
          value: "Class 0",
          purpose: "tagging",
        },
      ],
      target: {
        source: imgURL,
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: xywh(centerX, centerY, width, height),
        },
      },
    };

    annoRef.current.addAnnotation(newAnnotation);
  };

  // Delete selected annotation
  const deleteSelected = () => {
    if (!annoRef.current || !selId) return;
    const selected = annoRef.current.getSelected();
    if (selected) {
      annoRef.current.removeAnnotation(selected);
      setSelId(null);
    }
  };

  // Handle OCR result callback - Save results to annotations
  const handleOcrResult = (annotationId, result) => {
    console.log(`OCR result for ${annotationId}:`, result);
    setOcrResults((prev) => new Map(prev).set(annotationId, result));

    // Save OCR result to annotation body
    if (annoRef.current) {
      const annotations = annoRef.current.getAnnotations();
      const annotation = annotations.find((a) => a.id === annotationId);
      if (annotation) {
        // Update annotation body with OCR result (preserve existing bodies)
        const existingBodies = (annotation.body || []).filter(
          (b) => b.purpose !== "ocrResult"
        );
        const updatedAnnotation = {
          ...annotation,
          body: [
            ...existingBodies,
            {
              type: "TextualBody",
              value: JSON.stringify(result),
              purpose: "ocrResult",
            },
            {
              type: "TextualBody",
              value: result.text || "—",
              purpose: "tagging",
            },
          ],
        };

        // Update in Annotorious
        annoRef.current.removeAnnotation(annotation);
        annoRef.current.addAnnotation(updatedAnnotation);

        // Update React state
        setAnnotations((prev) =>
          prev.map((a) => (a.id === annotationId ? updatedAnnotation : a))
        );

        // Force re-render to apply formatter class
        setTimeout(() => {
          if (annoRef.current) {
            const allAnnotations = annoRef.current.getAnnotations();
            annoRef.current.setAnnotations(allAnnotations);
          }
        }, 50);

        console.log(`✅ Saved OCR result to annotation ${annotationId}`);
      }
    }
  };

  // Save current annotations
  const save = async () => {
    if (!annoRef.current) return;

    const annotationsFromCanvas = annoRef.current.getAnnotations();
    const yoloData = w3cToYolo(annotationsFromCanvas);
    const yoloTxt = toYoloTxt(yoloData);

    // Ensure we have a label file with the latest content
    const labelName = pair.label?.name || `${pair.baseName}.txt`;
    const labelFile = new File([yoloTxt], labelName, {
      type: "text/plain",
      lastModified: Date.now(),
    });

    const updatedPair = {
      ...pair,
      label: labelFile,
      annotations: yoloData,
    };

    // Update in-memory pairs and sessionStorage (Files are stripped when stringified)
    const updatedPairs = [...pairs];
    updatedPairs[idx] = updatedPair;
    setPairs(updatedPairs);
    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(updatedPairs, (k, v) =>
        v instanceof File ? undefined : v
      )
    );

    // Keep __HN_FILES__ in sync for the current session
    const key = updatedPair.key || updatedPair.fullName || updatedPair.baseName;
    const fileMap = window.__HN_FILES__ || {};
    fileMap[key] = updatedPair;
    window.__HN_FILES__ = fileMap;

    // Persist label to localStorage so File Manager can reload it on next open
    await persistLabelToLocalStorage(labelFile);

    console.log("Annotations saved:", yoloData);
    alert("Annotations saved successfully!");
  };

  // Refresh annotorious classes when OCR selection set changes
  useEffect(() => {
    if (annoRef.current) {
      const all = annoRef.current.getAnnotations();
      annoRef.current.setAnnotations(all);
    }
  }, [ocrSelectedIds]);

  // Export
  const exportAnnotations = async () => {
    if (!annoRef.current) return;
    const annotations = annoRef.current.getAnnotations();
    const yoloData = w3cToYolo(annotations);

    await exportAll([
      {
        ...pair,
        annotations: yoloData,
      },
    ]);
  };

  if (!pair.image) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-slate-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">
            No Image Selected
          </h3>
          <p className="text-slate-400">
            Please go back and select an image to annotate.
          </p>
          <button
            onClick={() => nav(-1)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Header - Fixed */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => nav(-1)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1
            className="text-lg font-semibold text-slate-200 truncate max-w-md"
            title={pair.fullName || pair.baseName}
          >
            {pair.fullName || pair.baseName}
          </h1>
          <span className="text-sm text-slate-400">
            {idx + 1} / {pairs.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Save
          </button>
          <button
            onClick={exportAnnotations}
            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Selected Annotation Info */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full flex-shrink-0">
          {/* Selected Annotation Panel */}
          {selId ? (
            <div className="p-4 flex-1 overflow-auto">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Selected Annotation
              </h3>
              {(() => {
                const selectedAnn = annotations.find((ann) => ann.id === selId);
                const match = selectedAnn?.target?.selector?.value?.match(
                  /xywh=pixel:(\d+),(\d+),(\d+),(\d+)/
                );
                const coords = match ? `(${match[1]}, ${match[2]})` : "";
                const size = match ? `${match[3]} × ${match[4]}` : "";
                // Find the correct index based on order in annotations array
                const foundIndex = annotations.findIndex(
                  (ann) => ann.id === selId
                );
                const index = foundIndex + 1;

                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Label:</span>
                      <span className="text-blue-300 font-medium">Class 0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Position:</span>
                      <span className="text-slate-300">{coords}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Size:</span>
                      <span className="text-slate-300">{size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Index:</span>
                      <span className="text-slate-300">#{index}</span>
                    </div>
                  </div>
                );
              })()}
              {/* OCR Result */}
              {ocrResults.get(selId) && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-blue-400/70 font-semibold">
                    OCR Result
                  </div>
                  {(() => {
                    const result = ocrResults.get(selId);
                    return (
                      <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-700/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-blue-200">
                            {result.text || "—"}
                          </span>
                          {result.confidence !== undefined && (
                            <span className="text-xs font-medium text-green-300">
                              {(result.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {result.ids && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              IDS
                            </span>
                            <div className="text-xs font-mono text-slate-300 break-all">
                              {result.ids}
                            </div>
                          </div>
                        )}
                        {result.error && (
                          <div className="text-xs text-red-300">
                            ⚠ {result.error}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              <button
                onClick={deleteSelected}
                className="w-full mt-3 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Annotation
              </button>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 flex items-center justify-center h-full">
              <p>Select an annotation to view details</p>
            </div>
          )}
        </div>

        {/* Main Content - Image Viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Zoom:</span>
              <button
                onClick={zoomOut}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                </svg>
              </button>
              <span className="text-xs text-slate-300 min-w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Zoom In"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
              </button>
              <button
                onClick={zoomFit}
                className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                title="Fit to Screen"
              >
                Fit
              </button>
            </div>

            <div className="text-xs text-slate-400">
              {natural.w} × {natural.h} px
            </div>
          </div>

          {/* Image Container - Fixed height */}
          <div
            ref={containerRef}
            onMouseDown={handlePanStart}
            className={
              "flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-2 min-h-0 pan-handle" +
              (ocrMultiSelect ? " ocr-multi-select-mode" : "") +
              (isPanning ? " cursor-grabbing" : " cursor-grab")
            }
          >
            <div
              className="relative pan-handle"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`,
                transition: isPanning ? "none" : "transform 0.1s ease-out",
              }}
            >
              <img
                ref={imgRef}
                src={imgURL}
                alt={pair.baseName}
                style={{
                  width: imageSize.width,
                  height: imageSize.height,
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                className="block border border-slate-600 shadow-2xl"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - OCR Recognition */}
        <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full flex-shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex-shrink-0">
            <OcrRecognizer
              annotations={annotations}
              selectedAnnotationId={selId}
              selectedIds={ocrSelectedIds}
              multiSelect={ocrMultiSelect}
              onToggleMultiSelect={() => {
                // Clear all selections when toggling multi-select mode
                setOcrMultiSelect((v) => !v);
                setOcrSelectedIds([]);
                setSelId(null);
                // Cancel current selection in Annotorious to prevent popup
                if (annoRef.current) {
                  try {
                    annoRef.current.cancelSelected();
                  } catch (e) {
                    console.warn("Failed to cancel selection:", e);
                  }
                }
              }}
              onSelectAll={() =>
                setOcrSelectedIds(annotations.map((a) => a.id))
              }
              onSelectNone={() => setOcrSelectedIds([])}
              imageFile={pair.image}
              naturalSize={natural}
              ocrEndpoint={ocrEndpoint}
              onOcrResult={handleOcrResult}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
