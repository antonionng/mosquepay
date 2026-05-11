"use client";

import { useRef, useState } from "react";
import { Images, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SiteAsset = {
  id: string | null;
  name: string;
  path: string;
  url: string;
  size: number | null;
  mimetype: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ImageUploadFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  onClear?: () => void;
  help?: string;
  compact?: boolean;
};

export function ImageUploadField({
  label,
  value,
  onChange,
  onClear,
  help,
  compact = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadLibrary() {
    setLibraryOpen((current) => !current);
    if (libraryOpen || assets.length > 0) return;
    setLoadingLibrary(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-assets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load media library.");
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load media library.");
    } finally {
      setLoadingLibrary(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/site-assets", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange(data.url);
      setAssets((current) =>
        data.path
          ? [
              {
                id: data.path,
                name: data.path.split("/").pop() ?? "Uploaded image",
                path: data.path,
                url: data.url,
                size: file.size,
                mimetype: file.type,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              ...current,
            ]
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-dash-muted">{label}</label>
        {value ? (
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(""))}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        ) : null}
      </div>
      {value ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-dash-border bg-dash-surface-subtle",
            compact ? "h-24" : "h-36"
          )}
        >
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-dash-border bg-dash-surface-subtle text-center text-sm text-dash-muted transition-colors hover:border-dash-ring/50 hover:text-dash-text",
            compact ? "min-h-24 p-3" : "min-h-32 p-4"
          )}
        >
          <ImagePlus className="h-5 w-5" />
          <span>Upload an image</span>
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="dashboard"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {value ? "Replace" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="dashboard"
          size="sm"
          onClick={() => void loadLibrary()}
          disabled={loadingLibrary}
          className="gap-2"
        >
          {loadingLibrary ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Images className="h-3.5 w-3.5" />
          )}
          Library
        </Button>
        <Input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or paste an https image URL"
          className="min-w-56 flex-1"
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {libraryOpen && (
        <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-3">
          {assets.length === 0 ? (
            <p className="py-4 text-center text-xs text-dash-muted">
              No uploaded website images yet.
            </p>
          ) : (
            <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  onClick={() => {
                    onChange(asset.url);
                    setLibraryOpen(false);
                  }}
                  className="group overflow-hidden rounded-lg border border-dash-border bg-white text-left transition hover:border-dash-ring/60"
                >
                  <img
                    src={asset.url}
                    alt=""
                    className="h-20 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                  <span className="block truncate px-2 py-1.5 text-[11px] text-dash-muted">
                    {asset.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {help ? <p className="text-xs text-dash-muted">{help}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
