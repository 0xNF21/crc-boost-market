export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress, requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageTrustProfiles, garageXCampaigns, garageXClaims } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getGarageCreatorFeeTier } from "@/lib/garage-fees";
import type { GarageCampaignQualityReport } from "@/lib/garage-x";
import {
  SEEDED_GARAGE_X_CAMPAIGN,
  calculateGarageCampaignFunding,
  getGarageCampaignFeeBps,
  campaignToPublic,
  getGarageCampaignFundingPaymentWithQr,
  isGarageAdmin,
  normalizeTweetUrl,
  normalizeXAction,
  parseTweetId,
  rankGarageCampaigns,
} from "@/lib/garage-x";

const PAID_CLAIM_STATUSES = ["paid", "payout_sending", "payout_pending"];

type QualityClaimRow = {
  campaignId: number;
  status: string;
  verificationChecked: number;
  trustScore: number | null;
  backerStatus: string | null;
};

type QualityTrustBand = keyof GarageCampaignQualityReport["trustBands"];
type QualityBackerStatus = keyof GarageCampaignQualityReport["backerSplit"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function shortSlugSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

function roundCrc(value: number) {
  return Math.round(value * 100) / 100;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function trustBand(score: number | null): QualityTrustBand {
  if (score === null || !Number.isFinite(score)) return "unknown";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function normalizedBackerStatus(status: string | null | undefined): QualityBackerStatus {
  return status === "direct" || status === "indirect" || status === "none" ? status : "unknown";
}

function buildCampaignQualityReport(
  campaign: typeof garageXCampaigns.$inferSelect,
  rows: QualityClaimRow[],
): GarageCampaignQualityReport {
  const rewardCrc = Number(campaign.rewardCrc || 0);
  const paidClaims = rows.filter((row) => PAID_CLAIM_STATUSES.includes(row.status)).length;
  const pendingSettlementClaims = rows.filter((row) => row.status === "verified_pending").length;
  const removedActionClaims = rows.filter((row) => row.status === "verification_expired").length;
  const payoutFailedClaims = rows.filter((row) => row.status === "payout_failed").length;
  const verifiedClaims = rows.filter((row) => row.status !== "verification_expired").length;
  const settledClaims = paidClaims + removedActionClaims;
  const trustScores = rows
    .map((row) => row.trustScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const trustBands = { high: 0, medium: 0, low: 0, unknown: 0 };
  const backerSplit = { direct: 0, indirect: 0, none: 0, unknown: 0 };

  for (const row of rows) {
    trustBands[trustBand(row.trustScore)] += 1;
    backerSplit[normalizedBackerStatus(row.backerStatus)] += 1;
  }

  const crcPaid = roundCrc(paidClaims * rewardCrc);
  const crcPending = roundCrc(pendingSettlementClaims * rewardCrc);
  const verifiedCost = crcPaid + crcPending;

  return {
    totalClaims: rows.length,
    verifiedClaims,
    paidClaims,
    pendingSettlementClaims,
    removedActionClaims,
    payoutFailedClaims,
    xReads: rows.reduce((sum, row) => sum + Number(row.verificationChecked || 0), 0),
    crcPaid,
    crcPending,
    costPerVerifiedClaim: verifiedClaims > 0 ? roundCrc(verifiedCost / verifiedClaims) : null,
    costPerPaidClaim: paidClaims > 0 ? roundCrc(crcPaid / paidClaims) : null,
    settlementSuccessRate: settledClaims > 0 ? Math.round((paidClaims / settledClaims) * 100) : null,
    averageTrustScore: trustScores.length
      ? Math.round((trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length) * 100) / 100
      : null,
    medianTrustScore: median(trustScores),
    trustCoverage: rows.length > 0 ? Math.round((trustScores.length / rows.length) * 100) : 0,
    trustBands,
    backerSplit,
  };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-campaigns-read", 60, 60_000);
  if (limited) return limited;

  const address = await getAuthenticatedAddress(req).catch(() => null);

  try {
    const campaignVisibility = address
      ? or(
          eq(garageXCampaigns.status, "active"),
          and(
            inArray(garageXCampaigns.status, ["pending_payment", "cancelled"]),
            eq(garageXCampaigns.createdByAddress, address.toLowerCase()),
          ),
        )
      : eq(garageXCampaigns.status, "active");

    const campaigns = await db
      .select()
      .from(garageXCampaigns)
      .where(campaignVisibility)
      .orderBy(desc(garageXCampaigns.createdAt))
      .limit(30);

    if (campaigns.length === 0) {
      return NextResponse.json({ campaigns: [] });
    }

    const ids = campaigns.map((campaign) => campaign.id);
    const claimCounts = await db
      .select({ campaignId: garageXClaims.campaignId, claims: count() })
      .from(garageXClaims)
      .where(and(inArray(garageXClaims.campaignId, ids), ne(garageXClaims.status, "verification_expired")))
      .groupBy(garageXClaims.campaignId);
    const claimCountByCampaign = new Map(claimCounts.map((row) => [row.campaignId, Number(row.claims)]));

    const ownClaims = address
      ? await db
          .select({
            campaignId: garageXClaims.campaignId,
            status: garageXClaims.status,
            verificationEvidence: garageXClaims.verificationEvidence,
            verificationChecked: garageXClaims.verificationChecked,
            payoutAvailableAt: garageXClaims.payoutAvailableAt,
            payoutStatus: garageXClaims.payoutStatus,
            payoutTxHash: garageXClaims.payoutTxHash,
            createdAt: garageXClaims.createdAt,
          })
          .from(garageXClaims)
          .where(
            and(
              eq(garageXClaims.walletAddress, address.toLowerCase()),
              inArray(garageXClaims.campaignId, ids),
            ),
          )
      : [];
    const ownByCampaign = new Map(
      ownClaims
        .filter((claim) => claim.campaignId)
        .map((claim) => [
          claim.campaignId,
          {
            status: claim.status,
            verificationEvidence: claim.verificationEvidence,
            verificationChecked: claim.verificationChecked,
            payoutAvailableAt: claim.payoutAvailableAt?.toISOString() ?? null,
            payoutStatus: claim.payoutStatus,
            payoutTxHash: claim.payoutTxHash,
            createdAt: claim.createdAt.toISOString(),
          },
        ]),
    );

    const creatorWallets = [
      ...new Set(
        campaigns
          .map((campaign) => campaign.createdByAddress?.toLowerCase())
          .filter((wallet): wallet is string => Boolean(wallet)),
      ),
    ];
    const creatorTrustRows = creatorWallets.length
      ? await db
          .select({
            walletAddress: garageTrustProfiles.walletAddress,
            trustScore: garageTrustProfiles.trustScore,
            trustLevel: garageTrustProfiles.trustLevel,
            backerStatus: garageTrustProfiles.backerStatus,
          })
          .from(garageTrustProfiles)
          .where(inArray(garageTrustProfiles.walletAddress, creatorWallets))
      : [];
    const creatorTrustByWallet = new Map(
      creatorTrustRows.map((row) => [row.walletAddress.toLowerCase(), row]),
    );

    const qualityRows = await db
      .select({
        campaignId: garageXClaims.campaignId,
        status: garageXClaims.status,
        verificationChecked: garageXClaims.verificationChecked,
        trustScore: garageTrustProfiles.trustScore,
        backerStatus: garageTrustProfiles.backerStatus,
      })
      .from(garageXClaims)
      .leftJoin(garageTrustProfiles, eq(garageTrustProfiles.walletAddress, garageXClaims.walletAddress))
      .where(inArray(garageXClaims.campaignId, ids));
    const qualityRowsByCampaign = new Map<number, QualityClaimRow[]>();
    for (const row of qualityRows) {
      const list = qualityRowsByCampaign.get(row.campaignId) ?? [];
      list.push({
        campaignId: row.campaignId,
        status: row.status,
        verificationChecked: Number(row.verificationChecked || 0),
        trustScore: row.trustScore,
        backerStatus: row.backerStatus,
      });
      qualityRowsByCampaign.set(row.campaignId, list);
    }

    const publicCampaigns = rankGarageCampaigns(
      await Promise.all(
        campaigns.map(async (campaign) => ({
          ...campaignToPublic(
            campaign,
            { claims: claimCountByCampaign.get(campaign.id) ?? 0 },
            ownByCampaign.get(campaign.id) ?? null,
          ),
          qualityReport: buildCampaignQualityReport(campaign, qualityRowsByCampaign.get(campaign.id) ?? []),
          fundingPayment:
            address &&
            campaign.status === "pending_payment" &&
            campaign.createdByAddress?.toLowerCase() === address.toLowerCase()
              ? await getGarageCampaignFundingPaymentWithQr(campaign)
              : null,
        })),
      ),
      creatorTrustByWallet,
    );

    return NextResponse.json({
      campaigns: publicCampaigns,
    });
  } catch (error: any) {
    console.error("[garage/x/campaigns] GET error:", error?.message ?? error);
    return NextResponse.json(
      {
        campaigns: [SEEDED_GARAGE_X_CAMPAIGN],
        unavailable: true,
      },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-campaigns-write", 10, 60_000);
  if (limited) return limited;

  const addressOr401 = await requireAuthenticatedAddress(req);
  if (addressOr401 instanceof NextResponse) return addressOr401;
  const address = addressOr401.toLowerCase();

  const body = await req.json().catch(() => ({}));
  const action = normalizeXAction(body?.action);
  if (!action || action === "follow") {
    return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
  }

  const title = cleanText(body?.title, 120);
  if (!title) {
    return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  }

  const tweetId = parseTweetId(body?.tweetUrl || body?.tweetId);
  const tweetUrl = normalizeTweetUrl(body?.tweetUrl || body?.tweetId);
  if (!tweetId || !tweetUrl) {
    return NextResponse.json({ error: "VALID_TWEET_REQUIRED" }, { status: 400 });
  }

  const rewardCrc = cleanNumber(body?.rewardCrc, 1);
  const fallbackClaims = Math.floor(cleanNumber(body?.budgetCrc, 25) / Math.max(rewardCrc, 0.01));
  const maxClaims = Math.floor(cleanNumber(body?.maxClaims, fallbackClaims));
  if (rewardCrc < 0.01 || rewardCrc > 100 || maxClaims <= 0 || maxClaims > 10_000) {
    return NextResponse.json({ error: "INVALID_BUDGET" }, { status: 400 });
  }

  const [creatorTrustProfile] = await db
    .select({
      trustScore: garageTrustProfiles.trustScore,
      backerStatus: garageTrustProfiles.backerStatus,
      directBacker: garageTrustProfiles.directBacker,
    })
    .from(garageTrustProfiles)
    .where(eq(garageTrustProfiles.walletAddress, address))
    .limit(1);
  const creatorFeeTier = getGarageCreatorFeeTier(creatorTrustProfile ?? null, getGarageCampaignFeeBps());
  const funding = calculateGarageCampaignFunding(rewardCrc, maxClaims, creatorFeeTier.feeBps);
  if (funding.rewardPoolCrc <= 0 || funding.rewardPoolCrc > 10_000) {
    return NextResponse.json({ error: "INVALID_BUDGET" }, { status: 400 });
  }

  const baseSlug = slugify(cleanText(body?.slug, 90) || title) || "boost";
  const adminBypass = isGarageAdmin(address) && body?.adminBypass === true;

  try {
    let campaign: typeof garageXCampaigns.$inferSelect | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 4 && !campaign; attempt += 1) {
      const slug = `${baseSlug}-${shortSlugSuffix()}`;
      try {
        [campaign] = await db
          .insert(garageXCampaigns)
          .values({
            slug,
            title,
            description: cleanText(body?.description, 500),
            action,
            tweetId,
            tweetUrl,
            rewardCrc,
            budgetCrc: funding.rewardPoolCrc,
            maxClaims,
            status: adminBypass ? "active" : "pending_payment",
            createdByAddress: address,
            fundingStatus: adminBypass ? "funded" : "pending",
            fundingRequiredCrc: adminBypass ? funding.rewardPoolCrc : funding.totalCrc,
            platformFeeCrc: adminBypass ? 0 : funding.platformFeeCrc,
            fundedAt: adminBypass ? new Date() : null,
          })
          .returning();
      } catch (error: any) {
        lastError = error;
        if (error?.code !== "23505") throw error;
      }
    }

    if (!campaign) throw lastError ?? new Error("CAMPAIGN_CREATE_FAILED");

    const publicCampaign = campaignToPublic(campaign, { claims: 0 });
    return NextResponse.json({
      campaign: {
        ...publicCampaign,
        fundingPayment: adminBypass ? null : await getGarageCampaignFundingPaymentWithQr(campaign),
      },
    });
  } catch (error: any) {
    console.error("[garage/x/campaigns] POST error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
