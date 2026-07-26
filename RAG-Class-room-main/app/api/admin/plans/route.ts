import { NextResponse } from "next/server";
import { plansStore } from "@/lib/billing-plans-store";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Role-guarded by middleware.ts (/api/admin/* → verified admin session).

export async function GET() {
  return withApiErrorHandling("GET /api/admin/plans", async () => {
    return NextResponse.json({ plans: await plansStore.all() });
  });
}

/** POST — create a plan. body: { name, amountPaise, interval, trialDays } */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/admin/plans", async () => {
    const { name, amountPaise, interval, trialDays } = await req.json();
    if (!name || !amountPaise || !["monthly", "annual"].includes(interval)) {
      return NextResponse.json({ error: "name, amountPaise and interval (monthly|annual) are required." }, { status: 400 });
    }
    const plan = await plansStore.create({
      name, amountPaise: Math.round(amountPaise), interval,
      trialDays: Math.max(0, Math.round(trialDays || 0)), active: true,
    });
    return NextResponse.json({ plan }, { status: 201 });
  });
}

/** PATCH — update a plan. body: { id, ...fields }. Price changes only
 *  affect NEW subscriptions — existing records keep their purchase-time
 *  amount (grandfathering, Meteroid-style, by construction). */
export async function PATCH(req: Request) {
  return withApiErrorHandling("PATCH /api/admin/plans", async () => {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const plan = await plansStore.update(id, patch);
    if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    return NextResponse.json({ plan });
  });
}
