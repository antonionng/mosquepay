"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function formatBytes(size: number | null) {
  if (!size) return "Unknown size";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAssets() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/site-assets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load media library.");
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load media library.");
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/site-assets", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setMessage("Image uploaded.");
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteAsset(path: string) {
    setDeletingPath(path);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/site-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setAssets((current) => current.filter((asset) => asset.path !== path));
      setMessage("Image deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingPath(null);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  return (
    <div className="admin-surface p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dash-text">Website media library</h2>
          <p className="mt-1 max-w-2xl text-sm text-dash-muted">
            Store lodge website images once, then reuse them in sections, hero backgrounds,
            and design blocks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="dashboard"
            onClick={() => void loadAssets()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload images
          </Button>
        </div>
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

      {message ? (
        <div className="mt-5 rounded-xl border border-dash-border bg-dash-surface-subtle px-4 py-3 text-sm text-dash-text">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 flex min-h-64 items-center justify-center rounded-2xl border border-dash-border bg-dash-surface-subtle text-dash-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading media library...
        </div>
      ) : assets.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-dash-border bg-dash-surface-subtle p-10 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-dash-muted" />
          <h3 className="mt-3 font-semibold text-dash-text">No website images yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-dash-muted">
            Upload hero images, room photos, charity shots, and lodge visuals here.
          </p>
          <Button
            type="button"
            variant="primary"
            className="mt-5"
            onClick={() => inputRef.current?.click()}
          >
            Upload first image
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <div
              key={asset.path}
              className="overflow-hidden rounded-2xl border border-dash-border bg-dash-surface-subtle"
            >
              <a href={asset.url} target="_blank" rel="noreferrer">
                <img src={asset.url} alt="" className="h-44 w-full object-cover" />
              </a>
              <div className="space-y-3 p-4">
                <div>
                  <p className="truncate text-sm font-semibold text-dash-text">{asset.name}</p>
                  <p className="mt-1 text-xs text-dash-muted">
                    {asset.mimetype ?? "Image"} · {formatBytes(asset.size)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="dashboard"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(asset.url);
                      setMessage("Image URL copied.");
                    }}
                    className="gap-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy URL
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteAsset(asset.path)}
                    disabled={deletingPath === asset.path}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    {deletingPath === asset.path ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
