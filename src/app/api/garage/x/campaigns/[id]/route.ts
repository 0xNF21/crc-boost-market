export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAuthenticatedAddress } from "@/lib/auth/session";
import { garageXCampaigns } from "@/lib/db/schema";
import { checkAllNewPayments } from "@/lib/circles";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  GARAGE_CAMPAIGN_FUNDING_GAMES,
  getGarageCampaignFundingRecipient,
  isGarageAdmin,
} from "@/lib/garage-x";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await enforceRateLimit(req, "garage-x-campaigns-cancel", 10, 60_000);
  if (limited) return limited;

  const addressOr401 = await requireAuthenticatedAddress(req);
  if (addressOr401 instanceof NextResponse) return addressOr401;
  const address = addressOr401.toLowerCase();

  const { id } = await params;
  const campaignId = Number(id);
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

    const owner = campaign.createdByAddress?.toLowerCase() === address;
    if (!owner && !isGarageAdmin(address)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (campaign.status !== "pending_payment" || campaign.fundingStatus !== "pending") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_PENDING_PAYMENT" }, { status: 409 });
    }

    const recipientAddress = getGarageCampaignFundingRecipient();
    const requiredCrc = Number(campaign.fundingRequiredCrc || 0);
    if (!recipientAddress || !Number.isFinite(requiredCrc) || requiredCrc <= 0) {
      return NextResponse.json({ error: "INVALID_FUNDING_CONFIG" }, { status: 500 });
    }

    const payments = await checkAllNewPayments(requiredCrc, recipientAddress);
    const payment = payments.find(
      (candidate) =>
        GARAGE_CAMPAIGN_FUNDING_GAMES.includes(candidate.gameData?.game || "") &&
        (candidate.gameData?.id === String(campaign.id) || candidate.gameData?.id === campaign.slug),
    );

    if (payment) {
      return NextResponse.json(
        {
          error: "PAYMENT_ALREADY_DETECTED",
          txHash: payment.transactionHash.toLowerCase(),
        },
        { status: 409 },
      );
    }

    await db
      .update(garageXCampaigns)
      .set({
        status: "cancelled",
        fundingStatus: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(garageXCampaigns.id, campaign.id),
          eq(garageXCampaigns.status, "pending_payment"),
        ),
      );

    return NextResponse.json({ cancelled: true });
  } catch (error: any) {
    console.error("[garage/x/campaigns/:id] DELETE error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
