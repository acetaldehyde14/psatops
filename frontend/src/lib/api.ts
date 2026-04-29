import axios from "axios";
import type {
  PalletiseRequest,
  PalletiseResponse,
  CompareResponse,
  UploadResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

export async function palletise(req: PalletiseRequest): Promise<PalletiseResponse> {
  const { data } = await api.post<PalletiseResponse>("/api/v1/palletise", req);
  return data;
}

export async function compare(req: Omit<PalletiseRequest, "algorithm"> & { algorithms: string[] }): Promise<CompareResponse> {
  const { data } = await api.post<CompareResponse>("/api/v1/palletise/compare", req);
  return data;
}

export async function getJob(jobId: string): Promise<PalletiseResponse> {
  const { data } = await api.get<PalletiseResponse>(`/api/v1/jobs/${jobId}`);
  return data;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResponse>("/api/v1/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export function exportCsvUrl(jobId: string): string {
  return `${BASE_URL}/api/v1/jobs/${jobId}/export/csv`;
}

export async function patchLayout(
  jobId: string,
  req: import("./types").LayoutPatchRequest
): Promise<import("./types").LayoutPatchResponse> {
  const { data } = await api.patch(`/api/v1/jobs/${jobId}/layout`, req);
  return data;
}

export function exportJsonData(result: PalletiseResponse): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.job_id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
