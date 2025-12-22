import React, { useState, useEffect, useRef } from "react";
import { recognizeCharacter, testOcrEndpoint } from "../utils/ocr.js";

/**
 * OcrRecognizer Component - Right panel
 * Provides UI for OCR character recognition with multi-select support
 * @param {Object} props
 * @param {Array} props.annotations - Array of annotation objects
 * @param {string} props.selectedAnnotationId - Currently selected annotation ID
 * @param {File} props.imageFile - Original image file
 * @param {Object} props.naturalSize - Natural size of image {w, h}
 * @param {string} props.ocrEndpoint - OCR API endpoint URL
 * @param {Function} props.onOcrResult - Callback when OCR completes (annotationId, result)
 */
export default function OcrRecognizer({
  annotations = [],
  selectedAnnotationId,
  selectedIds = [],
  multiSelect = false,
  onToggleMultiSelect,
  onSelectAll,
  onSelectNone,
  imageFile,
  naturalSize,
  ocrEndpoint,
  onOcrResult,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  // Local endpoint state: use prop or fallback to localStorage
  const [endpoint, setEndpoint] = useState(
    ocrEndpoint || localStorage.getItem("hn_ocrUrl") || ""
  );
  const [endpointOk, setEndpointOk] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState(new Map());
  const [error, setError] = useState(null);
  // We operate on the currently selected annotation only
  // (list UI removed per request)
  const selectListRef = useRef(null); // kept for future but not used
  const resultsListRef = useRef(null); // Ref for results list scrolling

  // Check endpoint availability on mount/endpoint change
  // React to prop changes by updating local endpoint
  useEffect(() => {
    if (ocrEndpoint && ocrEndpoint !== endpoint) {
      setEndpoint(ocrEndpoint);
    }
  }, [ocrEndpoint]);

  useEffect(() => {
    let cancelled = false;
    async function checkEndpoint() {
      if (!endpoint) {
        setEndpointOk(false);
        return;
      }
      try {
        const ok = await testOcrEndpoint(endpoint);
        if (!cancelled) setEndpointOk(ok);
      } catch {
        if (!cancelled) setEndpointOk(false);
      }
    }
    checkEndpoint();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Load existing OCR results from annotations on mount
  useEffect(() => {
    const resultsMap = new Map();
    annotations.forEach((ann) => {
      // Check if annotation has OCR data in body
      const ocrBody = ann.body?.find((b) => b.purpose === "ocrResult");
      if (ocrBody && ocrBody.value) {
        try {
          const result = JSON.parse(ocrBody.value);
          resultsMap.set(ann.id, result);
        } catch (e) {
          console.warn("Failed to parse OCR result from annotation", ann.id);
        }
      }
    });
    if (resultsMap.size > 0) {
      setOcrResults(resultsMap);
    }
  }, [annotations]);

  // Auto-scroll to selected annotation in results list (list UI removed)
  useEffect(() => {
    if (!selectedAnnotationId) return;

    // Scroll in results list if result exists
    if (resultsListRef.current && ocrResults.has(selectedAnnotationId)) {
      const resultElement = resultsListRef.current.querySelector(
        `[data-annotation-id="${selectedAnnotationId}"]`
      );
      if (resultElement) {
        const container = resultsListRef.current;
        const elementTop = resultElement.offsetTop;
        const elementHeight = resultElement.offsetHeight;
        const containerHeight = container.clientHeight;

        const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2;
        const maxScroll = container.scrollHeight - containerHeight;
        const targetScroll = Math.max(0, Math.min(scrollTo, maxScroll));

        container.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      }
    }
  }, [selectedAnnotationId, ocrResults]);

  // Extract bounding box from W3C annotation (natural pixels, top-left xywh)
  const extractBbox = (annotation) => {
    const value = annotation?.target?.selector?.value || "";
    const match = value.match(
      /xywh=pixel:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/
    );
    if (!match) return null;

    const [, x, y, w, h] = match.map(Number);

    // These are already natural image pixel coordinates (created by yoloToW3C)
    const box = { x, y, w, h };
    console.log("[extractBbox] Natural (top-left) bbox from annotation:", box);
    return box;
  };

  // Multi-select list removed; actions operate on current selection

  // Recognize current selection or multi-selected set
  const recognizeSelected = async () => {
    const toRecognize =
      multiSelect && selectedIds.length > 0
        ? Array.from(new Set(selectedIds))
        : selectedAnnotationId
        ? [selectedAnnotationId]
        : [];

    if (!toRecognize.length || !imageFile || !endpoint || !endpointOk) {
      setError("Missing required parameters");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentProgress(0);
    setTotalProgress(toRecognize.length);

    try {
      const resultsMap = new Map(ocrResults);

      for (let i = 0; i < toRecognize.length; i++) {
        const annotationId = toRecognize[i];
        const annotation = annotations.find((a) => a.id === annotationId);
        if (!annotation) {
          console.warn(`Annotation ${annotationId} not found`);
          setCurrentProgress(i + 1);
          continue;
        }

        const bbox = extractBbox(annotation);
        if (!bbox) {
          console.warn(`Invalid bbox for annotation ${annotationId}`);
          setCurrentProgress(i + 1);
          continue;
        }

        try {
          const result = await recognizeCharacter(
            endpoint,
            imageFile,
            bbox,
            naturalSize.w,
            naturalSize.h
          );

          resultsMap.set(annotationId, result);

          if (onOcrResult) {
            onOcrResult(annotationId, result);
          }
        } catch (err) {
          console.error(`OCR failed for annotation ${annotationId}:`, err);
          resultsMap.set(annotationId, {
            text: "",
            ids: "",
            confidence: 0,
            error: err.message,
          });
        }

        setCurrentProgress(i + 1);
      }

      setOcrResults(resultsMap);
    } catch (err) {
      setError(err.message);
      console.error("Batch OCR error:", err);
    } finally {
      setIsProcessing(false);
      setCurrentProgress(0);
      setTotalProgress(0);
    }
  };

  // Get result for selected annotation
  const selectedResult = selectedAnnotationId
    ? ocrResults.get(selectedAnnotationId)
    : null;

  return (
    <div className="space-y-4">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          OCR Recognition
        </h3>
        <span
          className={
            "text-xs " +
            (endpointOk
              ? "text-green-400 font-medium"
              : "text-red-400 font-medium")
          }
        >
          {endpointOk ? "✓ Connected" : "✗ Disconnected"}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && totalProgress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Processing...</span>
            <span>
              {currentProgress} / {totalProgress}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentProgress / totalProgress) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* List removed per request: actions use current selection */}

      {/* Selection controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onToggleMultiSelect}
          className={
            "px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
            (multiSelect
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-slate-700 text-slate-200 hover:bg-slate-600")
          }
        >
          {multiSelect ? "Multi: On" : "Multi: Off"}
        </button>
        <button
          onClick={onSelectAll}
          disabled={!annotations.length}
          className="px-3 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Select All
        </button>
        <button
          onClick={onSelectNone}
          className="px-3 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-sm font-medium transition-colors"
        >
          None
        </button>
      </div>

      {/* Action buttons */}
      <button
        onClick={recognizeSelected}
        disabled={
          isProcessing ||
          !endpoint ||
          !endpointOk ||
          (multiSelect ? selectedIds.length === 0 : !selectedAnnotationId)
        }
        className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
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
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        {isProcessing
          ? "Processing..."
          : `Recognize (${
              multiSelect ? selectedIds.length : selectedAnnotationId ? 1 : 0
            })`}
      </button>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-slate-900/30 rounded p-2">
          <div className="text-slate-400">Total</div>
          <div className="text-lg font-bold text-slate-200">
            {annotations.length}
          </div>
        </div>
        <div className="bg-slate-900/30 rounded p-2">
          <div className="text-slate-400">Recognized</div>
          <div className="text-lg font-bold text-blue-400">
            {ocrResults.size}
          </div>
        </div>
        <div className="bg-slate-900/30 rounded p-2">
          <div className="text-slate-400">Selected</div>
          <div className="text-lg font-bold text-amber-400">
            {multiSelect ? selectedIds.length : selectedAnnotationId ? 1 : 0}
          </div>
        </div>
      </div>
    </div>
  );
}
