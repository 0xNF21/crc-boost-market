import { createHash } from "crypto";
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
const CLAIMABLE_REWARD_STATUSES = ["claimable", "pending", "payout_failed"];

export function isGarageReferralRewardStatusPaid(status: string | null | undefined) {
  return status === "paid" || status === "payout_sending" || status === "payout_pending";
}

function claimGameId(referrerAddress: string, rewardIds: number[]) {
  const digest = createHash("sha256").update(rewardIds.join(",")).digest("hex").slice(0, 16);
  return `garage-referral-claim-${GARAGE_REFERRAL_CYCLE}-${referrerAddress.slice(2, 10)}-${digest}`;
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
        status: "claimable",
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
        status: "claimable",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(garageReferralRewards.id, reward.id));

    processed += 1;
  }

  return { processed, qualifyingClaims };
}

export async function claimGarageReferralRewards(referrerAddressValue: string) {
  const referrerAddress = referrerAddressValue.toLowerCase();
  const rewards = await db
    .select()
    .from(garageReferralRewards)
    .where(
      and(
        eq(garageReferralRewards.cycle, GARAGE_REFERRAL_CYCLE),
        eq(garageReferralRewards.referrerAddress, referrerAddress),
        inArray(garageReferralRewards.status, CLAIMABLE_REWARD_STATUSES),
      ),
    );

  const rewardIds = rewards.map((reward) => reward.id).sort((a, b) => a - b);
  const amountCrc = Math.round(rewards.reduce((sum, reward) => sum + Number(reward.amountCrc || 0), 0) * 100) / 100;
  if (!rewardIds.length || amountCrc <= 0) {
    return { claimed: false, amountCrc: 0, rewardCount: 0, status: "nothing_claimable" };
  }

  await db
    .update(garageReferralRewards)
    .set({
      status: "payout_pending",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(inArray(garageReferralRewards.id, rewardIds));

  const payout = await executePayout({
    gameType: "garage_referral_bonus",
    gameId: claimGameId(referrerAddress, rewardIds),
    recipientAddress: referrerAddress,
    amountCrc,
    reason: `Garage referral balance claim - ${rewardIds.length} reward${rewardIds.length > 1 ? "s" : ""}`,
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
      status,
      payoutId: payout.payoutId ?? null,
      payoutStatus: payout.status,
      payoutTxHash: payout.transferTxHash ?? null,
      errorMessage: payout.error?.slice(0, 500) ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(garageReferralRewards.id, rewardIds));

  return {
    claimed: payout.success || payout.status === "already_paid" || payout.status === "already_sending",
    amountCrc,
    rewardCount: rewardIds.length,
    status,
    payoutStatus: payout.status,
    payoutId: payout.payoutId ?? null,
    txHash: payout.transferTxHash ?? null,
    error: payout.error ?? null,
  };
}

export async function getGarageReferralRewardSummary(referrerAddress: string | null | undefined) {
  if (!referrerAddress) {
    return { crcEarned: 0, claimableCrc: 0, pendingCrc: 0, activatedWallets: 0 };
  }

  const [summary] = await db
    .select({
      crcEarned: sql<number>`COALESCE(SUM(CASE WHEN ${garageReferralRewards.status} IN ('paid', 'payout_sending') THEN ${garageReferralRewards.amountCrc} ELSE 0 END), 0)`,
      claimableCrc: sql<number>`COALESCE(SUM(CASE WHEN ${garageReferralRewards.status} IN ('claimable', 'pending', 'payout_failed') THEN ${garageReferralRewards.amountCrc} ELSE 0 END), 0)`,
      pendingCrc: sql<number>`COALESCE(SUM(CASE WHEN ${garageReferralRewards.status} = 'payout_pending' THEN ${garageReferralRewards.amountCrc} ELSE 0 END), 0)`,
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
    claimableCrc: Number(summary?.claimableCrc ?? 0),
    pendingCrc: Number(summary?.pendingCrc ?? 0),
    activatedWallets: Number(summary?.activatedWallets ?? 0),
  };
}
