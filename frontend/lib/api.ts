import type {
  Annotation,
  AnnotationDraft,
  AnnotationEvent,
  AuthToken,
  Dataset,
  ExportResult,
  ImageRecord
} from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const TOKEN_KEY = "nom_access_token";

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export async function downloadExport(path: string, filename: string) {
  const token = getToken();
  const response = await fetch(API_BASE + path, { headers: token ? { Authorization: "Bearer " + token } : undefined });
  if (!response.ok) throw new Error("Download failed (" + response.status + ")");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthToken>("/auth/login", json("POST", { email, password })),

  register: (email: string, password: string) =>
    request<AuthToken>("/auth/register", json("POST", { email, password })),

  datasets: () => request<Dataset[]>("/datasets"),

  createDataset: (payload: { name: string; description: string | null }) =>
    request<Dataset>("/datasets", json("POST", payload)),

  dataset: (datasetId: string) => request<Dataset>(`/datasets/${datasetId}`),

  images: (datasetId: string, query = "") =>
    request<ImageRecord[]>(`/datasets/${datasetId}/images${query ? `?${query}` : ""}`),

  uploadImage: (datasetId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<ImageRecord>(`/datasets/${datasetId}/images`, { method: "POST", body });
  },

  image: (imageId: string) => request<ImageRecord>(`/images/${imageId}`),

  annotations: (imageId: string, query = "") =>
    request<Annotation[]>(`/images/${imageId}/annotations${query ? `?${query}` : ""}`),

  createAnnotation: (imageId: string, payload: AnnotationDraft) =>
    request<Annotation>(`/images/${imageId}/annotations`, json("POST", payload)),

  updateAnnotation: (annotationId: number, payload: Partial<AnnotationDraft>) =>
    request<Annotation>(`/annotations/${annotationId}`, json("PATCH", payload)),

  deleteAnnotation: (annotationId: number) =>
    request<Annotation>(`/annotations/${annotationId}`, { method: "DELETE" }),

  imageEvents: (imageId: string) =>
    request<AnnotationEvent[]>(`/images/${imageId}/events`),

  exportYolo: (datasetId: string) =>
    request<ExportResult>(`/datasets/${datasetId}/export/yolo`, { method: "POST" }),

  importYolo: (datasetId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<ImportResult>(`/datasets/${datasetId}/import/yolo`, { method: "POST", body });
  },

  importFolder: (datasetId: string, imageRoot: string, labelRoot: string) =>
    request<ImportResult>(`/datasets/${datasetId}/import/folder`, json("POST", { image_root: imageRoot, label_root: labelRoot }))
};

type ImportResult = { images_imported: number; annotations_imported: number; errors: string[] };

export function imageFileUrl(imageId: number) {
  return `${API_BASE}/images/${imageId}/file`;
}
