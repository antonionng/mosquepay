import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberEmail = user.email;
    const now = new Date().toISOString();

    const [eventsResult, paymentsResult, donationsResult] = await Promise.allSettled([
      supabase
        .from("events")
        .select("id")
        .gte("date", now)
        .limit(100),
      supabase
        .from("payments")
        .select("*")
        .eq("email", memberEmail)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("donations")
        .select("*")
        .eq("email", memberEmail)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const upcomingEvents =
      eventsResult.status === "fulfilled" && eventsResult.value.data
        ? eventsResult.value.data.length
        : 0;

    const payments =
      paymentsResult.status === "fulfilled" && paymentsResult.value.data
        ? paymentsResult.value.data
        : [];

    const donations =
      donationsResult.status === "fulfilled" && donationsResult.value.data
        ? donationsResult.value.data
        : [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPaymentsTotal = payments
      .filter(
        (p: { created_at?: string; amount?: number }) =>
          p.created_at && new Date(p.created_at) >= thirtyDaysAgo
      )
      .reduce((sum: number, p: { amount?: number }) => sum + (p.amount ?? 0), 0);

    const currentYear = new Date().getFullYear();
    const donationTotal = donations
      .filter(
        (d: { created_at?: string }) =>
          d.created_at && new Date(d.created_at).getFullYear() === currentYear
      )
      .reduce((sum: number, d: { amount?: number }) => sum + (d.amount ?? 0), 0);

    const outstandingDues = 0;

    type ActivityItem = {
      id: string;
      type: "payment" | "donation";
      description: string;
      date: string;
      amount?: number;
    };

    const recentActivity: ActivityItem[] = [];

    payments.slice(0, 3).forEach((p: { id?: string; description?: string; created_at?: string; amount?: number }) => {
      recentActivity.push({
        id: p.id ?? crypto.randomUUID(),
        type: "payment",
        description: p.description ?? "Payment",
        date: p.created_at
          ? new Date(p.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Unknown",
        amount: p.amount,
      });
    });

    donations.slice(0, 3).forEach((d: { id?: string; fund?: string; created_at?: string; amount?: number }) => {
      recentActivity.push({
        id: d.id ?? crypto.randomUUID(),
        type: "donation",
        description: `Donation to ${d.fund ?? "General Fund"}`,
        date: d.created_at
          ? new Date(d.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Unknown",
        amount: d.amount,
      });
    });

    recentActivity.sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    });

    return NextResponse.json({
      user: {
        full_name: user.user_metadata?.full_name ?? null,
        email: user.email,
      },
      upcomingEvents,
      outstandingDues,
      recentPaymentsTotal,
      donationTotal,
      recentActivity: recentActivity.slice(0, 5),
      payments: payments.map((p: { id?: string; created_at?: string; description?: string; amount?: number; status?: string; type?: string }) => ({
        id: p.id,
        date: p.created_at,
        description: p.description ?? "Payment",
        amount: p.amount ?? 0,
        status: p.status ?? "completed",
        type: p.type ?? "event",
      })),
      donationData: {
        totalThisYear: donationTotal,
        giftAidDeclared: false,
        donations: donations.map((d: { id?: string; created_at?: string; amount?: number; fund?: string }) => ({
          id: d.id,
          date: d.created_at,
          amount: d.amount ?? 0,
          fund: d.fund ?? "General Fund",
          giftAid: false,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
