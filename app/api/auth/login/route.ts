import { NextRequest, NextResponse } from "next/server";
import { setDummySession, validateDummyCredentials } from "@/lib/auth/dummy";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

const STAFF_ADMIN_COOKIE = "covenant_staff_admin_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "covenant-dummy-secret-change-in-production";

function signStaffAdminSession() {
  const encoder = new TextEncoder();
  const data = encoder.encode("staff-admin" + SESSION_SECRET);
  return Buffer.from(data).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (validateDummyCredentials(email, password)) {
      await setDummySession();
      return NextResponse.json({ success: true });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const admin = await db.getAdminUserByEmail(data.user.email);
    if (!admin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is not an active admin user." },
        { status: 403 }
      );
    }

    if (!admin.auth_user_id) {
      await db.updateAdminUser(admin.id, { auth_user_id: data.user.id });
    }

    const response = NextResponse.json({
      success: true,
      admin: { email: admin.email, role: admin.role },
    });
    response.cookies.set(STAFF_ADMIN_COOKIE, signStaffAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
