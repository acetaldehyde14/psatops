"use client";
import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "@/lib/api";
import type { UploadResponse } from "@/lib/types";

interface Props {
  onUploaded: (result: UploadResponse) => void;
}

export default function UploadDropzone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const result = await uploadFile(file);
        onUploaded(result);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onUploaded]
  );

  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl cursor-pointer p-10 transition-colors ${
        dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-blue-400"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handle(file);
      }}
    >
      <Upload size={36} className="text-blue-400" />
      <div className="text-center">
        <p className="font-semibold text-gray-700">Drop CSV or Excel file here</p>
        <p className="text-sm text-gray-400">.csv, .xlsx, .xls supported</p>
      </div>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
        }}
      />
      {loading && <p className="text-sm text-blue-600">Uploading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </label>
  );
}
