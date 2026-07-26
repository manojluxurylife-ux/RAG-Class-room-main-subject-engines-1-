import { NextResponse } from "next/server";
import { studentsStore } from "@/lib/students-store";
import { subscriptionsStore } from "@/lib/subscriptions-store";
import { downloadsStore } from "@/lib/downloads-store";
import { messagesStore } from "@/lib/messages-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/stats — the single call the admin dashboard makes to
// populate every stat card and chart in one round trip.
export async function GET() {
  return withApiErrorHandling("GET /api/admin/stats", async () => {
    const [studentStats, subStats, downloadStats, messageStats, signups, revenue] = await Promise.all([
      studentsStore.stats(),
      subscriptionsStore.stats(),
      downloadsStore.stats(),
      messagesStore.stats(),
      studentsStore.signupsByDay(30),
      subscriptionsStore.revenueByDay(30),
    ]);

    return NextResponse.json({
      students: studentStats,
      subscriptions: subStats,
      downloads: downloadStats,
      messages: messageStats,
      signupsByDay: signups,
      revenueByDay: revenue,
    });
  });
}
