export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageXAccounts, garageXCampaigns, garageXClaims, garageXVerificationCache } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getGarageClaimSettlementTier } from "@/lib/garage-fees";
import { isGarageReferralRewardStatusPaid, processGarageReferralRewardsForWallet } from "@/lib/garage-referral-rewards";
import { getGarageTrustProfile } from "@/lib/garage-trust";
import { getGarageXPayoutDelaySeconds, isXApiConfigured, normalizeXAction, verifyGarageXAction } from "@/lib/garage-x";
import { executePayout } from "@/lib/payout";

function publicClaim(row: typeof garageXClaims.$inferSelect) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    action: row.action,
    status: row.status,
    verificationEvidence: row.verificationEvidence,
    verificationChecked: row.verificationChecked,
    payoutAvailableAt: row.payoutAvailableAt?.toISOString() ?? null,
    payoutStatus: row.payoutStatus,
    payoutTxHash: row.payoutTxHash,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

function claimStatusFromPayout(status: string, success: boolean) {
  if (success && (status === "success" || status === "completed")) return "paid";
  if (status === "already_paid") return "paid";
  if (success && status === "sending") return "payout_sending";
  if (success) return "payout_pending";
  return "payout_failed";
}

function classifyXApiError(error: unknown) {
  const message = String((error as Error | null)?.message ?? error);
  const lower = message.toLowerCase();
  if (message.includes("X_API_402") || lower.includes("credits")) return "X_API_NO_CREDITS";
  if (message.includes("X_API_401") || message.includes("X_API_403")) return "X_API_ACCESS_DENIED";
  if (message.includes("X_API_429") || lower.includes("rate limit")) return "X_API_RATE_LIMITED";
  return "X_API_ERROR";
}

function parseStartedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = Date.now();
  const timestamp = parsed.getTime();
  if (timestamp > now + 5 * 60_000) return null;
  if (timestamp < now - 7 * 24 * 60 * 60_000) return null;

  return new Date(Math.max(timestamp - 2 * 60_000, now - 7 * 24 * 60 * 60_000));
}

async function claimSettlementTier(walletAddress: string) {
  const trustProfile = await getGarageTrustProfile(walletAddress).catch(() => null);
  return getGarageClaimSettlementTier(trustProfile, getGarageXPayoutDelaySeconds());
}

function verificationCacheMs() {
  const seconds = Number(process.env.GARAGE_X_VERIFICATION_CACHE_SECONDS ?? 900);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function canRetryClaim(status: string) {
  return status === "verified_pending" || status === "verification_expired" || status === "payout_failed";
}

async function readCachedVerification(params: {
  action: string;
  tweetId: string | null;
  xUserId: string;
  minObservedAt?: Date | null;
}) {
  if (!params.tweetId) return null;

  const conditions = [
    eq(garageXVerificationCache.action, params.action),
    eq(garageXVerificationCache.tweetId, params.tweetId),
    eq(garageXVerificationCache.xUserId, params.xUserId),
    gte(garageXVerificationCache.expiresAt, new Date()),
  ];
  if (params.minObservedAt) {
    conditions.push(gte(garageXVerificationCache.observedAt, params.minObservedAt));
  }

  const [cached] = await db
    .select()
    .from(garageXVerificationCache)
    .where(and(...conditions))
    .orderBy(desc(garageXVerificationCache.observedAt))
    .limit(1);

  return cached
    ? {
        ok: true,
        checked: 0,
        evidence: `cache_${cached.evidence}`,
      }
    : null;
}

async function storePositiveVerification(params: {
  action: string;
  tweetId: string | null;
  xUserId: string;
  evidence: string;
  checked: number;
}) {
  const ttl = verificationCacheMs();
  if (!ttl || !params.tweetId) return;

  const now = new Date();
  await db
    .insert(garageXVerificationCache)
    .values({
      action: params.action,
      tweetId: params.tweetId,
      xUserId: params.xUserId,
      evidence: params.evidence,
      checked: params.checked,
      observedAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        garageXVerificationCache.action,
        garageXVerificationCache.tweetId,
        garageXVerificationCache.xUserId,
      ],
      set: {
        evidence: params.evidence,
        checked: params.checked,
        observedAt: now,
        expiresAt: new Date(now.getTime() + ttl),
        updatedAt: now,
      },
    });
}

async function storeObservedPositiveVerifications(params: {
  action: string;
  tweetId: string | null;
  xUserIds: string[] | undefined;
  evidence: string;
}) {
  const ttl = verificationCacheMs();
  if (!ttl || !params.tweetId || !params.xUserIds?.length) return;

  const uniqueUserIds = [...new Set(params.xUserIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl);
  await db
    .insert(garageXVerificationCache)
    .values(
      uniqueUserIds.map((xUserId) => ({
        action: params.action,
        tweetId: params.tweetId!,
        xUserId,
        evidence: params.evidence,
        checked: 0,
        observedAt: now,
        expiresAt,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        garageXVerificationCache.action,
        garageXVerificationCache.tweetId,
        garageXVerificationCache.xUserId,
      ],
      set: {
        evidence: params.evidence,
        checked: 0,
        observedAt: now,
        expiresAt,
        updatedAt: now,
      },
    });
}

async function verifyWithCache(params: {
  action: NonNullable<ReturnType<typeof normalizeXAction>>;
  tweetId: string | null;
  targetXUserId: string | null;
  xUserId: string;
  startedAt?: Date | null;
  minObservedAt?: Date | null;
  allowRetweetedByFallback?: boolean;
}) {
  const cached = await readCachedVerification(params);
  if (cached) return cached;

  const verification = await verifyGarageXAction({
    action: params.action,
    tweetId: params.tweetId,
    targetXUserId: params.targetXUserId,
    xUserId: params.xUserId,
    startedAt: params.startedAt,
    allowRetweetedByFallback: params.allowRetweetedByFallback,
  });
  if (params.action === "repost" && verification.observedUserIds?.length) {
    await storeObservedPositiveVerifications({
      action: params.action,
      tweetId: params.tweetId,
      xUserIds: verification.observedUserIds,
      evidence: "retweeted_by_fallback",
    });
  }
  if (verification.ok) {
    await storePositiveVerification({
      action: params.action,
      tweetId: params.tweetId,
      xUserId: params.xUserId,
      evidence: verification.evidence,
      checked: verification.checked,
    });
  }
  return verification;
}

async function settleClaim(params: {
  claim: typeof garageXClaims.$inferSelect;
  campaign: typeof garageXCampaigns.$inferSelect;
  username: string;
  walletAddress: string;
  action: string;
  evidence: string;
  checked: number;
}) {
  const totalChecked = params.claim.verificationChecked + params.checked;
  const payout = await executePayout({
    gameType: "garage_x_boost",
    gameId: `garage-x-${params.campaign.id}-${params.claim.xUserId}`,
    recipientAddress: params.walletAddress,
    amountCrc: params.campaign.rewardCrc,
    reason: `CRC Boost ${params.campaign.slug} - ${params.action} by @${params.username}`,
    payoutReason: "dao_reward",
  });

  const claimStatus = claimStatusFromPayout(payout.status, payout.success);
  const [updated] = await db
    .update(garageXClaims)
    .set({
      status: claimStatus,
      verificationEvidence: params.evidence,
      verificationChecked: totalChecked,
      payoutId: payout.payoutId ?? null,
      payoutStatus: payout.status,
      payoutTxHash: payout.transferTxHash ?? null,
      errorMessage: payout.error?.slice(0, 500) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(garageXClaims.id, params.claim.id))
    .returning();

  if (isGarageReferralRewardStatusPaid(claimStatus)) {
    try {
      await processGarageReferralRewardsForWallet(params.walletAddress);
    } catch (error: any) {
      console.error("[garage/x/verify] referral reward error:", error?.message ?? error);
    }
  }

  return {
    status: claimStatus,
    verified: true,
    evidence: params.evidence,
    checked: totalChecked,
    payout,
    claim: publicClaim(updated ?? params.claim),
  };
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-verify", 15, 60_000);
  if (limited) return limited;

  const addressOr401 = await requireAuthenticatedAddress(req);
  if (addressOr401 instanceof NextResponse) return addressOr401;
  const walletAddress = addressOr401.toLowerCase();

  if (!isXApiConfigured()) {
    return NextResponse.json({ error: "X_API_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const campaignId = Number(body?.campaignId);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: "INVALID_CAMPAIGN" }, { status: 400 });
  }
  const startedAt = parseStartedAt(body?.openedAt);
  const allowRetweetedByFallback = body?.allowRetweetedByFallback === true;
  if (allowRetweetedByFallback) {
    const fallbackLimited = await enforceRateLimit(req, "garage-x-retweeted-by-fallback", 5, 60_000);
    if (fallbackLimited) return fallbackLimited;
  }

  try {
    const [account] = await db
      .select()
      .from(garageXAccounts)
      .where(eq(garageXAccounts.walletAddress, walletAddress))
      .limit(1);
    if (!account) {
      return NextResponse.json({ error: "X_ACCOUNT_REQUIRED" }, { status: 401 });
    }

    const [campaign] = await db
      .select()
      .from(garageXCampaigns)
      .where(eq(garageXCampaigns.id, campaignId))
      .limit(1);
    if (!campaign || campaign.status !== "active") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_ACTIVE" }, { status: 404 });
    }

    const action = normalizeXAction(campaign.action);
    if (!action) {
      return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(garageXClaims)
      .where(
        and(
          eq(garageXClaims.campaignId, campaign.id),
          or(
            eq(garageXClaims.walletAddress, walletAddress),
            eq(garageXClaims.xUserId, account.xUserId),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      if (!canRetryClaim(existing.status)) {
        return NextResponse.json({
          status: "already_claimed",
          claim: publicClaim(existing),
        });
      }

      const payoutAvailableAt = existing.payoutAvailableAt ?? existing.createdAt;
      if (existing.status === "verified_pending" && payoutAvailableAt.getTime() > Date.now()) {
        return NextResponse.json({
          status: "settlement_pending",
          verified: true,
          claim: publicClaim(existing),
          availableAt: payoutAvailableAt.toISOString(),
        });
      }

      let reverification: Awaited<ReturnType<typeof verifyGarageXAction>>;
      try {
        reverification = await verifyWithCache({
          action,
          tweetId: campaign.tweetId,
          targetXUserId: campaign.targetXUserId,
          xUserId: account.xUserId,
          startedAt,
          minObservedAt: payoutAvailableAt,
          allowRetweetedByFallback,
        });
      } catch (error: any) {
        console.error("[garage/x/verify] X API error:", error?.message ?? error);
        return NextResponse.json(
          { error: classifyXApiError(error), detail: error?.message ?? "unknown" },
          { status: 502 },
        );
      }

      if (!reverification.ok) {
        const [updated] = await db
          .update(garageXClaims)
          .set({
            status: "verification_expired",
            verificationEvidence: reverification.evidence,
            verificationChecked: existing.verificationChecked + reverification.checked,
            errorMessage: "X action was not present at settlement re-check.",
            updatedAt: new Date(),
          })
          .where(eq(garageXClaims.id, existing.id))
          .returning();
        return NextResponse.json(
          {
            error: "ACTION_NOT_FOUND",
            evidence: reverification.evidence,
            checked: reverification.checked,
            claim: publicClaim(updated ?? existing),
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        await settleClaim({
          claim: existing,
          campaign,
          username: account.username,
          walletAddress,
          action,
          evidence: reverification.evidence,
          checked: reverification.checked,
        }),
      );
    }

    const [capacity] = await db
      .select({ claims: count() })
      .from(garageXClaims)
      .where(and(eq(garageXClaims.campaignId, campaign.id), ne(garageXClaims.status, "verification_expired")));
    const claims = Number(capacity?.claims ?? 0);
    const budgetCap = campaign.rewardCrc > 0 ? Math.floor(campaign.budgetCrc / campaign.rewardCrc) : 0;
    const maxClaims = Math.min(campaign.maxClaims, budgetCap);
    if (claims >= maxClaims) {
      return NextResponse.json({ error: "CAMPAIGN_EXHAUSTED" }, { status: 409 });
    }

    let verification: Awaited<ReturnType<typeof verifyGarageXAction>>;
    try {
      verification = await verifyWithCache({
        action,
        tweetId: campaign.tweetId,
        targetXUserId: campaign.targetXUserId,
        xUserId: account.xUserId,
        startedAt,
        allowRetweetedByFallback,
      });
    } catch (error: any) {
      console.error("[garage/x/verify] X API error:", error?.message ?? error);
      return NextResponse.json(
        { error: classifyXApiError(error), detail: error?.message ?? "unknown" },
        { status: 502 },
      );
    }

    if (!verification.ok) {
      return NextResponse.json({
          error: "ACTION_NOT_FOUND",
          evidence: verification.evidence,
          checked: verification.checked,
        },
        { status: 409 },
      );
    }

    const settlementTier = await claimSettlementTier(walletAddress);
    const delayMs = settlementTier.delaySeconds * 1000;
    const payoutAvailableAt = delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();
    const inserted = await db
      .insert(garageXClaims)
      .values({
        campaignId: campaign.id,
        walletAddress,
        xUserId: account.xUserId,
        xUsername: account.username,
        action,
        status: delayMs > 0 ? "verified_pending" : "verified",
        verificationEvidence: verification.evidence,
        verificationChecked: verification.checked,
        observedAt: new Date(),
        payoutAvailableAt,
      })
      .onConflictDoNothing()
      .returning();

    const claim = inserted[0];
    if (!claim) {
      const [current] = await db
        .select()
        .from(garageXClaims)
        .where(
          and(
            eq(garageXClaims.campaignId, campaign.id),
            or(
              eq(garageXClaims.walletAddress, walletAddress),
              eq(garageXClaims.xUserId, account.xUserId),
            ),
          ),
        )
        .limit(1);
      return NextResponse.json({
        status: "already_claimed",
        claim: current ? publicClaim(current) : null,
      });
    }

    if (delayMs > 0) {
      return NextResponse.json({
        status: "verified_pending",
        verified: true,
        evidence: verification.evidence,
        checked: verification.checked,
        availableAt: payoutAvailableAt.toISOString(),
        settlement: settlementTier,
        claim: publicClaim(claim),
      });
    }

    return NextResponse.json(
      await settleClaim({
        claim,
        campaign,
        username: account.username,
        walletAddress,
        action,
        evidence: verification.evidence,
        checked: verification.checked,
      }),
    );
  } catch (error: any) {
    console.error("[garage/x/verify] error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
