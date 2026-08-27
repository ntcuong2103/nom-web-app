"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, RotateCcw, Settings2, Tag, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, cropUrl, fetchAuthedObjectUrl } from "@/lib/api";
import { ReviewFilterParams, ReviewItem, ReviewPreviousState } from "@/lib/types";

const PAGE_SIZE = 60;
const GRID_COLUMNS = 6;
const DISPLAY_SETTINGS_KEY = "nom_review_display";

type DisplaySettings = {
  showLink: boolean;
  showLabel: boolean;
  showFolder: boolean;
  showStatus: boolean;
  showConfidence: boolean;
  showFilename: boolean;
  showId: boolean;
  thumbSize: 64 | 96 | 144;
};

const DEFAULT_DISPLAY: DisplaySettings = {
  showLink: true,
  showLabel: true,
  showFolder: true,
  showStatus: true,
  showConfidence: true,
  showFilename: false,
  showId: false,
  thumbSize: 96
};

function loadDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_DISPLAY;
  try {
    const raw = window.localStorage.getItem(DISPLAY_SETTINGS_KEY);
    if (!raw) return DEFAULT_DISPLAY;
    return { ...DEFAULT_DISPLAY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DISPLAY;
  }
}

function saveDisplaySettings(settings: DisplaySettings) {
  try {
    window.localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // per-viewer convenience only; ignore storage failures (private mode, quota, etc.)
  }
}

function ReviewThumb({ item, size }: { item: ReviewItem; size: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    fetchAuthedObjectUrl(cropUrl(item.image_id, item.x, item.y, item.w, item.h, size)).then((url) => {
      if (cancelled) return;
      objectUrl = url;
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.image_id, item.x, item.y, item.w, item.h, size]);

  const style = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={item.label} style={style} className="rounded bg-field object-contain" />
  ) : (
    <div style={style} className="animate-pulse rounded bg-field" />
  );
}

export default function ReviewPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = use(params);
  const queryClient = useQueryClient();

  const [label, setLabel] = useState("");
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState("review");
  const [sort, setSort] = useState<string>("confidence_asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [lastAction, setLastAction] = useState<{ datasetId: string; previous: ReviewPreviousState[] } | null>(null);
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);

  useEffect(() => {
    setDisplay(loadDisplaySettings());
  }, []);

  function updateDisplay(changes: Partial<DisplaySettings>) {
    setDisplay((prev) => {
      const next = { ...prev, ...changes };
      saveDisplaySettings(next);
      return next;
    });
  }

  const filters: ReviewFilterParams = useMemo(
    () => ({ label: label || undefined, folder: folder || undefined, status: status || undefined }),
    [label, folder, status]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["review", datasetId, filters, sort, page],
    queryFn: () => api.reviewList(datasetId, filters, sort, PAGE_SIZE, page * PAGE_SIZE)
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    setSelected(new Set());
    setSelectAllMatching(false);
    setFocusIndex(0);
  }, [label, folder, status, sort, page]);

  function toggle(id: number) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectPage() {
    setSelectAllMatching(false);
    setSelected(new Set(items.map((item) => item.id)));
  }

  function clearSelection() {
    setSelectAllMatching(false);
    setSelected(new Set());
  }

  function selectAll() {
    if (!window.confirm(`This will select all ${total} annotations matching the current filter, across every page. Continue?`)) return;
    setSelectAllMatching(true);
    setSelected(new Set());
  }

  const target = selectAllMatching ? { all_matching: filters } : { ids: Array.from(selected) };
  const selectionCount = selectAllMatching ? total : selected.size;

  function afterBulkAction(result: { updated: number; previous: ReviewPreviousState[] }) {
    setLastAction({ datasetId, previous: result.previous });
    setSelected(new Set());
    setSelectAllMatching(false);
    queryClient.invalidateQueries({ queryKey: ["review", datasetId] });
  }

  const approve = useMutation({
    mutationFn: () => api.bulkApprove(datasetId, target),
    onSuccess: afterBulkAction
  });
  const reject = useMutation({
    mutationFn: () => api.bulkReject(datasetId, target),
    onSuccess: afterBulkAction
  });
  const relabel = useMutation({
    mutationFn: (newLabel: string) => api.bulkRelabel(datasetId, newLabel, target),
    onSuccess: afterBulkAction
  });
  const undo = useMutation({
    mutationFn: () => api.restoreAnnotations(lastAction!.datasetId, lastAction!.previous),
    onSuccess: () => {
      setLastAction(null);
      queryClient.invalidateQueries({ queryKey: ["review", datasetId] });
    }
  });

  function onRelabelClick() {
    const newLabel = window.prompt(`Relabel ${selectionCount} annotation(s) to:`);
    if (newLabel) relabel.mutate(newLabel);
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return;
    if (event.key === "ArrowRight") { setFocusIndex((i) => Math.min(i + 1, items.length - 1)); event.preventDefault(); }
    else if (event.key === "ArrowLeft") { setFocusIndex((i) => Math.max(i - 1, 0)); event.preventDefault(); }
    else if (event.key === "ArrowDown") { setFocusIndex((i) => Math.min(i + GRID_COLUMNS, items.length - 1)); event.preventDefault(); }
    else if (event.key === "ArrowUp") { setFocusIndex((i) => Math.max(i - GRID_COLUMNS, 0)); event.preventDefault(); }
    else if (event.key === " ") { toggle(items[focusIndex].id); event.preventDefault(); }
    else if (event.key === "a" || event.key === "A") { api.bulkApprove(datasetId, { ids: [items[focusIndex].id] }).then((r) => afterBulkAction(r)); }
    else if (event.key === "r" || event.key === "R") { api.bulkReject(datasetId, { ids: [items[focusIndex].id] }).then((r) => afterBulkAction(r)); }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const busy = approve.isPending || reject.isPending || relabel.isPending;

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/datasets/${datasetId}`} className="flex items-center gap-1 text-sm text-moss">
            <ArrowLeft className="h-4 w-4" /> Back to dataset
          </Link>
          <h1 className="text-xl font-semibold">Group review</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowDisplayOptions((v) => !v)} className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm">
            <Settings2 className="h-4 w-4" /> Display
          </button>
          {lastAction ? (
            <button type="button" onClick={() => undo.mutate()} disabled={undo.isPending} className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Undo last action
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-4">
        <input value={label} onChange={(event) => { setLabel(event.target.value); setPage(0); }} className="rounded border border-line px-3 py-2" placeholder="Character / label" />
        <input value={folder} onChange={(event) => { setFolder(event.target.value); setPage(0); }} className="rounded border border-line px-3 py-2" placeholder="Folder" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="rounded border border-line px-3 py-2">
          <option value="">Any status</option>
          <option value="review">Review</option>
          <option value="active">Active</option>
          <option value="deleted">Deleted</option>
        </select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} className="rounded border border-line px-3 py-2">
          <option value="confidence_asc">Lowest confidence first</option>
          <option value="confidence_desc">Highest confidence first</option>
          <option value="">Default order</option>
        </select>
      </div>

      {showDisplayOptions ? (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-line bg-white p-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showLink} onChange={(event) => updateDisplay({ showLink: event.target.checked })} />
            Link to page
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showLabel} onChange={(event) => updateDisplay({ showLabel: event.target.checked })} />
            Label
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showFolder} onChange={(event) => updateDisplay({ showFolder: event.target.checked })} />
            Folder
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showStatus} onChange={(event) => updateDisplay({ showStatus: event.target.checked })} />
            Status
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showConfidence} onChange={(event) => updateDisplay({ showConfidence: event.target.checked })} />
            Confidence
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showFilename} onChange={(event) => updateDisplay({ showFilename: event.target.checked })} />
            Page filename
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={display.showId} onChange={(event) => updateDisplay({ showId: event.target.checked })} />
            Annotation id
          </label>
          <label className="flex items-center gap-1.5">
            Thumbnail size
            <select
              value={display.thumbSize}
              onChange={(event) => updateDisplay({ thumbSize: Number(event.target.value) as DisplaySettings["thumbSize"] })}
              className="rounded border border-line px-2 py-1"
            >
              <option value={64}>Small</option>
              <option value={96}>Medium</option>
              <option value={144}>Large</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-3 text-sm">
        <span className="font-medium">{total} matching</span>
        <button type="button" onClick={selectPage} className="rounded border border-line px-2 py-1">Select page</button>
        <button type="button" onClick={selectAll} className="rounded border border-line px-2 py-1">Select all {total} matching</button>
        <button type="button" onClick={clearSelection} className="rounded border border-line px-2 py-1">Clear selection</button>
        <span className="mx-2 text-moss">{selectionCount} selected</span>
        <button type="button" onClick={() => approve.mutate()} disabled={selectionCount === 0 || busy} className="flex items-center gap-1 rounded bg-moss px-3 py-1.5 text-white disabled:opacity-50">
          <Check className="h-4 w-4" /> Approve
        </button>
        <button type="button" onClick={() => reject.mutate()} disabled={selectionCount === 0 || busy} className="flex items-center gap-1 rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> Reject
        </button>
        <button type="button" onClick={onRelabelClick} disabled={selectionCount === 0 || busy} className="flex items-center gap-1 rounded bg-clay px-3 py-1.5 text-white disabled:opacity-50">
          <Tag className="h-4 w-4" /> Relabel
        </button>
      </div>

      {isLoading ? <p>Loading...</p> : null}
      <div
        className="grid grid-cols-3 gap-3 outline-none sm:grid-cols-4 md:grid-cols-6"
        tabIndex={0}
        onKeyDown={onGridKeyDown}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex flex-col items-center gap-1 rounded-md border p-2 ${
              selected.has(item.id) ? "border-clay bg-clay/10" : index === focusIndex ? "border-ink" : "border-line bg-white"
            }`}
            onClick={() => { setFocusIndex(index); toggle(item.id); }}
          >
            <div className="relative">
              <ReviewThumb item={item} size={display.thumbSize} />
              {display.showLink ? (
                <Link
                  href={`/images/${item.image_id}/annotate?focus=${item.id}`}
                  target="_blank"
                  title="Open the original page"
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} onClick={(event) => event.stopPropagation()} />
              {display.showLabel ? <span className="font-medium">{item.label}</span> : null}
            </div>
            {display.showStatus || display.showConfidence ? (
              <span className="text-[10px] text-moss">
                {display.showStatus ? item.status : ""}
                {display.showStatus && display.showConfidence && item.confidence != null ? " · " : ""}
                {display.showConfidence && item.confidence != null ? item.confidence.toFixed(2) : ""}
              </span>
            ) : null}
            {display.showFolder ? (
              <span className="max-w-full truncate text-[10px] text-moss" title={item.source_folder ?? ""}>{item.source_folder ?? "-"}</span>
            ) : null}
            {display.showFilename ? (
              <span className="max-w-full truncate text-[10px] text-moss" title={item.image_filename}>{item.image_filename}</span>
            ) : null}
            {display.showId ? <span className="text-[10px] text-moss">#{item.id}</span> : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded border border-line px-3 py-1.5 disabled:opacity-50">Prev</button>
        <span>Page {page + 1} of {pageCount}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page + 1 >= pageCount} className="rounded border border-line px-3 py-1.5 disabled:opacity-50">Next</button>
      </div>

      <p className="mt-3 text-center text-xs text-moss">
        Keyboard: arrow keys move focus, space toggles selection, A approves the focused box, R rejects it.
      </p>
    </AppShell>
  );
}
