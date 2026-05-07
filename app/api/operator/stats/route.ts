import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { listLodges, getLodgeSubscription, getPayments } from "@/lib/db";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const unauthorized = await requireOperatorApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      lodgeCount: 0,
      activeLodges: 0,
      activeSubscriptions: 0,
      trialingSubscriptions: 0,
      totalRevenue: 0,
    });
  }

  try {
    const lodges = await listLodges();
    const activeLodges = lodges.filter((l) => l.is_active).length;

    const subs = await Promise.all(
      lodges.map((l) => getLodgeSubscription(l.id).catch(() => null))
    );
    const activeSubscriptions = subs.filter(
      (s) => s?.status === "active"
    ).length;
    const trialingSubscriptions = subs.filter(
      (s) => s?.status === "trialing"
    ).length;

    const paymentsByLodge = await Promise.all(
      lodges.map((l) => getPayments(l.id).catch(() => []))
    );
    const totalRevenue = paymentsByLodge
      .flat()
      .filter((p) => p.status === "succeeded" || p.status === "completed")
      .reduce((sum, p) => sum + p.total_amount, 0);

    return NextResponse.json({
      lodgeCount: lodges.length,
      activeLodges,
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
