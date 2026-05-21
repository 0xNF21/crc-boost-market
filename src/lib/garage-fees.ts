export type GarageFeeBackerStatus = "direct" | "indirect" | "none" | "unknown";
export type GarageTrustScoreBand = "high" | "medium" | "low" | "unknown";

export type GarageTrustFeeProfile = {
  trustScore?: number | null;
  backerStatus?: string | null;
  directBacker?: boolean | null;
};

export type GarageCreatorFeeTier = {
  feeBps: number;
  backerStatus: GarageFeeBackerStatus;
  scoreBand: GarageTrustScoreBand;
  label: string;
  reason: string;
};

const DEFAULT_CREATOR_FEE_BPS = 250;

export const GARAGE_CREATOR_FEE_BPS_BY_TRUST: Record<Exclude<GarageFeeBackerStatus, "unknown">, Record<Exclude<GarageTrustScoreBand, "unknown">, number>> = {
  direct: {
    high: 100,
    medium: 125,
    low: 150,
  },
  indirect: {
    high: 175,
    medium: 200,
    low: 225,
  },
  none: {
    high: 250,
    medium: 275,
    low: 300,
  },
};

export const GARAGE_FEE_BACKER_LABELS: Record<GarageFeeBackerStatus, string> = {
  direct: "Direct backer",
  indirect: "Indirect backer",
  none: "No backer link",
  unknown: "Standard",
};

export const GARAGE_FEE_SCORE_LABELS: Record<GarageTrustScoreBand, string> = {
  high: "high trust",
  medium: "medium trust",
  low: "low trust",
  unknown: "trust not refreshed",
};

export const GARAGE_CREATOR_FEE_GRID = [
  { status: "direct" as const, label: GARAGE_FEE_BACKER_LABELS.direct, fees: GARAGE_CREATOR_FEE_BPS_BY_TRUST.direct },
  { status: "indirect" as const, label: GARAGE_FEE_BACKER_LABELS.indirect, fees: GARAGE_CREATOR_FEE_BPS_BY_TRUST.indirect },
  { status: "none" as const, label: GARAGE_FEE_BACKER_LABELS.none, fees: GARAGE_CREATOR_FEE_BPS_BY_TRUST.none },
];

function defaultFeeBps(fallbackFeeBps?: number | null) {
  const feeBps = Number(fallbackFeeBps ?? DEFAULT_CREATOR_FEE_BPS);
  return Number.isFinite(feeBps) && feeBps >= 0 ? Math.floor(feeBps) : DEFAULT_CREATOR_FEE_BPS;
}

export function getGarageTrustScoreBand(score: number | null | undefined): GarageTrustScoreBand {
  if (!Number.isFinite(Number(score))) return "unknown";
  const normalized = Number(score);
  if (normalized >= 70) return "high";
  if (normalized >= 40) return "medium";
  return "low";
}

export function getGarageCreatorFeeTier(
  profile: GarageTrustFeeProfile | null | undefined,
  fallbackFeeBps?: number | null,
): GarageCreatorFeeTier {
  const fallback = defaultFeeBps(fallbackFeeBps);
  if (!profile) {
    return {
      feeBps: fallback,
      backerStatus: "unknown",
      scoreBand: "unknown",
      label: "Standard creator fee",
      reason: "Refresh Circles trust to unlock a progressive creator fee.",
    };
  }

  const rawStatus = profile.directBacker ? "direct" : String(profile.backerStatus || "unknown").toLowerCase();
  const backerStatus: GarageFeeBackerStatus =
    rawStatus === "direct" || rawStatus === "indirect" || rawStatus === "none" ? rawStatus : "unknown";

  if (backerStatus === "unknown") {
    return {
      feeBps: fallback,
      backerStatus,
      scoreBand: "unknown",
      label: "Standard creator fee",
      reason: "Refresh Circles trust to unlock a progressive creator fee.",
    };
  }

  const detectedScoreBand = getGarageTrustScoreBand(profile.trustScore);
  const scoreBand: Exclude<GarageTrustScoreBand, "unknown"> =
    detectedScoreBand === "unknown" ? "low" : detectedScoreBand;
  const feeBps = GARAGE_CREATOR_FEE_BPS_BY_TRUST[backerStatus][scoreBand];

  return {
    feeBps,
    backerStatus,
    scoreBand,
    label: `${GARAGE_FEE_BACKER_LABELS[backerStatus]} · ${GARAGE_FEE_SCORE_LABELS[scoreBand]}`,
    reason: `${GARAGE_FEE_BACKER_LABELS[backerStatus]} with ${GARAGE_FEE_SCORE_LABELS[scoreBand]} gets ${feeBps / 100}% NF Society fee.`,
  };
}
