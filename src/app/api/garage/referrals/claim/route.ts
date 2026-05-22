export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedAddress } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { claimGarageReferralRewards } from "@/lib/garage-referral-rewards";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-referrals-claim", 5, 60_000);
  if (limited) return limited;

  try {
    const addressOr401 = await requireAuthenticatedAddress(req);
    if (addressOr401 instanceof NextResponse) return addressOr401;

    const result = await claimGarageReferralRewards(addressOr401.toLowerCase());
    if (!result.claimed) {
      return NextResponse.json(result, { status: result.status === "nothing_claimable" ? 200 : 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[garage/referrals/claim] POST error:", error?.message ?? error);
    return NextResponse.json({ claimed: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
