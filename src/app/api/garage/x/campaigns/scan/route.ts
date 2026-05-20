export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { garageXCampaigns } from "@/lib/db/schema";
import { checkAllNewPayments } from "@/lib/circles";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  GARAGE_CAMPAIGN_FUNDING_GAMES,
  campaignToPublic,
  getGarageCampaignFundingPaymentWithQr,
  getGarageCampaignFundingRecipient,
} from "@/lib/garage-x";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-campaigns-scan", 10, 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const campaignId = Number(body?.campaignId);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: "INVALID_CAMPAIGN" }, { status: 400 });
  }

  try {
    const [campaign] = await db
      .select()
      .from(garageXCampaigns)
      .where(eq(garageXCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
    }

    if (campaign.status === "active" && campaign.fundingStatus === "funded") {
      return NextResponse.json({
        activated: true,
        campaign: campaignToPublic(campaign, { claims: 0 }),
      });
    }

    if (campaign.status !== "pending_payment" || campaign.fundingStatus !== "pending") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_PENDING_PAYMENT" }, { status: 409 });
    }

    const recipientAddress = getGarageCampaignFundingRecipient();
    if (!recipientAddress) {
      return NextResponse.json({ error: "FUNDING_RECIPIENT_MISSING" }, { status: 503 });
    }

    const requiredCrc = Number(campaign.fundingRequiredCrc || 0);
    if (!Number.isFinite(requiredCrc) || requiredCrc <= 0) {
      return NextResponse.json({ error: "INVALID_FUNDING_AMOUNT" }, { status: 500 });
    }

    const payments = await checkAllNewPayments(requiredCrc, recipientAddress);
    const payment = payments.find(
      (candidate) =>
        GARAGE_CAMPAIGN_FUNDING_GAMES.includes(candidate.gameData?.game || "") &&
        (candidate.gameData?.id === String(campaign.id) || candidate.gameData?.id === campaign.slug),
    );

    if (!payment) {
      return NextResponse.json({
        activated: false,
        error: "PAYMENT_NOT_FOUND",
        payment: await getGarageCampaignFundingPaymentWithQr(campaign),
      }, { status: 404 });
    }

    const [updated] = await db
      .update(garageXCampaigns)
      .set({
        status: "active",
        fundingStatus: "funded",
        fundingTxHash: payment.transactionHash.toLowerCase(),
        fundedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(garageXCampaigns.id, campaign.id),
          eq(garageXCampaigns.status, "pending_payment"),
        ),
      )
      .returning();

    return NextResponse.json({
      activated: true,
      txHash: payment.transactionHash.toLowerCase(),
      campaign: campaignToPublic(updated ?? campaign, { claims: 0 }),
    });
  } catch (error: any) {
    console.error("[garage/x/campaigns/scan] error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
