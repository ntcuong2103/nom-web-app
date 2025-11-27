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

const xywh = (x, y, w, h) =>
  `xywh=pixel:${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(
    h
  )}`;

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
  const [selId, setSelId] = useState(null);
  const [annotations, setAnnotations] = useState([]); // Direct state management like working project
  const [annotationsReady, setAnnotationsReady] = useState(false); // Trigger for annotations
  const [imageContainerSize, setImageContainerSize] = useState({
    width: 0,
    height: 0,
  });

  const loc = useLocation();
  const nav = useNavigate();
  const apiMode = loc.state?.apiMode;
  const apiUrl = loc.state?.apiUrl || localStorage.getItem("hn_apiUrl") || "";
  const singleFile = loc.state?.singleFile;
  const fileIndex = loc.state?.fileIndex;

  // Refs for scroll functionality
  const annotationsListRef = useRef(null);

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
      // Reset zoom when new image loads
      setZoom(1);
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
  const yoloToW3C = (yolos) =>
    (yolos || []).map((b, i) => {
      const r = normToAbs(b, natural.w, natural.h);
      return {
        id: `${pair.baseName}-${i}`,
        type: "Annotation",
        body: [
          {
            type: "TextualBody",
            value: `Class ${b.cls ?? 0}`,
            purpose: "tagging",
          },
        ],
        target: {
          source: imgURL,
          selector: {
            type: "FragmentSelector",
            conformsTo: "http://www.w3.org/TR/media-frags/",
            value: xywh(r.x, r.y, r.w, r.h),
          },
        },
      };
    });

  // Convert W3C -> YOLO (đọc từ Annotorious)
  const w3cToYolo = (w3c) => {
    const out = [];
    for (const a of w3c) {
      const v = a?.target?.selector?.value || ""; // "xywh=pixel:x,y,w,h"
      const m = v.match(/xywh=pixel:(\d+),(\d+),(\d+),(\d+)/);
      if (!m) continue;
      const [, x, y, w, h] = m.map(Number);
      const norm = absToNorm({ x, y, w, h }, natural.w, natural.h);
      out.push({ cls: 0, ...norm });
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
    });
    annoRef.current = anno;

    // Handle selection changes
    anno.on("selectAnnotation", (annotation) => {
      setSelId(annotation?.id || null);

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
            console.log(
              "✅ Found element, using scrollIntoView for perfect center"
            );

            // Use scrollIntoView with center alignment for precise centering
            annotationElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
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
    if (pair.annotations?.length) {
      const w3cAnnotations = yoloToW3C(pair.annotations);
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

    // API mode: auto-detect nếu chưa có (và đồng bộ VỚI React state)
    (async () => {
      if (apiMode && (!pair.annotations || !pair.annotations.length)) {
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
              Number.isFinite(b.width) &&
              Number.isFinite(b.height)
          );

          // 2) Chuẩn hoá về YOLO normalized theo kích thước ảnh tự nhiên
          const W = natural?.w || 1;
          const H = natural?.h || 1;
          pair.annotations = valid.map((b) => ({
            cls: 0,
            x: (b.x + b.width / 2) / W,
            y: (b.y + b.height / 2) / H,
            w: b.width / W,
            h: b.height / H,
          }));

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
  }, [imgURL, natural.w, natural.h, apiMode, apiUrl]);

  // Zoom functions
  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.1));
  const zoomFit = () => setZoom(1);

  // Navigation
  const canPrev = idx > 0;
  const canNext = idx < pairs.length - 1;
  const prev = () => canPrev && setIdx(idx - 1);
  const next = () => canNext && setIdx(idx + 1);

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

  // Save current annotations
  const save = () => {
    if (!annoRef.current) return;
    const annotations = annoRef.current.getAnnotations();
    const yoloData = w3cToYolo(annotations);

    // Update pair data
    pair.annotations = yoloData;

    // Update session storage
    const updatedPairs = [...pairs];
    updatedPairs[idx] = pair;
    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(updatedPairs, (k, v) =>
        v instanceof File ? undefined : v
      )
    );

    console.log("Annotations saved:", yoloData);
    alert("Annotations saved successfully!");
  };

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
            onClick={prev}
            disabled={!canPrev}
            className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ← Previous
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Next →
          </button>
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
        {/* Left Sidebar - Fixed width */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col h-full flex-shrink-0">
          {/* All Annotations Header - Move to top */}
          <div className="p-4 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-200 mb-3">
              All Annotations
              <span className="ml-2 text-sm text-slate-400">
                ({annotations.length})
              </span>
            </h2>
            <button
              onClick={addAnnotation}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Annotation
            </button>
          </div>

          {/* Annotations List - Fixed 50% height with clear separation */}
          <div className="px-2 py-3">
            <div
              ref={annotationsListRef}
              className="overflow-auto scroll-smooth bg-slate-800/30 rounded-lg border border-slate-600/50 shadow-inner"
              style={{
                maxHeight: "35vh",
                minHeight: "35vh",
                scrollBehavior: "smooth",
              }}
            >
              {annotations.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  <p>No annotations yet.</p>
                  <p className="text-sm mt-1">
                    Click "Add Annotation" or draw directly on the image.
                  </p>
                  <p className="text-xs mt-2 text-slate-500">
                    Debug: annotations.length = {annotations.length}
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-3 py-4">
                  {/* Top spacer for better viewport */}
                  <div className="h-2"></div>

                  {annotations.map((ann, i) => {
                    const isSelected = ann.id === selId;
                    const match = ann.target?.selector?.value?.match(
                      /xywh=pixel:(\d+),(\d+),(\d+),(\d+)/
                    );
                    const coords = match ? `(${match[1]}, ${match[2]})` : "";
                    const size = match ? `${match[3]} × ${match[4]}` : "";

                    // Debug first annotation render
                    if (i === 0) {
                      console.log(
                        "🔄 Rendering annotations list:",
                        annotations.length,
                        "items"
                      );
                    }

                    return (
                      <div
                        key={ann.id}
                        data-annotation-id={ann.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "bg-blue-500/30 border-blue-400 shadow-lg shadow-blue-500/20"
                            : "bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500"
                        }`}
                        onClick={() => {
                          annoRef.current?.selectAnnotation(ann.id);
                          setSelId(ann.id);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium transition-colors ${
                              isSelected ? "text-blue-200" : "text-slate-200"
                            }`}
                          >
                            Class 0
                          </span>
                          <span
                            className={`text-xs transition-colors ${
                              isSelected ? "text-blue-300" : "text-slate-400"
                            }`}
                          >
                            #{i + 1}
                          </span>
                        </div>
                        <div
                          className={`text-xs mt-1 transition-colors ${
                            isSelected ? "text-blue-300" : "text-slate-400"
                          }`}
                        >
                          Position: {coords}
                        </div>
                        <div
                          className={`text-xs transition-colors ${
                            isSelected ? "text-blue-300" : "text-slate-400"
                          }`}
                        >
                          Size: {size}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom spacer for better viewport */}
                  <div className="h-2"></div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Annotation Panel - Move to bottom */}
          {selId && (
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
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
            className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-2 min-h-0"
          >
            <div className="relative">
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
      </div>
    </div>
  );
}
