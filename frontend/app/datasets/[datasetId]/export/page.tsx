"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { API_BASE, api } from "@/lib/api";

export default function ExportPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = use(params);
  const [url, setUrl] = useState("");
  const exportMutation = useMutation({
    mutationFn: () => api.exportYolo(datasetId),
    onSuccess: (result) => setUrl(`${API_BASE}${result.download_url}`)
  });

  return (
    <AppShell>
      <div className="max-w-xl rounded-md border border-line bg-white p-5">
        <h1 className="mb-2 text-2xl font-semibold">YOLO export</h1>
        <p className="mb-5 text-sm text-moss">Generate a zip with images, label text files, and classes.txt for the current annotations.</p>
        <button onClick={() => exportMutation.mutate()} className="mb-4 flex items-center gap-2 rounded bg-clay px-3 py-2 text-white">
          <Download className="h-4 w-4" />
          Generate
        </button>
        {url ? <a className="font-medium text-clay underline" href={url}>Download export</a> : null}
        <div className="mt-6">
          <Link className="text-sm text-moss underline" href={`/datasets/${datasetId}`}>Back to dataset</Link>
        </div>
      </div>
    </AppShell>
  );
}
