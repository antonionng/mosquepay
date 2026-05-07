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

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  try {
    const ctx = await getAdminReadContext();
    if (ctx.mode !== "database" || !ctx.lodgeId) {
      return NextResponse.json(
        { error: "Choose a lodge before uploading website images." },
        { status: 400 }
      );
    }

    const forbidden = await requireAdminApiPermission("website:write", ctx.lodgeId);
    if (forbidden) return forbidden;

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
    const path = `${ctx.lodgeId}/${Date.now()}-${crypto.randomUUID()}-${stem}.${ext}`;
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
