import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { listMosques, getMosqueSubscription, getPayments } from "@/lib/db";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const unauthorized = await requireOperatorApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      mosqueCount: 0,
      activeMosques: 0,
      activeSubscriptions: 0,
      trialingSubscriptions: 0,
      totalRevenue: 0,
    });
  }

  try {
    const mosques = await listMosques();
    const activeMosques = mosques.filter((l) => l.is_active).length;

    const subs = await Promise.all(
      mosques.map((l) => getMosqueSubscription(l.id).catch(() => null))
    );
    const activeSubscriptions = subs.filter(
      (s) => s?.status === "active"
    ).length;
    const trialingSubscriptions = subs.filter(
      (s) => s?.status === "trialing"
    ).length;

    const paymentsByMosque = await Promise.all(
      mosques.map((l) => getPayments(l.id).catch(() => []))
    );
    const totalRevenue = paymentsByMosque
      .flat()
      .filter((p) => p.status === "succeeded" || p.status === "completed")
      .reduce((sum, p) => sum + p.total_amount, 0);

    return NextResponse.json({
      mosqueCount: mosques.length,
      activeMosques,
      activeSubscriptions,
      trialingSubscriptions,
      totalRevenue,
    });
  } catch (error) {
    console.error("Operator stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
