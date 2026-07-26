import { NextResponse } from "next/server";
import { couponsStore } from "@/lib/billing-plans-store";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Role-guarded by middleware.ts (/api/admin/* → verified admin session).

export async function GET() {
  return withApiErrorHandling("GET /api/admin/coupons", async () => {
    return NextResponse.json({ coupons: await couponsStore.all() });
  });
}

/** POST — create a coupon. body: { code, percentOff, maxRedemptions?, expiresAt? } */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/admin/coupons", async () => {
    const { code, percentOff, maxRedemptions, expiresAt } = await req.json();
    if (!code || !percentOff || percentOff < 1 || percentOff > 100) {
      return NextResponse.json({ error: "code and percentOff (1-100) are required." }, { status: 400 });
    }
    const coupon = await couponsStore.create({
      code, percentOff: Math.round(percentOff),
      maxRedemptions: Math.max(0, Math.round(maxRedemptions || 0)),
      expiresAt: expiresAt || undefined, active: true,
    });
    return NextResponse.json({ coupon }, { status: 201 });
  });
}

/** PATCH — toggle/update. body: { id, ...fields } */
export async function PATCH(req: Request) {
  return withApiErrorHandling("PATCH /api/admin/coupons", async () => {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const coupon = await couponsStore.update(id, patch);
    if (!coupon) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    return NextResponse.json({ coupon });
  });
}
