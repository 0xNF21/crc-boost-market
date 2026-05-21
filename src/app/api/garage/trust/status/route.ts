export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAddress } from "@/lib/auth/session";
import { getGarageTrustProfile } from "@/lib/garage-trust";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const limited = await enforceRateLimit(req, force ? "garage-trust-refresh" : "garage-trust-status", force ? 10 : 60, 60_000);
  if (limited) return limited;

  const address = await getAuthenticatedAddress(req).catch(() => null);
  if (!address) {
    return NextResponse.json({ wallet: null, trustProfile: null });
  }

  try {
    const trustProfile = await getGarageTrustProfile(address, { force });
    return NextResponse.json({ wallet: address, trustProfile });
  } catch (error: any) {
    console.error("[garage/trust/status] error:", error?.message ?? error);
    return NextResponse.json(
      { wallet: address, trustProfile: null, error: "TRUST_PROFILE_UNAVAILABLE" },
      { status: 200 },
    );
  }
}
