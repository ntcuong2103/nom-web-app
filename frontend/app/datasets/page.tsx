"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";

export default function DatasetsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

