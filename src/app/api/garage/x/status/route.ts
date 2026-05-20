export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress } from "@/lib/auth/session";
import { garageXAccounts, garageXCampaigns, garageXClaims } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getGarageCampaignFeeBps, getGarageXPayoutDelaySeconds, isGarageAdmin, isXApiConfigured, isXOAuthConfigured } from "@/lib/garage-x";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-status", 60, 60_000);
  if (limited) return limited;

  const address = await getAuthenticatedAddress(req).catch(() => null);

  try {
    const linkedAccount = address
      ? (
          await db
            .select({
              xUserId: garageXAccounts.xUserId,
              username: garageXAccounts.username,
              displayName: garageXAccounts.displayName,
              updatedAt: garageXAccounts.updatedAt,
            })
            .from(garageXAccounts)
            .where(eq(garageXAccounts.walletAddress, address.toLowerCase()))
            .limit(1)
        )[0] ?? null
      : null;

    const recentClaims = address
      ? await db
          .select({
            id: garageXClaims.id,
            campaignId: garageXClaims.campaignId,
            campaignTitle: garageXCampaigns.title,
            campaignRewardCrc: garageXCampaigns.rewardCrc,
            campaignTweetUrl: garageXCampaigns.tweetUrl,
            action: garageXClaims.action,
            status: garageXClaims.status,
            verificationEvidence: garageXClaims.verificationEvidence,
            verificationChecked: garageXClaims.verificationChecked,
            payoutAvailableAt: garageXClaims.payoutAvailableAt,
            payoutStatus: garageXClaims.payoutStatus,
            payoutTxHash: garageXClaims.payoutTxHash,
            createdAt: garageXClaims.createdAt,
          })
          .from(garageXClaims)
          .innerJoin(garageXCampaigns, eq(garageXCampaigns.id, garageXClaims.campaignId))
          .where(
            and(
              eq(garageXClaims.walletAddress, address.toLowerCase()),
              eq(garageXCampaigns.status, "active"),
            ),
          )
          .orderBy(desc(garageXClaims.createdAt))
          .limit(6)
      : [];

    const [personal] = address
      ? await db
          .select({
            verifiedActions: sql<number>`count(*)`,
            crcEarned: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} IN ('paid', 'payout_sending', 'payout_pending') THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`,
            crcPending: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} = 'verified_pending' THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`,
            pendingSettlements: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} = 'verified_pending' THEN 1 ELSE 0 END), 0)`,
            xReads: sql<number>`COALESCE(SUM(${garageXClaims.verificationChecked}), 0)`,
          })
          .from(garageXClaims)
          .innerJoin(garageXCampaigns, eq(garageXCampaigns.id, garageXClaims.campaignId))
          .where(
            and(
              eq(garageXClaims.walletAddress, address.toLowerCase()),
              eq(garageXCampaigns.status, "active"),
              ne(garageXClaims.status, "verification_expired"),
            ),
          )
      : [null];

    const [global] = await db
      .select({
        claims: sql<number>`count(*)`,
        wallets: sql<number>`count(distinct ${garageXClaims.walletAddress})`,
        xAccounts: sql<number>`count(distinct ${garageXClaims.xUserId})`,
        crcPaid: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} IN ('paid', 'payout_sending', 'payout_pending') THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`,
        xReads: sql<number>`COALESCE(SUM(${garageXClaims.verificationChecked}), 0)`,
      })
      .from(garageXClaims)
      .innerJoin(garageXCampaigns, eq(garageXCampaigns.id, garageXClaims.campaignId))
      .where(and(eq(garageXCampaigns.status, "active"), ne(garageXClaims.status, "verification_expired")));

    const [campaignSummary] = await db
      .select({
        activeCampaigns: sql<number>`count(*)`,
      })
      .from(garageXCampaigns)
      .where(eq(garageXCampaigns.status, "active"));

    const leaderboard = await db
      .select({
        walletAddress: garageXClaims.walletAddress,
        xUsername: sql<string | null>`MAX(${garageXClaims.xUsername})`,
        actions: sql<number>`count(*)`,
        crcEarned: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} IN ('paid', 'payout_sending', 'payout_pending') THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`,
        crcPending: sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} = 'verified_pending' THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`,
        xReads: sql<number>`COALESCE(SUM(${garageXClaims.verificationChecked}), 0)`,
        lastClaimAt: sql<Date | null>`MAX(${garageXClaims.createdAt})`,
      })
      .from(garageXClaims)
      .innerJoin(garageXCampaigns, eq(garageXCampaigns.id, garageXClaims.campaignId))
      .where(ne(garageXClaims.status, "verification_expired"))
      .groupBy(garageXClaims.walletAddress)
      .orderBy(
        desc(sql<number>`COALESCE(SUM(CASE WHEN ${garageXClaims.status} IN ('paid', 'payout_sending', 'payout_pending') THEN ${garageXCampaigns.rewardCrc} ELSE 0 END), 0)`),
        desc(sql<number>`count(*)`),
      )
      .limit(10);

    return NextResponse.json({
      wallet: address,
      isAdmin: isGarageAdmin(address),
      xOAuthConfigured: isXOAuthConfigured(),
      xApiConfigured: isXApiConfigured(),
      linkedAccount: linkedAccount
        ? {
            xUserId: linkedAccount.xUserId,
            username: linkedAccount.username,
            displayName: linkedAccount.displayName,
            updatedAt: linkedAccount.updatedAt.toISOString(),
          }
        : null,
      recentClaims: recentClaims.map((claim) => ({
        id: claim.id,
        campaignId: claim.campaignId,
        campaignTitle: claim.campaignTitle,
        campaignRewardCrc: Number(claim.campaignRewardCrc ?? 0),
        campaignTweetUrl: claim.campaignTweetUrl,
        action: claim.action,
        status: claim.status,
        verificationEvidence: claim.verificationEvidence,
        verificationChecked: claim.verificationChecked,
        payoutAvailableAt: claim.payoutAvailableAt?.toISOString() ?? null,
        payoutStatus: claim.payoutStatus,
        payoutTxHash: claim.payoutTxHash,
        createdAt: claim.createdAt.toISOString(),
      })),
      global: {
        claims: Number(global?.claims ?? 0),
        wallets: Number(global?.wallets ?? 0),
        xAccounts: Number(global?.xAccounts ?? 0),
        crcPaid: Number(global?.crcPaid ?? 0),
        xReads: Number(global?.xReads ?? 0),
        activeCampaigns: Number(campaignSummary?.activeCampaigns ?? 0),
      },
      personal: {
        verifiedActions: Number(personal?.verifiedActions ?? 0),
        crcEarned: Number(personal?.crcEarned ?? 0),
        crcPending: Number(personal?.crcPending ?? 0),
        pendingSettlements: Number(personal?.pendingSettlements ?? 0),
        xReads: Number(personal?.xReads ?? 0),
      },
      leaderboard: leaderboard.map((entry) => {
        const lastClaimAt = entry.lastClaimAt ? new Date(entry.lastClaimAt).toISOString() : null;
        return {
          walletAddress: entry.walletAddress,
          xUsername: entry.xUsername,
          actions: Number(entry.actions ?? 0),
          crcEarned: Number(entry.crcEarned ?? 0),
          crcPending: Number(entry.crcPending ?? 0),
          xReads: Number(entry.xReads ?? 0),
          lastClaimAt,
        };
      }),
      settings: {
        payoutDelaySeconds: getGarageXPayoutDelaySeconds(),
        campaignFeeBps: getGarageCampaignFeeBps(),
      },
    });
  } catch (error: any) {
    console.error("[garage/x/status] error:", error?.message ?? error);
    return NextResponse.json(
      {
        wallet: address,
        isAdmin: isGarageAdmin(address),
        xOAuthConfigured: isXOAuthConfigured(),
        xApiConfigured: isXApiConfigured(),
        linkedAccount: null,
        recentClaims: [],
        global: { claims: 0, wallets: 0, xAccounts: 0, crcPaid: 0, xReads: 0, activeCampaigns: 0 },
        personal: { verifiedActions: 0, crcEarned: 0, crcPending: 0, pendingSettlements: 0, xReads: 0 },
        leaderboard: [],
        settings: {
          payoutDelaySeconds: getGarageXPayoutDelaySeconds(),
          campaignFeeBps: getGarageCampaignFeeBps(),
        },
        unavailable: true,
      },
      { status: 200 },
    );
  }
}
