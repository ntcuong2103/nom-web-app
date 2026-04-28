"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { AnnotationDraft } from "@/lib/types";

const AnnotationCanvas = dynamic(
  () => import("@/components/annotation/AnnotationCanvas").then((mod) => mod.AnnotationCanvas),
  { ssr: false }
);

export default function AnnotatePage({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = use(params);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [labelFilter, setLabelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [label, setLabel] = useState("");
  const filterParams = useMemo(() => {
    const query = new URLSearchParams();
    if (labelFilter) query.set("label", labelFilter);
    if (statusFilter) query.set("status", statusFilter);
    return query.toString();
  }, [labelFilter, statusFilter]);
  const { data: image } = useQuery({ queryKey: ["image", imageId], queryFn: () => api.image(imageId) });
  const { data: annotations = [] } = useQuery({ queryKey: ["annotations", imageId, filterParams], queryFn: () => api.annotations(imageId, filterParams) });
  const { data: events = [] } = useQuery({ queryKey: ["events", imageId], queryFn: () => api.imageEvents(imageId) });
  const selected = annotations.find((annotation) => annotation.id === selectedId) ?? null;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["annotations", imageId] });
    queryClient.invalidateQueries({ queryKey: ["events", imageId] });
  };
  const create = useMutation({ mutationFn: (draft: AnnotationDraft) => api.createAnnotation(imageId, draft), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, changes }: { id: number; changes: Partial<AnnotationDraft> }) => api.updateAnnotation(id, changes), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteAnnotation(id), onSuccess: invalidate });

  useEffect(() => {
    setLabel(selected?.label ?? "");
  }, [selected?.label]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) remove.mutate(selectedId);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && selectedId) {
        event.preventDefault();
        update.mutate({ id: selectedId, changes: { label } });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [label, remove, selectedId, update]);

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{image?.filename ?? "Annotate image"}</h1>
          {image ? <Link href={`/datasets/${image.dataset_id}`} className="text-sm text-moss underline">Back to dataset</Link> : null}
        </div>
        <div className="flex gap-2">
          <input value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} className="rounded border border-line px-3 py-2" placeholder="Filter label" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded border border-line px-3 py-2">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {image ? (
          <AnnotationCanvas
            image={image}
            annotations={annotations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={(draft) => create.mutate(draft)}
            onChange={(id, changes) => update.mutate({ id, changes })}
          />
        ) : (
          <div className="rounded-md border border-line bg-white p-4">Loading image...</div>
        )}
        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-white p-4">
            <h2 className="mb-3 font-semibold">Selected annotation</h2>
            {selected ? (
              <div>
                <input value={label} onChange={(event) => setLabel(event.target.value)} className="mb-3 w-full rounded border border-line px-3 py-2" />
                <div className="mb-3 grid grid-cols-4 gap-2 text-xs text-moss">
                  <span>x {selected.x.toFixed(0)}</span>
                  <span>y {selected.y.toFixed(0)}</span>
                  <span>w {selected.w.toFixed(0)}</span>
                  <span>h {selected.h.toFixed(0)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => update.mutate({ id: selected.id, changes: { label } })} className="flex items-center gap-2 rounded bg-ink px-3 py-2 text-white">
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <button onClick={() => remove.mutate(selected.id)} className="flex items-center gap-2 rounded border border-line px-3 py-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-moss">Select a rectangle or drag on the image to create one.</p>
            )}
          </section>
          <section className="rounded-md border border-line bg-white p-4">
            <h2 className="mb-3 font-semibold">Annotations</h2>
            <div className="max-h-56 space-y-2 overflow-auto">
              {annotations.map((annotation) => (
                <button key={annotation.id} onClick={() => setSelectedId(annotation.id)} className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedId === annotation.id ? "border-clay bg-field" : "border-line"}`}>
                  <span className="font-medium">{annotation.label}</span>
                  <span className="ml-2 text-moss">{annotation.status}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-md border border-line bg-white p-4">
            <h2 className="mb-3 font-semibold">History</h2>
            <div className="max-h-72 space-y-2 overflow-auto text-sm">
              {events.map((event) => (
                <div key={event.id} className="rounded border border-line p-2">
                  <div className="font-medium">{event.event_type}</div>
                  <div className="text-xs text-moss">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
