import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const member =
      (await db.getMemberByAuthUserId(user.id)) ??
      (user.email ? await db.getMemberByEmailAcrossLodges(user.email) : null);

    return NextResponse.json({
      user: {
        id: user.id,
        email: member?.email ?? user.email,
        full_name: member?.full_name ?? user.user_metadata?.full_name ?? null,
        phone: member?.phone ?? null,
        dietary_requirements: member?.dietary_requirements ?? null,
        lodge_id: member?.lodge_id ?? null,
        rank: member?.rank ?? null,
        membership_status: member?.membership_status ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const member =
      (await db.getMemberByAuthUserId(user.id)) ??
      (await db.getMemberByEmailAcrossLodges(user.email));

    if (!member) {
      return NextResponse.json(
        { error: "No active member record is linked to this account." },
        { status: 404 }
      );
    }

    if (body.action === "change_password") {
      const currentPassword =
        typeof body.current_password === "string" ? body.current_password : "";
      const newPassword =
        typeof body.new_password === "string" ? body.new_password : "";

      if (!currentPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "Current password and a new password of at least 6 characters are required." },
          { status: 400 }
        );
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    const updates: Partial<db.Member> = {};
    if (typeof body.full_name === "string" && body.full_name.trim()) {
      updates.full_name = body.full_name.trim();
    }
    if (typeof body.phone === "string" || body.phone === null) {
      updates.phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    }
    if (
      typeof body.dietary_requirements === "string" ||
      body.dietary_requirements === null
    ) {
      updates.dietary_requirements =
        typeof body.dietary_requirements === "string"
          ? body.dietary_requirements.trim() || null
          : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await db.updateMember(member.id, member.lodge_id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (updates.full_name && updates.full_name !== user.user_metadata?.full_name) {
      await supabase.auth.updateUser({
        data: { ...user.user_metadata, full_name: updates.full_name },
      });
    }

    if (!member.auth_user_id) {
      await db.updateMember(member.id, member.lodge_id, { auth_user_id: user.id });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: updated.email,
        full_name: updated.full_name,
        phone: updated.phone,
        dietary_requirements: updated.dietary_requirements,
        lodge_id: updated.lodge_id,
        rank: updated.rank,
        membership_status: updated.membership_status,
      },
    });
  } catch (error) {
    console.error("Member session PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
