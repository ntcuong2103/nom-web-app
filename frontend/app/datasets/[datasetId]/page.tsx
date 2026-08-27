"use client";

import { ChangeEvent, use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Download, ImagePlus, Pencil } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = use(params);
  const queryClient = useQueryClient();
  const [filename, setFilename] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const query = useMemo(() => new URLSearchParams({ filename, label, status }), [filename, label, status]);
  [...query.keys()].forEach((key) => !query.get(key) && query.delete(key));
  const { data: dataset } = useQuery({ queryKey: ["dataset", datasetId], queryFn: () => api.dataset(datasetId) });
  const { data: images = [] } = useQuery({ queryKey: ["images", datasetId, query.toString()], queryFn: () => api.images(datasetId, query.toString()) });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(datasetId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["images", datasetId] })
  });

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) upload.mutate(file);
  }

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{dataset?.name ?? "Dataset"}</h1>
          <p className="text-sm text-moss">{dataset?.description}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/datasets/${datasetId}/review`} className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2">
            <CheckSquare className="h-4 w-4" />
            Review
          </Link>
          <Link href={`/datasets/${datasetId}/export`} className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2">
            <Download className="h-4 w-4" />
            Export
          </Link>
        </div>
      </div>
      <div className="mb-4 grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-4">
        <input value={filename} onChange={(event) => setFilename(event.target.value)} className="rounded border border-line px-3 py-2" placeholder="Filename" />
        <input value={label} onChange={(event) => setLabel(event.target.value)} className="rounded border border-line px-3 py-2" placeholder="Label" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-line px-3 py-2">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="review">Review</option>
          <option value="deleted">Deleted</option>
        </select>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-white">
          <ImagePlus className="h-4 w-4" />
          Upload image
          <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {images.map((image) => (
          <Link key={image.id} href={`/images/${image.id}/annotate`} className="rounded-md border border-line bg-white p-4 hover:border-clay">
            <div className="mb-3 flex aspect-video items-center justify-center rounded bg-field text-sm text-moss">
              {image.width} x {image.height}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{image.filename}</span>
              <Pencil className="h-4 w-4 shrink-0 text-clay" />
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
