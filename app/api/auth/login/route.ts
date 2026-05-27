import { NextRequest, NextResponse } from "next/server";
import { setDummySession, validateDummyCredentials } from "@/lib/auth/dummy";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import {
  STAFF_ADMIN_COOKIE,
  signStaffAdminCookie,
} from "@/lib/auth/staff-cookie";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";
import { ADMIN_LODGE_COOKIE } from "@/lib/tenant";

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

    // Platform owners (configured via PLATFORM_OWNER_EMAILS) are allowed to
    // sign in even without a corresponding admin_users row. The rest of the
    // permissions stack already treats them as super_admin via the staff
    // cookie, so issuing the cookie here is sufficient. This unblocks any
    // additional platform owner you add through env without having to seed
    // admin_users by hand or run the bootstrap script.
    const admin = await db.getAdminUserByEmail(data.user.email);
    const isPlatformOwner = isPlatformOwnerEmail(data.user.email);
    if (!admin && !isPlatformOwner) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is not an active admin user." },
        { status: 403 }
      );
    }

    if (admin && !admin.auth_user_id) {
      await db.updateAdminUser(admin.id, { auth_user_id: data.user.id });
    }

    const cookieEmail = admin?.email ?? data.user.email;
    const responseRole = admin?.role ?? "super_admin";
    const response = NextResponse.json({
      success: true,
      admin: { email: cookieEmail, role: responseRole },
    });
    response.cookies.set(STAFF_ADMIN_COOKIE, signStaffAdminCookie(cookieEmail), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // Anchor ADMIN_LODGE_COOKIE to the admin's actual lodge so subsequent
    // API calls that resolve the lodge via getLodgeSlugFromRequest land on
    // the right tenant. Without this, a lodge-scoped admin who never used
    // the lodge switcher would fall back to DEFAULT_LODGE_SLUG -- which is
    // the source of the recurring "page renders but POST/PATCH 401s" class
    // of bugs. For platform owners we explicitly clear the cookie so they
    // see the global view by default and can pick a lodge via the switcher.
    if (admin?.lodge_id) {
      try {
        const adminLodge = await db.getLodgeById(admin.lodge_id);
        if (adminLodge?.slug) {
          response.cookies.set(ADMIN_LODGE_COOKIE, adminLodge.slug, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          });
        }
      } catch (error) {
        console.error("[login] failed to anchor ADMIN_LODGE_COOKIE", {
          email: cookieEmail,
          lodgeId: admin.lodge_id,
          error,
        });
      }
    } else if (isPlatformOwner || (admin && admin.lodge_id == null)) {
      response.cookies.delete(ADMIN_LODGE_COOKIE);
    }

    return response;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
