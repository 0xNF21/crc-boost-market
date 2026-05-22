import type { GarageBackerStatus } from "@/lib/garage-trust";

export type GarageReferralTrustBand = "high" | "medium" | "low";

export type GarageReferralQualityTier = {
  backerStatus: GarageBackerStatus;
  trustBand: GarageReferralTrustBand;
  multiplier: number;
  label: string;
};

export const GARAGE_REFERRAL_QUALITY_GRID = [
  {
    status: "direct" as GarageBackerStatus,
    label: "Direct backer",
    multipliers: { high: 1.5, medium: 1.3, low: 1.15 },
  },
  {
    status: "indirect" as GarageBackerStatus,
    label: "Indirect backer",
    multipliers: { high: 1.25, medium: 1.1, low: 1 },
  },
  {
    status: "none" as GarageBackerStatus,
    label: "No backer",
    multipliers: { high: 1, medium: 0.85, low: 0.7 },
  },
] as const;

export const GARAGE_REFERRAL_MIN_REWARD_CRC = 0.1;

export function getGarageReferralTrustBand(trustScore: number | null | undefined): GarageReferralTrustBand {
  if (typeof trustScore === "number" && Number.isFinite(trustScore)) {
    if (trustScore >= 70) return "high";
    if (trustScore >= 40) return "medium";
  }
  return "low";
}

function normalizeBackerStatus(status: GarageBackerStatus | string | null | undefined): Exclude<GarageBackerStatus, "unknown"> {
  if (status === "direct" || status === "indirect" || status === "none") return status;
  return "none";
}

export function getGarageReferralQualityTier(params: {
  backerStatus: GarageBackerStatus | string | null | undefined;
  trustScore: number | null | undefined;
}): GarageReferralQualityTier {
  const backerStatus = normalizeBackerStatus(params.backerStatus);
  const trustBand = getGarageReferralTrustBand(params.trustScore);
  const row = GARAGE_REFERRAL_QUALITY_GRID.find((item) => item.status === backerStatus) ?? GARAGE_REFERRAL_QUALITY_GRID[2];
  const multiplier = row.multipliers[trustBand];

  return {
    backerStatus,
    trustBand,
    multiplier,
    label: `${row.label} / ${trustBand} trust`,
  };
}

export function calculateGarageReferralRewardAmount(baseAmountCrc: number, multiplier: number) {
  const multiplied = Math.round(baseAmountCrc * multiplier * 100) / 100;
  return Math.max(GARAGE_REFERRAL_MIN_REWARD_CRC, multiplied);
}
