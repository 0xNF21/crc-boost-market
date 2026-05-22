export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress, requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageReferralRewards, garageReferrals, garageTrustProfiles, garageXClaims } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  CLAIMABLE_REWARD_STATUSES,
  GARAGE_REFERRAL_CYCLE,
  GARAGE_REFERRAL_REWARD_MILESTONES,
  QUALIFYING_CLAIM_STATUSES,
  getGarageReferralRewardSummary,
} from "@/lib/garage-referral-rewards";
import {
  GARAGE_REFERRAL_QUALITY_GRID,
  GARAGE_REFERRAL_MIN_REWARD_CRC,
  getGarageReferralQualityTier,
} from "@/lib/garage-referral-quality";

const CLAIMED_REWARD_STATUSES = ["paid", "payout_sending"];
const PENDING_REWARD_STATUSES = ["payout_pending"];

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

function normalizeBackerStatus(value: unknown) {
  return value === "direct" || value === "indirect" || value === "none" ? value : "unknown";
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-referrals-read", 60, 60_000);
  if (limited) return limited;

  let address: string | null = null;

  try {
    address = await getAuthenticatedAddress(req).catch(() => null);

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
    let activity: Array<{
      id: number;
      referredAddress: string;
      createdAt: string;
      missions: number;
      xReads: number;
      lastMissionAt: string | null;
      trustScore: number | null;
      trustLevel: string | null;
      mutualCount: number;
      backerStatus: "direct" | "indirect" | "none" | "unknown";
      qualityMultiplier: number;
      claimableCrc: number;
      claimedCrc: number;
      pendingCrc: number;
      totalCrc: number;
      unlockedMilestones: number;
      highestMilestone: number;
      status: "invited" | "missions_detected" | "claimable" | "claiming" | "claimed";
    }> = [];

    if (address) {
      const normalizedAddress = address.toLowerCase();
      const [own] = await db
        .select({ total: count() })
        .from(garageReferrals)
        .where(
          and(
            eq(garageReferrals.cycle, GARAGE_REFERRAL_CYCLE),
            eq(garageReferrals.referrerAddress, normalizedAddress),
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
            eq(garageReferrals.referrerAddress, normalizedAddress),
          ),
        )
        .orderBy(desc(garageReferrals.createdAt))
        .limit(20);

      recent = rows.map((row) => ({
        id: row.id,
        referrerAddress: row.referrerAddress,
        referredAddress: row.referredAddress,
        createdAt: toIsoString(row.createdAt),
      }));

      const referredAddresses = rows
        .map((row) => row.referredAddress.toLowerCase())
        .filter((value, index, all) => all.indexOf(value) === index);

      const claimRows = referredAddresses.length
        ? await db
            .select({
              walletAddress: garageXClaims.walletAddress,
              missions: count(),
              xReads: sql<number>`COALESCE(SUM(${garageXClaims.verificationChecked}), 0)`,
              lastMissionAt: sql<Date | null>`MAX(${garageXClaims.createdAt})`,
            })
            .from(garageXClaims)
            .where(
              and(
                inArray(garageXClaims.walletAddress, referredAddresses),
                inArray(garageXClaims.status, QUALIFYING_CLAIM_STATUSES),
              ),
            )
            .groupBy(garageXClaims.walletAddress)
        : [];
      const claimsByWallet = new Map(
        claimRows.map((row) => [
          row.walletAddress.toLowerCase(),
          {
            missions: asNumber(row.missions),
            xReads: asNumber(row.xReads),
            lastMissionAt: row.lastMissionAt ? new Date(row.lastMissionAt).toISOString() : null,
          },
        ]),
      );

      const rewardRows = referredAddresses.length
        ? await db
            .select({
              referredAddress: garageReferralRewards.referredAddress,
              threshold: garageReferralRewards.threshold,
              amountCrc: garageReferralRewards.amountCrc,
              qualityMultiplier: garageReferralRewards.qualityMultiplier,
              referredTrustScore: garageReferralRewards.referredTrustScore,
              referredTrustLevel: garageReferralRewards.referredTrustLevel,
              referredBackerStatus: garageReferralRewards.referredBackerStatus,
              status: garageReferralRewards.status,
              updatedAt: garageReferralRewards.updatedAt,
            })
            .from(garageReferralRewards)
            .where(
              and(
                eq(garageReferralRewards.cycle, GARAGE_REFERRAL_CYCLE),
                eq(garageReferralRewards.referrerAddress, normalizedAddress),
                inArray(garageReferralRewards.referredAddress, referredAddresses),
              ),
            )
        : [];
      const rewardsByWallet = new Map<
        string,
        {
          claimableCrc: number;
          claimedCrc: number;
          pendingCrc: number;
          totalCrc: number;
          unlockedMilestones: number;
          highestMilestone: number;
          qualityMultiplier: number | null;
          trustScore: number | null;
          trustLevel: string | null;
          backerStatus: "direct" | "indirect" | "none" | "unknown";
          lastUpdatedAt: number;
        }
      >();

      for (const reward of rewardRows) {
        const key = reward.referredAddress.toLowerCase();
        const current =
          rewardsByWallet.get(key) ??
          {
            claimableCrc: 0,
            claimedCrc: 0,
            pendingCrc: 0,
            totalCrc: 0,
            unlockedMilestones: 0,
            highestMilestone: 0,
            qualityMultiplier: null,
            trustScore: null,
            trustLevel: null,
            backerStatus: "unknown" as const,
            lastUpdatedAt: 0,
          };
        const amount = asNumber(reward.amountCrc);
        if (CLAIMABLE_REWARD_STATUSES.includes(reward.status)) current.claimableCrc += amount;
        if (CLAIMED_REWARD_STATUSES.includes(reward.status)) current.claimedCrc += amount;
        if (PENDING_REWARD_STATUSES.includes(reward.status)) current.pendingCrc += amount;
        current.totalCrc += amount;
        current.unlockedMilestones += 1;
        current.highestMilestone = Math.max(current.highestMilestone, asNumber(reward.threshold));

        const updatedAt = reward.updatedAt?.getTime?.() ?? 0;
        if (updatedAt >= current.lastUpdatedAt) {
          current.lastUpdatedAt = updatedAt;
          current.qualityMultiplier = asNumber(reward.qualityMultiplier) || current.qualityMultiplier;
          current.trustScore = reward.referredTrustScore;
          current.trustLevel = reward.referredTrustLevel;
          current.backerStatus = normalizeBackerStatus(reward.referredBackerStatus);
        }
        rewardsByWallet.set(key, current);
      }

      const trustRows = referredAddresses.length
        ? await db
            .select({
              walletAddress: garageTrustProfiles.walletAddress,
              trustScore: garageTrustProfiles.trustScore,
              trustLevel: garageTrustProfiles.trustLevel,
              mutualCount: garageTrustProfiles.mutualCount,
              backerStatus: garageTrustProfiles.backerStatus,
            })
            .from(garageTrustProfiles)
            .where(inArray(garageTrustProfiles.walletAddress, referredAddresses))
        : [];
      const trustByWallet = new Map(trustRows.map((row) => [row.walletAddress.toLowerCase(), row]));

      activity = rows.map((row) => {
        const referredAddress = row.referredAddress.toLowerCase();
        const claims = claimsByWallet.get(referredAddress) ?? { missions: 0, xReads: 0, lastMissionAt: null };
        const rewards = rewardsByWallet.get(referredAddress);
        const trust = trustByWallet.get(referredAddress);
        const trustScore = rewards?.trustScore ?? trust?.trustScore ?? null;
        const trustLevel = rewards?.trustLevel ?? trust?.trustLevel ?? null;
        const backerStatus = rewards?.backerStatus ?? normalizeBackerStatus(trust?.backerStatus);
        const qualityTier = getGarageReferralQualityTier({ backerStatus, trustScore });
        const claimableCrc = Math.round((rewards?.claimableCrc ?? 0) * 100) / 100;
        const claimedCrc = Math.round((rewards?.claimedCrc ?? 0) * 100) / 100;
        const pendingCrc = Math.round((rewards?.pendingCrc ?? 0) * 100) / 100;
        const status =
          claimableCrc > 0
            ? "claimable"
            : pendingCrc > 0
              ? "claiming"
              : claimedCrc > 0
                ? "claimed"
                : claims.missions > 0
                  ? "missions_detected"
                  : "invited";

        return {
          id: row.id,
          referredAddress,
          createdAt: toIsoString(row.createdAt),
          missions: claims.missions,
          xReads: claims.xReads,
          lastMissionAt: claims.lastMissionAt,
          trustScore,
          trustLevel,
          mutualCount: asNumber(trust?.mutualCount),
          backerStatus,
          qualityMultiplier: rewards?.qualityMultiplier ?? qualityTier.multiplier,
          claimableCrc,
          claimedCrc,
          pendingCrc,
          totalCrc: Math.round((rewards?.totalCrc ?? 0) * 100) / 100,
          unlockedMilestones: rewards?.unlockedMilestones ?? 0,
          highestMilestone: rewards?.highestMilestone ?? 0,
          status,
        };
      });
    }

    const rewards = await getGarageReferralRewardSummary(address);

    return NextResponse.json({
      cycle: GARAGE_REFERRAL_CYCLE,
      authenticated: Boolean(address),
      address: address?.toLowerCase() ?? null,
      milestones: GARAGE_REFERRAL_REWARD_MILESTONES,
      qualityMultipliers: GARAGE_REFERRAL_QUALITY_GRID,
      minRewardCrc: GARAGE_REFERRAL_MIN_REWARD_CRC,
      global: {
        total: asNumber(global?.total),
        referrers: asNumber(global?.referrers),
        wallets: asNumber(global?.wallets),
      },
      mine,
      rewards,
      recent: recent.slice(0, 5),
      activity,
    });
  } catch (error: any) {
    console.error("[garage/referrals] GET error:", error?.message ?? error);
    return NextResponse.json(
      {
        cycle: GARAGE_REFERRAL_CYCLE,
        authenticated: Boolean(address),
        address: address?.toLowerCase() ?? null,
        global: { total: 0, referrers: 0, wallets: 0 },
        mine: { total: 0 },
        rewards: { crcEarned: 0, claimableCrc: 0, pendingCrc: 0, activatedWallets: 0 },
        milestones: GARAGE_REFERRAL_REWARD_MILESTONES,
        qualityMultipliers: GARAGE_REFERRAL_QUALITY_GRID,
        minRewardCrc: GARAGE_REFERRAL_MIN_REWARD_CRC,
        recent: [],
        activity: [],
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
