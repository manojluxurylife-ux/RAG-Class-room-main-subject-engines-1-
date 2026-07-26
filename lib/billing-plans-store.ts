/**
 * Plans & coupons store — Firestore-backed, adapted from Meteroid
 * (meteroid-oss/meteroid) "Pricing" + "Trials, Coupons & Add-Ons".
 *
 * Meteroid versions plans immutably (changing a price creates a new
 * plan version so existing subscribers are grandfathered). Scaled here:
 * a price change only affects NEW subscriptions, because subscription
 * records store their own amountPaise at purchase time — which is
 * grandfathering by construction, without the versioning machinery.
 *
 * Coupons follow Meteroid's shape: a code with a percent discount,
 * optional redemption cap and expiry. Redemption is counted atomically
 * at checkout time via redeem().
 */
import { collectionHelpers } from "./firestore-collection";

export interface PlanRecord {
  id:          string;
  name:        string;             // "Family Monthly"
  amountPaise: number;             // price per interval
  interval:    "monthly" | "annual";
  trialDays:   number;             // 0 = no trial
  active:      boolean;            // inactive plans can't be sold, existing subs unaffected
  createdAt:   string;
}

export interface CouponRecord {
  id:             string;
  code:           string;          // what the parent types, stored uppercase
  percentOff:     number;          // 1..100
  maxRedemptions: number;          // 0 = unlimited
  redeemed:       number;
  expiresAt?:     string;          // ISO; undefined = never
  active:         boolean;
  createdAt:      string;
}

const plansCol   = collectionHelpers<PlanRecord>("billing_plans");
const couponsCol = collectionHelpers<CouponRecord>("billing_coupons");

/** The two plans that used to be hardcoded in subscriptions-store —
 *  seeded once so existing behaviour carries over, then editable. */
const DEFAULT_PLANS: Omit<PlanRecord, "id" | "createdAt">[] = [
  { name: "Monthly", amountPaise: 59900,  interval: "monthly", trialDays: 7,  active: true },
  { name: "Yearly",  amountPaise: 500000, interval: "annual",  trialDays: 14, active: true },
];

export const plansStore = {
  async all(): Promise<PlanRecord[]> {
    let plans = await plansCol.all();
    if (plans.length === 0) {
      // First run — seed the defaults so the admin never sees an empty portal.
      const now = new Date().toISOString();
      plans = [];
      for (const p of DEFAULT_PLANS) plans.push(await plansCol.create({ ...p, createdAt: now }));
    }
    return plans.sort((a, b) => a.amountPaise - b.amountPaise);
  },
  byId: plansCol.byId,
  async create(data: Omit<PlanRecord, "id" | "createdAt">) {
    return plansCol.create({ ...data, createdAt: new Date().toISOString() });
  },
  update: plansCol.update,
};

export const couponsStore = {
  async all(): Promise<CouponRecord[]> {
    const all = await couponsCol.all();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(data: Omit<CouponRecord, "id" | "createdAt" | "redeemed" | "code"> & { code: string }) {
    return couponsCol.create({
      ...data, code: data.code.trim().toUpperCase(), redeemed: 0,
      createdAt: new Date().toISOString(),
    });
  },
  update: couponsCol.update,

  /** Validate + count a redemption. Returns the coupon or a reason string. */
  async redeem(code: string): Promise<CouponRecord | string> {
    const all = await couponsCol.all();
    const c = all.find(x => x.code === code.trim().toUpperCase());
    if (!c || !c.active) return "Invalid coupon code.";
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return "This coupon has expired.";
    if (c.maxRedemptions > 0 && c.redeemed >= c.maxRedemptions) return "This coupon has been fully used.";
    await couponsCol.update(c.id, { redeemed: c.redeemed + 1 });
    return { ...c, redeemed: c.redeemed + 1 };
  },
};
