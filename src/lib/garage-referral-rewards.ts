import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { garageReferralRewards, garageReferrals, garageXClaims } from "@/lib/db/schema";
import { executePayout } from "@/lib/payout";
import { getGarageTrustProfile } from "@/lib/garage-trust";
import {
  calculateGarageReferralRewardAmount,
  getGarageReferralQualityTier,
} from "@/lib/garage-referral-quality";

export const GARAGE_REFERRAL_CYCLE = "cycle-01";

export const GARAGE_REFERRAL_REWARD_MILESTONES = [
  { threshold: 1, amountCrc: 0.2 },
  { threshold: 3, amountCrc: 0.5 },
  { threshold: 5, amountCrc: 1 },
] as const;

const QUALIFYING_CLAIM_STATUSES = ["paid", "payout_sending", "payout_pending"];

export function isGarageReferralRewardStatusPaid(status: string | null | undefined) {
  return status === "paid" || status === "payout_sending" || status === "payout_pending";
}

export async function processGarageReferralRewardsForWallet(walletAddress: string) {
  const referredAddress = walletAddress.toLowerCase();
  const [referral] = await db
    .select()
    .from(garageReferrals)
    .where(
      and(
        eq(garageReferrals.cycle, GARAGE_REFERRAL_CYCLE),
        eq(garageReferrals.referredAddress, referredAddress),
      ),
    )
    .limit(1);

  if (!referral) {
    return { processed: 0, qualifyingClaims: 0 };
  }

  const [claimCount] = await db
    .select({ total: count() })
    .from(garageXClaims)
    .where(
      and(
        eq(garageXClaims.walletAddress, referredAddress),
        inArray(garageXClaims.status, QUALIFYING_CLAIM_STATUSES),
      ),
    );
  const qualifyingClaims = Number(claimCount?.total ?? 0);
  const unlocked = GARAGE_REFERRAL_REWARD_MILESTONES.filter(
    (milestone) => qualifyingClaims >= milestone.threshold,
  );
  const referredTrustProfile = await getGarageTrustProfile(referredAddress).catch(() => null);
  const qualityTier = getGarageReferralQualityTier({
    backerStatus: referredTrustProfile?.backerStatus ?? "none",
    trustScore: referredTrustProfile?.trustScore ?? null,
  });

  let processed = 0;
  for (const milestone of unlocked) {
    const amountCrc = calculateGarageReferralRewardAmount(milestone.amountCrc, qualityTier.multiplier);
    let [reward] = await db
      .insert(garageReferralRewards)
      .values({
        cycle: GARAGE_REFERRAL_CYCLE,
        referrerAddress: referral.referrerAddress,
        referredAddress,
        threshold: milestone.threshold,
        amountCrc,
        baseAmountCrc: milestone.amountCrc,
        qualityMultiplier: qualityTier.multiplier,
        referredTrustScore: referredTrustProfile?.trustScore ?? null,
        referredTrustLevel: referredTrustProfile?.trustLevel ?? null,
        referredBackerStatus: qualityTier.backerStatus,
        qualifyingClaims,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning();

    if (!reward) {
      [reward] = await db
        .select()
        .from(garageReferralRewards)
        .where(
          and(
            eq(garageReferralRewards.cycle, GARAGE_REFERRAL_CYCLE),
            eq(garageReferralRewards.referredAddress, referredAddress),
            eq(garageReferralRewards.threshold, milestone.threshold),
          ),
        )
        .limit(1);
    }

    if (!reward || isGarageReferralRewardStatusPaid(reward.status)) continue;

    await db
      .update(garageReferralRewards)
      .set({
        amountCrc,
        baseAmountCrc: milestone.amountCrc,
        qualityMultiplier: qualityTier.multiplier,
        referredTrustScore: referredTrustProfile?.trustScore ?? null,
        referredTrustLevel: referredTrustProfile?.trustLevel ?? null,
        referredBackerStatus: qualityTier.backerStatus,
        qualifyingClaims,
        status: "pending",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(garageReferralRewards.id, reward.id));

    const payout = await executePayout({
      gameType: "garage_referral_bonus",
      gameId: `garage-referral-${GARAGE_REFERRAL_CYCLE}-${referredAddress}-${milestone.threshold}`,
      recipientAddress: referral.referrerAddress,
      amountCrc,
      reason: `Garage referral bonus - ${milestone.threshold} verified mission${milestone.threshold > 1 ? "s" : ""} - ${qualityTier.label} (${qualityTier.multiplier}x)`,
      payoutReason: "dao_reward",
    });

    const status = payout.success
      ? (payout.status === "sending" ? "payout_sending" : "paid")
      : payout.status === "already_paid"
        ? "paid"
        : payout.status === "already_sending"
          ? "payout_sending"
          : "payout_failed";

    await db
      .update(garageReferralRewards)
      .set({
        qualifyingClaims,
        status,
        payoutId: payout.payoutId ?? null,
        payoutStatus: payout.status,
        payoutTxHash: payout.transferTxHash ?? null,
        errorMessage: payout.error?.slice(0, 500) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(garageReferralRewards.id, reward.id));

    processed += 1;
  }

  return { processed, qualifyingClaims };
}

export async function getGarageReferralRewardSummary(referrerAddress: string | null | undefined) {
  if (!referrerAddress) {
    return { crcEarned: 0, pendingCrc: 0, activatedWallets: 0 };
  }

  const [summary] = await db
    .select({
      crcEarned: sql<number>`COALESCE(SUM(CASE WHEN ${garageReferralRewards.status} IN ('paid', 'payout_sending', 'payout_pending') THEN ${garageReferralRewards.amountCrc} ELSE 0 END), 0)`,
      pendingCrc: sql<number>`COALESCE(SUM(CASE WHEN ${garageReferralRewards.status} = 'pending' THEN ${garageReferralRewards.amountCrc} ELSE 0 END), 0)`,
      activatedWallets: sql<number>`count(distinct ${garageReferralRewards.referredAddress})`,
    })
    .from(garageReferralRewards)
    .where(
      and(
        eq(garageReferralRewards.cycle, GARAGE_REFERRAL_CYCLE),
        eq(garageReferralRewards.referrerAddress, referrerAddress.toLowerCase()),
      ),
    );

  return {
    crcEarned: Number(summary?.crcEarned ?? 0),
    pendingCrc: Number(summary?.pendingCrc ?? 0),
    activatedWallets: Number(summary?.activatedWallets ?? 0),
  };
}
