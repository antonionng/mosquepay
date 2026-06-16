import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "site-assets";
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(type: string, fallback: string) {
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return fromType[type] ?? fallback.replace(/[^a-z0-9]/gi, "").toLowerCase() ?? "jpg";
}

function safeName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isSafeAssetPath(path: unknown, mosqueId: string): path is string {
  return (
    typeof path === "string" &&
    path.startsWith(`${mosqueId}/`) &&
    !path.includes("..") &&
    !path.includes("//") &&
    path.length <= 512
  );
}

async function ensureBucket() {
  const supabase = createServiceClient();
  const existing = await supabase.storage.getBucket(BUCKET);
  if (!existing.error) return supabase;

  const created = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
    fileSizeLimit: MAX_FILE_SIZE,
  });
  if (created.error) {
    throw created.error;
  }
  return supabase;
}

async function getAuthorizedAssetContext() {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return { error: unauthorized };

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return {
      error: NextResponse.json(
        { error: "Choose a mosque before managing website images." },
        { status: 400 }
      ),
    };
  }

  const forbidden = await requireAdminApiPermission("website:write", ctx.mosqueId);
  if (forbidden) return { error: forbidden };

  return { ctx };
}

export async function GET() {
  try {
    const auth = await getAuthorizedAssetContext();
    if ("error" in auth) return auth.error;
    const mosqueId = auth.ctx.mosqueId;
    if (!mosqueId) {
      return NextResponse.json({ error: "Choose a mosque first." }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Media library needs Supabase Storage to be configured." },
        { status: 503 }
      );
    }

    const supabase = await ensureBucket();
    const { data, error } = await supabase.storage.from(BUCKET).list(mosqueId, {
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw error;

    const assets = (data ?? [])
      .filter((item) => item.name && item.id !== null)
      .map((item) => {
        const path = `${mosqueId}/${item.name}`;
        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return {
          id: item.id,
          name: item.name,
          path,
          url: publicData.publicUrl,
          size: item.metadata?.size ?? null,
          mimetype: item.metadata?.mimetype ?? null,
          created_at: item.created_at ?? null,
          updated_at: item.updated_at ?? null,
        };
      });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Site assets list error:", error);
    return NextResponse.json({ error: "Could not load media library." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthorizedAssetContext();
    if ("error" in auth) return auth.error;
    const mosqueId = auth.ctx.mosqueId;
    if (!mosqueId) {
      return NextResponse.json({ error: "Choose a mosque first." }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Upload a JPG, PNG, WebP, or GIF image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Images must be smaller than 6 MB." },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Image uploads need Supabase Storage to be configured." },
        { status: 503 }
      );
    }

    const supabase = await ensureBucket();
    const ext = extensionFor(file.type, file.name.split(".").pop() ?? "jpg");
    const stem = safeName(file.name) || "site-image";
    const path = `${mosqueId}/${Date.now()}-${crypto.randomUUID()}-${stem}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error) {
    console.error("Site asset upload error:", error);
    return NextResponse.json({ error: "Could not upload image." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthorizedAssetContext();
    if ("error" in auth) return auth.error;
    const mosqueId = auth.ctx.mosqueId;
    if (!mosqueId) {
      return NextResponse.json({ error: "Choose a mosque first." }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Media library needs Supabase Storage to be configured." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const path = body.path;
    if (!isSafeAssetPath(path, mosqueId)) {
      return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
    }

    const supabase = await ensureBucket();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Site asset delete error:", error);
    return NextResponse.json({ error: "Could not delete image." }, { status: 500 });
  }
}
