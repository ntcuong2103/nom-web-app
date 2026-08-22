"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";

export default function DatasetsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importDatasetId, setImportDatasetId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"zip" | "folder">("zip");
  const [imageRoot, setImageRoot] = useState("");
  const [labelRoot, setLabelRoot] = useState("");
  const importMutation = useMutation({
    mutationFn: () =>
      importMode === "zip"
        ? api.importYolo(importDatasetId, importFile!)
        : api.importFolder(importDatasetId, imageRoot, labelRoot),
    onSuccess: () => { setImportFile(null); queryClient.invalidateQueries({ queryKey: ["datasets"] }); }
  });
  const create = useMutation({
    mutationFn: () => api.createDataset({ name, description: description || null }),
    onSuccess: () => {
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-md border border-line bg-white p-4">
          <h1 className="mb-4 text-xl font-semibold">Datasets</h1>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mb-3 w-full rounded border border-line px-3 py-2" placeholder="Dataset name" required />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mb-3 min-h-24 w-full rounded border border-line px-3 py-2" placeholder="Description" />
          <button className="flex items-center gap-2 rounded bg-ink px-3 py-2 text-white">
            <Plus className="h-4 w-4" />
            Create
          </button>
        </form>
        <div className="h-fit rounded-md border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold">Import</h2>
          <select value={importDatasetId} onChange={(event) => setImportDatasetId(event.target.value)} className="mb-3 w-full rounded border border-line px-3 py-2">
            <option value="">Choose dataset</option>
            {data.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
          </select>
          <div className="mb-3 flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={importMode === "zip"} onChange={() => setImportMode("zip")} /> YOLO zip archive
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={importMode === "folder"} onChange={() => setImportMode("folder")} /> Server folder paths
            </label>
          </div>
          {importMode === "zip" ? (
            <input type="file" accept=".zip,application/zip" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} className="mb-3 w-full text-sm" />
          ) : (
            <>
              <input value={imageRoot} onChange={(event) => setImageRoot(event.target.value)} className="mb-2 w-full rounded border border-line px-3 py-2 text-sm" placeholder="Image root, e.g. /data/nomnaocr/images" />
              <input value={labelRoot} onChange={(event) => setLabelRoot(event.target.value)} className="mb-3 w-full rounded border border-line px-3 py-2 text-sm" placeholder="Label root, e.g. /data/nomnaocr/pseudo_labels_v0.1" />
              <p className="mb-3 text-xs text-moss">
                Paths are read from the server&apos;s filesystem. Each label file&apos;s path relative
                to the label root must match an image with the same relative path (any of
                .jpg/.jpeg/.png/.webp) under the image root. Label rows are
                <code> character x y w h selected box_id</code> (normalized box, no classes.txt needed).
              </p>
            </>
          )}
          <button
            type="button"
            disabled={!importDatasetId || (importMode === "zip" ? !importFile : !imageRoot || !labelRoot) || importMutation.isPending}
            onClick={() => importMutation.mutate()}
            className="flex items-center gap-2 rounded bg-clay px-3 py-2 text-white disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          {importMutation.isSuccess ? (
            <p className="mt-2 text-sm text-moss">
              Imported {importMutation.data.images_imported} image(s), {importMutation.data.annotations_imported} annotation(s).
              {importMutation.data.errors.length > 0 ? ` ${importMutation.data.errors.length} row(s) skipped with errors.` : ""}
            </p>
          ) : null}
          {importMutation.isError ? <p className="mt-2 text-sm text-red-700">{(importMutation.error as Error).message}</p> : null}
        </div>
        <section>
          {isLoading ? <p>Loading datasets...</p> : null}
          {error ? <p className="text-red-700">Sign in to load datasets.</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((dataset) => (
              <Link key={dataset.id} href={`/datasets/${dataset.id}`} className="rounded-md border border-line bg-white p-4 hover:border-clay">
                <h2 className="font-semibold text-ink">{dataset.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-moss">{dataset.description || "No description"}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

