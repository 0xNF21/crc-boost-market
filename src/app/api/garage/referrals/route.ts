export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress, requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageReferrals } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  GARAGE_REFERRAL_CYCLE,
  GARAGE_REFERRAL_REWARD_MILESTONES,
  getGarageReferralRewardSummary,
} from "@/lib/garage-referral-rewards";

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(lower) ? lower : null;
}

function cleanLandingPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return null;
  if (!trimmed.startsWith("/")) return null;
  return trimmed;
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-referrals-read", 60, 60_000);
  if (limited) return limited;

  try {
    const address = await getAuthenticatedAddress(req).catch(() => null);

    const [global] = await db
      .select({
        total: count(),
        referrers: sql<number>`count(distinct ${garageReferrals.referrerAddress})`,
        wallets: sql<number>`count(distinct ${garageReferrals.referredAddress})`,
      })
      .from(garageReferrals)
      .where(eq(garageReferrals.cycle, GARAGE_REFERRAL_CYCLE));

    let mine = { total: 0 };
    let recent: Array<{
      id: number;
      referrerAddress: string;
      referredAddress: string;
      createdAt: string;
    }> = [];

    if (address) {
      const [own] = await db
        .select({ total: count() })
        .from(garageReferrals)
        .where(
          and(
            eq(garageReferrals.cycle, GARAGE_REFERRAL_CYCLE),
            eq(garageReferrals.referrerAddress, address.toLowerCase()),
          ),
        );
      mine = { total: asNumber(own?.total) };

      const rows = await db
        .select({
          id: garageReferrals.id,
          referrerAddress: garageReferrals.referrerAddress,
          referredAddress: garageReferrals.referredAddress,
          createdAt: garageReferrals.createdAt,
        })
        .from(garageReferrals)
        .where(
          and(
            eq(garageReferrals.cycle, GARAGE_REFERRAL_CYCLE),
            eq(garageReferrals.referrerAddress, address.toLowerCase()),
          ),
        )
        .orderBy(desc(garageReferrals.createdAt))
        .limit(5);

      recent = rows.map((row) => ({
        id: row.id,
        referrerAddress: row.referrerAddress,
        referredAddress: row.referredAddress,
        createdAt: row.createdAt.toISOString(),
      }));
    }

    const rewards = await getGarageReferralRewardSummary(address);

    return NextResponse.json({
      cycle: GARAGE_REFERRAL_CYCLE,
      milestones: GARAGE_REFERRAL_REWARD_MILESTONES,
      global: {
        total: asNumber(global?.total),
        referrers: asNumber(global?.referrers),
        wallets: asNumber(global?.wallets),
      },
      mine,
      rewards,
      recent,
    });
  } catch (error: any) {
    console.error("[garage/referrals] GET error:", error?.message ?? error);
    return NextResponse.json(
      {
        cycle: GARAGE_REFERRAL_CYCLE,
        global: { total: 0, referrers: 0, wallets: 0 },
        mine: { total: 0 },
        rewards: { crcEarned: 0, pendingCrc: 0, activatedWallets: 0 },
        milestones: GARAGE_REFERRAL_REWARD_MILESTONES,
        recent: [],
        unavailable: true,
      },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-referrals-write", 20, 60_000);
  if (limited) return limited;

  try {
    const addressOr401 = await requireAuthenticatedAddress(req);
    if (addressOr401 instanceof NextResponse) return addressOr401;
    const referredAddress = addressOr401.toLowerCase();

    const body = await req.json().catch(() => ({}));
    const referrerAddress = normalizeAddress(body?.referrer);
    if (!referrerAddress) {
      return NextResponse.json({ error: "INVALID_REFERRER" }, { status: 400 });
    }

    if (referrerAddress === referredAddress) {
      return NextResponse.json({ recorded: false, status: "self_referral" });
    }

    const landingPath = cleanLandingPath(body?.landingPath);
    const inserted = await db
      .insert(garageReferrals)
      .values({
        cycle: GARAGE_REFERRAL_CYCLE,
        referrerAddress,
        referredAddress,
        landingPath,
      })
      .onConflictDoNothing()
      .returning({ id: garageReferrals.id });

    return NextResponse.json({
      recorded: inserted.length > 0,
      status: inserted.length > 0 ? "recorded" : "already_recorded",
      cycle: GARAGE_REFERRAL_CYCLE,
    });
  } catch (error: any) {
    console.error("[garage/referrals] POST error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
