export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { garageTrustProfiles, garageXAccounts, garageXCampaigns, garageXClaims } from "@/lib/db/schema";
import {
  GARAGE_PAID_CLAIM_STATUSES,
  buildGarageCampaignQualityReport,
  campaignToPublic,
} from "@/lib/garage-x";

const CIRCLES_RPC_URL = process.env.NEXT_PUBLIC_CIRCLES_RPC_URL || "https://rpc.aboutcircles.com/";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

type ProfileResult = {
  address: string;
  name: string;
  imageUrl: string | null;
};

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

function isAddress(value: string | null | undefined): boolean {
  return typeof value === "string" && /^0x[a-f0-9]{40}$/.test(value.toLowerCase());
}

function creatorSlug(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeImageUrl(raw: unknown) {
  if (typeof raw !== "string" || !raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("ipfs://")) return `${IPFS_GATEWAY}${raw.replace("ipfs://", "")}`;
  return raw;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function collectProfileRecords(data: unknown): Record<string, unknown>[] {
  const root = asObject(data);
  const candidates = [data, root?.result, root?.profiles, root?.data, root?.items];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.flatMap((item) => {
        const record = asObject(item);
        return record ? [record] : [];
      });
    }

    const record = asObject(candidate);
    if (record) {
      const values = Object.values(record).flatMap((item) => {
        const nested = asObject(item);
        return nested ? [nested] : [];
      });
      return values.length ? values : [record];
    }
  }

  return [];
}

async function fetchIpfsProfile(cid: string): Promise<{ previewImageUrl?: string; imageUrl?: string } | null> {
  try {
    const res = await fetch(`${IPFS_GATEWAY}${cid}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function profilesFromService(params: Record<string, string>) {
  try {
    const url = new URL("profiles/search", CIRCLES_RPC_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const records = collectProfileRecords(await res.json());
    const results = await Promise.all(
      records.map(async (record) => {
        const profile = asObject(record.profile) ?? asObject(record.value) ?? record;
        const address =
          stringField(record, ["address", "avatar", "walletAddress", "owner"]) ??
          stringField(profile, ["address", "avatar", "walletAddress", "owner"]);
        const name = stringField(profile, ["name"]) ?? stringField(record, ["name"]) ?? "";
        let imageUrl = normalizeImageUrl(
          stringField(profile, ["previewImageUrl", "imageUrl", "avatarUrl"]) ??
            stringField(record, ["previewImageUrl", "imageUrl", "avatarUrl"]),
        );
        const cid =
          stringField(record, ["cid", "CID", "cidV0", "cidV1"]) ??
          stringField(profile, ["cid", "CID", "cidV0", "cidV1"]);
        if (!imageUrl && cid) {
          const ipfs = await fetchIpfsProfile(cid);
          imageUrl = normalizeImageUrl(ipfs?.previewImageUrl || ipfs?.imageUrl);
        }
        if (!address) return null;
        return { address: normalizeAddress(address), name, imageUrl };
      }),
    );
    return results.filter((item): item is ProfileResult => Boolean(item));
  } catch {
    return [];
  }
}

async function resolveProfile(id: string): Promise<ProfileResult | null> {
  const decoded: string = decodeURIComponent(id).trim();
  if (isAddress(decoded)) {
    const [profile] = await profilesFromService({ address: normalizeAddress(decoded) });
    return profile ?? { address: normalizeAddress(decoded), name: "", imageUrl: null };
  }

  const slug = creatorSlug(decoded);
  if (slug.length < 2) return null;
  const readableName = decoded.includes("-") ? decoded.replace(/-/g, " ") : decoded;
  const searchTerms = Array.from(new Set([decoded, readableName, slug]));
  for (const term of searchTerms) {
    const results = await profilesFromService({ name: term });
    const exact = results.find((profile) => creatorSlug(profile.name) === slug);
    if (exact) return exact;
    if (results[0]) return results[0];
  }
  return null;
}

function roundCrc(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await resolveProfile(params.id);
    if (!profile) {
      return NextResponse.json({ error: "CREATOR_NOT_FOUND" }, { status: 404 });
    }

    const address = profile.address.toLowerCase();
    const [trustProfile] = await db
      .select({
        trustScore: garageTrustProfiles.trustScore,
        trustLevel: garageTrustProfiles.trustLevel,
        mutualCount: garageTrustProfiles.mutualCount,
        backerStatus: garageTrustProfiles.backerStatus,
        directBacker: garageTrustProfiles.directBacker,
        indirectBackerTrustCount: garageTrustProfiles.indirectBackerTrustCount,
        lastFetchedAt: garageTrustProfiles.lastFetchedAt,
      })
      .from(garageTrustProfiles)
      .where(eq(garageTrustProfiles.walletAddress, address))
      .limit(1);
    const [xAccount] = await db
      .select({
        username: garageXAccounts.username,
        displayName: garageXAccounts.displayName,
      })
      .from(garageXAccounts)
      .where(eq(garageXAccounts.walletAddress, address))
      .limit(1);

    const campaigns = await db
      .select()
      .from(garageXCampaigns)
      .where(eq(garageXCampaigns.createdByAddress, address))
      .orderBy(desc(garageXCampaigns.createdAt))
      .limit(50);

    const ids = campaigns.map((campaign) => campaign.id);
    const claimRows = ids.length
      ? await db
          .select({
            campaignId: garageXClaims.campaignId,
            walletAddress: garageXClaims.walletAddress,
            status: garageXClaims.status,
            verificationChecked: garageXClaims.verificationChecked,
            trustScore: garageTrustProfiles.trustScore,
            backerStatus: garageTrustProfiles.backerStatus,
          })
          .from(garageXClaims)
          .leftJoin(garageTrustProfiles, eq(garageTrustProfiles.walletAddress, garageXClaims.walletAddress))
          .where(inArray(garageXClaims.campaignId, ids))
      : [];
    type CreatorClaimRow = (typeof claimRows)[number];
    const claimsByCampaign = new Map<number, CreatorClaimRow[]>();
    for (const row of claimRows) {
      const list = claimsByCampaign.get(row.campaignId) ?? [];
      list.push(row);
      claimsByCampaign.set(row.campaignId, list);
    }

    const publicCampaigns = campaigns.map((campaign) => {
      const rows = claimsByCampaign.get(campaign.id) ?? [];
      const statsClaims = rows.filter((row) => row.status !== "verification_expired").length;
      return {
        ...campaignToPublic(campaign, { claims: statsClaims }),
        qualityReport: buildGarageCampaignQualityReport(campaign, rows),
      };
    });

    const activeCampaigns = publicCampaigns.filter((campaign) => campaign.status === "active");
    const pendingCampaigns = publicCampaigns.filter((campaign) => campaign.status === "pending_payment");
    const cancelledCampaigns = publicCampaigns.filter((campaign) => campaign.status === "cancelled");
    const spentCampaigns = activeCampaigns.filter((campaign) => campaign.stats.remainingClaims <= 0);
    const liveCampaigns = activeCampaigns.filter((campaign) => campaign.stats.remainingClaims > 0);
    const paidClaimRows = claimRows.filter((row) => GARAGE_PAID_CLAIM_STATUSES.includes(row.status));
    const pendingClaimRows = claimRows.filter((row) => row.status === "verified_pending");
    const removedClaimRows = claimRows.filter((row) => row.status === "verification_expired");
    const settledClaims = paidClaimRows.length + removedClaimRows.length;
    const trustScores = claimRows
      .map((row) => row.trustScore)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    const touchedWallets = new Set(claimRows.map((row) => row.walletAddress.toLowerCase()));

    return NextResponse.json({
      creator: {
        address,
        slug: creatorSlug(profile.name) || address,
        profile: {
          name: profile.name,
          imageUrl: profile.imageUrl,
        },
        xAccount: xAccount ?? null,
        trustProfile: trustProfile
          ? {
              trustScore: trustProfile.trustScore,
              trustLevel: trustProfile.trustLevel,
              mutualCount: Number(trustProfile.mutualCount ?? 0),
              backerStatus: trustProfile.backerStatus,
              directBacker: trustProfile.directBacker,
              indirectBackerTrustCount: Number(trustProfile.indirectBackerTrustCount ?? 0),
              lastFetchedAt: trustProfile.lastFetchedAt.toISOString(),
            }
          : null,
      },
      stats: {
        campaignsFunded: campaigns.length,
        liveCampaigns: liveCampaigns.length,
        spentCampaigns: spentCampaigns.length,
        pendingCampaigns: pendingCampaigns.length,
        cancelledCampaigns: cancelledCampaigns.length,
        rewardPoolCrc: roundCrc(publicCampaigns.reduce((sum, campaign) => sum + campaign.budgetCrc, 0)),
        platformFeeCrc: roundCrc(publicCampaigns.reduce((sum, campaign) => sum + campaign.platformFeeCrc, 0)),
        crcPaid: roundCrc(
          paidClaimRows.reduce((sum, row) => {
            const campaign = publicCampaigns.find((item) => item.id === row.campaignId);
            return sum + Number(campaign?.rewardCrc ?? 0);
          }, 0),
        ),
        crcPending: roundCrc(
          pendingClaimRows.reduce((sum, row) => {
            const campaign = publicCampaigns.find((item) => item.id === row.campaignId);
            return sum + Number(campaign?.rewardCrc ?? 0);
          }, 0),
        ),
        verifiedClaims: claimRows.filter((row) => row.status !== "verification_expired").length,
        paidClaims: paidClaimRows.length,
        removedActionClaims: removedClaimRows.length,
        touchedWallets: touchedWallets.size,
        xReads: claimRows.reduce((sum, row) => sum + Number(row.verificationChecked || 0), 0),
        settlementSuccessRate: settledClaims > 0 ? Math.round((paidClaimRows.length / settledClaims) * 100) : null,
        averageClaimantTrust: trustScores.length
          ? Math.round((trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length) * 100) / 100
          : null,
      },
      campaigns: publicCampaigns,
    });
  } catch (error: any) {
    console.error("[garage/creators] GET error:", error?.message ?? error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
