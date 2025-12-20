import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { parseYoloTxt } from "../utils/yolo.js";

// Convert File to storable format
const fileToStorable = (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
  data: null, // Will be populated with base64 data
});

// Convert storable format back to File-like object
const storableToFile = (storable) => {
  if (!storable.data) return null;

  const byteCharacters = atob(storable.data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  return new File([byteArray], storable.name, {
    type: storable.type,
    lastModified: storable.lastModified,
  });
};

// Convert File to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const pairByBasename = (files) => {
  const map = new Map();
  for (const f of Array.from(files)) {
    const dot = f.name.lastIndexOf(".");
    const base = dot > 0 ? f.name.slice(0, dot) : f.name;
    const ext = dot > 0 ? f.name.slice(dot + 1).toLowerCase() : "";

    // Use full filename as key to avoid conflicts with similar names
    const key = f.name;
    const cur = map.get(key) || {
      baseName: base,
      fullName: f.name,
      key: key,
    };

    if (["jpg", "jpeg", "png", "webp"].includes(ext)) cur.image = f;
    if (ext === "txt") cur.label = f;
    map.set(key, cur);
  }

  // Now try to pair files with similar basenames
  const pairs = new Map();
  for (const [key, item] of map) {
    if (item.image) {
      // Try to find matching label
      const imageBase = item.baseName;
      for (const [otherKey, otherItem] of map) {
        if (
          otherItem.label &&
          otherItem.baseName === imageBase &&
          !item.label
        ) {
          item.label = otherItem.label;
          item.annotations = otherItem.annotations;
          break;
        }
      }
      pairs.set(key, item);
    }
  }

  return Array.from(pairs.values());
};

export default function FileManager({ apiMode = false }) {
  const nav = useNavigate();
  const [pairs, setPairs] = useState([]);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem("hn_apiUrl") || "");
  const [ocrUrl, setOcrUrl] = useState(localStorage.getItem("hn_ocrUrl") || "");
  const [previewImage, setPreviewImage] = useState(null);
  const [imageUrls, setImageUrls] = useState(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLabelMissingAlert, setShowLabelMissingAlert] = useState(false);
  const [selectedFileForEdit, setSelectedFileForEdit] = useState(null);

  // Load saved files from localStorage on component mount
  useEffect(() => {
    loadSavedFiles();
  }, []);

  const loadSavedFiles = async () => {
    try {
      const savedImages = JSON.parse(
        localStorage.getItem("hn_saved_images") || "[]"
      );
      const savedLabels = JSON.parse(
        localStorage.getItem("hn_saved_labels") || "[]"
      );

      const imageFiles = [];
      const labelFiles = [];

      // Convert saved images back to File objects
      for (const saved of savedImages) {
        const file = storableToFile(saved);
        if (file) imageFiles.push(file);
      }

      // Convert saved labels back to File objects
      for (const saved of savedLabels) {
        const file = storableToFile(saved);
        if (file) labelFiles.push(file);
      }

      if (imageFiles.length > 0 || labelFiles.length > 0) {
        await loadFiles([...imageFiles, ...labelFiles], false);
      }
    } catch (error) {
      console.error("Error loading saved files:", error);
    }
  };

  const saveFilesToStorage = async (newFiles) => {
    try {
      const imageFiles = newFiles.filter((f) =>
        ["jpg", "jpeg", "png", "webp"].includes(
          f.name.split(".").pop().toLowerCase()
        )
      );
      const labelFiles = newFiles.filter((f) => f.name.endsWith(".txt"));

      // Save images to localStorage
      if (imageFiles.length > 0) {
        const existingImages = JSON.parse(
          localStorage.getItem("hn_saved_images") || "[]"
        );
        const newImages = [];

        for (const file of imageFiles) {
          // Check if file already exists
          const exists = existingImages.some(
            (saved) => saved.name === file.name && saved.size === file.size
          );
          if (!exists) {
            const storable = fileToStorable(file);
            storable.data = await fileToBase64(file);
            newImages.push(storable);
          }
        }

        if (newImages.length > 0) {
          localStorage.setItem(
            "hn_saved_images",
            JSON.stringify([...existingImages, ...newImages])
          );
        }
      }

      // Save labels to localStorage
      if (labelFiles.length > 0) {
        const existingLabels = JSON.parse(
          localStorage.getItem("hn_saved_labels") || "[]"
        );
        const newLabels = [];

        for (const file of labelFiles) {
          // Check if file already exists
          const exists = existingLabels.some(
            (saved) => saved.name === file.name && saved.size === file.size
          );
          if (!exists) {
            const storable = fileToStorable(file);
            storable.data = await fileToBase64(file);
            newLabels.push(storable);
          }
        }

        if (newLabels.length > 0) {
          localStorage.setItem(
            "hn_saved_labels",
            JSON.stringify([...existingLabels, ...newLabels])
          );
        }
      }
    } catch (error) {
      console.error("Error saving files to storage:", error);
    }
  };

  const createImageUrl = (file) => {
    if (imageUrls.has(file.name)) {
      return imageUrls.get(file.name);
    }
    const url = URL.createObjectURL(file);
    setImageUrls((prev) => new Map(prev).set(file.name, url));
    return url;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadFiles = async (files, saveToStorage = true) => {
    // Get existing pairs from current state
    const existingFiles = [];
    pairs.forEach((pair) => {
      if (pair.image) existingFiles.push(pair.image);
      if (pair.label) existingFiles.push(pair.label);
    });

    // Combine existing files with new files
    const allFiles = [...existingFiles, ...Array.from(files)];
    const ps = pairByBasename(allFiles);

    for (const p of ps) {
      if (p.label) p.annotations = parseYoloTxt(await p.label.text());
      if (p.image) p.imageSize = formatFileSize(p.image.size);
    }

    setPairs(ps);

    // Save to localStorage if requested
    if (saveToStorage) {
      await saveFilesToStorage(Array.from(files));
    }

    // Update session storage for immediate use
    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(ps, (k, v) => (v instanceof File ? undefined : v))
    );
    window.__HN_FILES__ = ps.reduce((a, p) => ((a[p.baseName] = p), a), {});
  };

  const editFile = (pair, index) => {
    // Check if the file has a label
    if (!pair.label) {
      setSelectedFileForEdit({ pair, index });
      setShowLabelMissingAlert(true);
      return;
    }

    // If label exists, proceed to annotation editor
    // Update the pairs array to ensure the correct file is saved
    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(pairs, (k, v) => (v instanceof File ? undefined : v))
    );

    const fileToEdit = {
      ...pair,
      index,
      baseName: pair.baseName,
      fullName: pair.fullName || pair.baseName,
      key: pair.key || pair.fullName || pair.baseName,
    };

    sessionStorage.setItem(
      "hn_currentFile",
      JSON.stringify(fileToEdit, (k, v) => (v instanceof File ? undefined : v))
    );

    // Update global files reference with unique keys
    window.__HN_FILES__ = pairs.reduce((a, p) => {
      const key = p.key || p.fullName || p.baseName;
      a[key] = p;
      return a;
    }, {});

    nav("/workspace/manual/editor", {
      state: {
        apiMode,
        apiUrl,
        singleFile: true,
        fileIndex: index,
        targetFileName: pair.baseName,
        targetFileKey: fileToEdit.key, // Add unique key
      },
    });
  };

  const proceedWithoutLabel = () => {
    if (!selectedFileForEdit) return;

    const { pair, index } = selectedFileForEdit;

    console.log(
      "Proceeding without label for:",
      pair.fullName || pair.baseName,
      "at index:",
      index
    );
    console.log("Full pair data:", pair);

    // Update the pairs array to ensure the correct file is saved
    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(pairs, (k, v) => (v instanceof File ? undefined : v))
    );

    // Set the specific file we want to edit with unique identifier
    const fileToEdit = {
      ...pair,
      index,
      baseName: pair.baseName,
      fullName: pair.fullName || pair.baseName,
      key: pair.key || pair.fullName || pair.baseName,
    };

    sessionStorage.setItem(
      "hn_currentFile",
      JSON.stringify(fileToEdit, (k, v) => (v instanceof File ? undefined : v))
    );

    // Update global files reference with unique keys
    window.__HN_FILES__ = pairs.reduce((a, p) => {
      const key = p.key || p.fullName || p.baseName;
      a[key] = p;
      return a;
    }, {});

    console.log(
      "Navigating to editor with fileIndex:",
      index,
      "and key:",
      fileToEdit.key
    );

    nav("/workspace/manual/editor", {
      state: {
        apiMode,
        apiUrl,
        singleFile: true,
        fileIndex: index,
        targetFileName: pair.baseName,
        targetFileKey: fileToEdit.key, // Add unique key
      },
    });
    setShowLabelMissingAlert(false);
    setSelectedFileForEdit(null);
  };

  const deleteFile = async (index) => {
    const fileToDelete = pairs[index];
    const newPairs = pairs.filter((_, i) => i !== index);
    setPairs(newPairs);

    // Remove from localStorage
    try {
      if (fileToDelete.image) {
        const savedImages = JSON.parse(
          localStorage.getItem("hn_saved_images") || "[]"
        );
        const filteredImages = savedImages.filter(
          (saved) => saved.name !== fileToDelete.image.name
        );
        localStorage.setItem("hn_saved_images", JSON.stringify(filteredImages));
      }

      if (fileToDelete.label) {
        const savedLabels = JSON.parse(
          localStorage.getItem("hn_saved_labels") || "[]"
        );
        const filteredLabels = savedLabels.filter(
          (saved) => saved.name !== fileToDelete.label.name
        );
        localStorage.setItem("hn_saved_labels", JSON.stringify(filteredLabels));
      }
    } catch (error) {
      console.error("Error removing file from storage:", error);
    }

    sessionStorage.setItem(
      "hn_pairs",
      JSON.stringify(newPairs, (k, v) => (v instanceof File ? undefined : v))
    );
    window.__HN_FILES__ = newPairs.reduce(
      (a, p) => ((a[p.baseName] = p), a),
      {}
    );
  };

  const clearAllFiles = () => {
    setPairs([]);
    localStorage.removeItem("hn_saved_images");
    localStorage.removeItem("hn_saved_labels");
    sessionStorage.removeItem("hn_pairs");
    window.__HN_FILES__ = {};
    setShowClearConfirm(false);

    // Clear image URLs
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
    setImageUrls(new Map());
  };

  const go = () => {
    if (apiMode) localStorage.setItem("hn_apiUrl", apiUrl || "");
    localStorage.setItem("hn_ocrUrl", ocrUrl || "");
    nav("/workspace/manual/editor", { state: { apiMode, apiUrl } });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadFiles(files);
    }
  };

  // Cleanup URLs when component unmounts
  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
        <button
          onClick={() => nav("/")}
          className="hover:text-blue-400 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1 inline"
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
          Home
        </button>
        <span>/</span>
        <button
          onClick={() => nav("/workspace")}
          className="hover:text-blue-400 transition-colors"
        >
          Annotation Workspace
        </button>
        <span>/</span>
        <span className="text-blue-400">File Management</span>
        <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs ml-2">
          {apiMode ? "API Mode" : "Manual Mode"}
        </span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-200 mb-2">
            File Management
          </h2>
          <p className="text-slate-400">
            Upload and manage your annotation files
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-sec" onClick={() => nav("/workspace")}>
            <svg
              className="w-4 h-4 mr-2"
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
            Back
          </button>
          {pairs.length > 0 && (
            <button
              className="btn bg-red-500 hover:bg-red-600"
              onClick={() => setShowClearConfirm(true)}
            >
              <svg
                className="w-4 h-4 mr-2"
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
              Clear All
            </button>
          )}
          <button
            className="btn bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!pairs.length}
            onClick={go}
          >
            Continue to Annotation
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      </div>

      {apiMode && (
        <div className="feature-card mb-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">
            API Configuration
          </h3>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Remote Detection Endpoint (optional)
          </label>
          <input
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://your-endpoint.example.com/api/detect"
          />
          <p className="text-slate-400 text-sm mt-2">
            Leave empty to use local auto-detection (grid-based approach).
          </p>
        </div>
      )}

      {/* OCR Configuration - Available for both modes */}
      <div className="feature-card mb-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
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
          OCR Configuration
        </h3>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          OCR Recognition Endpoint (optional)
        </label>
        <input
          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          value={ocrUrl}
          onChange={(e) => setOcrUrl(e.target.value)}
          placeholder="https://your-ocr-endpoint.example.com/api/ocr"
        />
        <p className="text-slate-400 text-sm mt-2">
          OCR endpoint for Han-Nom character recognition after annotation.
        </p>
      </div>

      {/* Upload Section - Step by Step Flow */}
      <div className="feature-card mb-8">
        <h3 className="text-lg font-semibold mb-6 text-slate-200">
          {apiMode ? "Upload Images" : "Prepare Your Annotation Files"}
        </h3>

        <div
          className={`grid gap-6 ${
            apiMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {/* Step 1: Upload Images */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              isDragging
                ? "border-blue-400 bg-blue-500/10"
                : "border-slate-600/50 hover:border-slate-500/70"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-blue-500/20">
                <svg
                  className="w-7 h-7 text-blue-400"
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
              </div>
              <h4 className="text-base font-semibold text-slate-200 mb-1">
                Step 1: Upload Images
              </h4>
              <p className="text-xs text-slate-400 mb-4">JPG, PNG, WEBP</p>
              <label className="btn cursor-pointer text-sm">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Select Images
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => loadFiles(e.target.files)}
                />
              </label>
            </div>
          </div>

          {/* Step 2: Upload Labels (Manual Mode Only) */}
          {!apiMode && (
            <div className="border-2 border-dashed rounded-2xl p-8 text-center hover:border-slate-500/70 transition-all border-slate-600/50">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-amber-500/20">
                  <svg
                    className="w-7 h-7 text-amber-400"
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
                </div>
                <h4 className="text-base font-semibold text-slate-200 mb-1">
                  Step 2: Upload Labels
                </h4>
                <p className="text-xs text-slate-400 mb-4">TXT (optional)</p>
                <label className="btn-sec cursor-pointer text-sm">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Select Labels
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".txt"
                    onChange={(e) => loadFiles(e.target.files)}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-4 text-center">
          💡 Tip: Match file names for automatic pairing (e.g., image.jpg with
          image.txt)
        </p>
      </div>

      {pairs.length > 0 && (
        <div className="feature-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-200">
              File Pairs ({pairs.length})
            </h3>
            <div className="text-sm text-slate-400">
              {pairs.filter((p) => p.annotations).length} with annotations •
              {pairs.filter((p) => !p.annotations).length} without annotations
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-auto">
            {pairs.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-colors"
              >
                {/* Image Thumbnail */}
                <div
                  className="w-16 h-16 bg-slate-700/50 rounded-lg overflow-hidden cursor-pointer group relative"
                  onClick={() => setPreviewImage(createImageUrl(p.image))}
                >
                  <img
                    src={createImageUrl(p.image)}
                    alt={p.baseName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div className="w-full h-full bg-slate-700/50 items-center justify-center hidden">
                    <svg
                      className="w-6 h-6 text-slate-400"
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
                  </div>
                  {/* Preview overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
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
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="font-medium text-slate-200 truncate"
                    title={p.fullName || p.baseName}
                  >
                    {p.fullName || p.baseName}
                  </div>
                  <div className="text-slate-400 text-sm flex items-center gap-2">
                    {p.annotations ? (
                      <>
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        {p.annotations.length} annotations •{" "}
                        {p.imageSize || "2.0 MB"}
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        No label file • {p.imageSize || "2.0 MB"}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="p-2 text-slate-400 hover:text-blue-400 transition-colors hover:bg-blue-500/10 rounded-lg"
                    onClick={() => editFile(p, i)}
                    title="Edit annotations"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg"
                    onClick={() => deleteFile(i)}
                    title="Delete file"
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
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-green-400 text-sm">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Files loaded successfully
            </div>
            <p className="text-green-300 text-sm mt-1">
              {pairs.length} file pair(s) ready for annotation. Files are
              automatically saved to local storage.
            </p>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-full relative">
            <button
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Label Missing Alert Modal */}
      {showLabelMissingAlert && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-200">
                Missing Label File
              </h3>
            </div>
            <p className="text-slate-400 mb-6">
              This file doesn't have a corresponding TXT label file. You can
              still proceed to create annotations manually, or upload the label
              file first.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-sec"
                onClick={() => {
                  setShowLabelMissingAlert(false);
                  setSelectedFileForEdit(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn bg-blue-500 hover:bg-blue-600"
                onClick={proceedWithoutLabel}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-200">
                Clear All Files
              </h3>
            </div>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete all uploaded files? This action
              cannot be undone and will remove all images and labels from local
              storage.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-sec"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn bg-red-500 hover:bg-red-600"
                onClick={clearAllFiles}
              >
                Delete All Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
