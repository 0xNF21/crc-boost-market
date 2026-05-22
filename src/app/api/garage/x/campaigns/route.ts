export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress, requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageTrustProfiles, garageXCampaigns, garageXClaims } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getGarageCreatorFeeTier } from "@/lib/garage-fees";
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

    const publicCampaigns = rankGarageCampaigns(
      await Promise.all(
        campaigns.map(async (campaign) => ({
          ...campaignToPublic(
            campaign,
            { claims: claimCountByCampaign.get(campaign.id) ?? 0 },
            ownByCampaign.get(campaign.id) ?? null,
          ),
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
