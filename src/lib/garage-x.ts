import type { GarageTrustProfile, GarageXCampaign } from "@/lib/db/schema";
import QRCode from "qrcode";
import { generateGamePaymentLink } from "@/lib/circles";

export type GarageXAction = "like" | "repost" | "quote" | "follow";
export type GarageXVerificationResult = {
  ok: boolean;
  checked: number;
  evidence: string;
  observedUserIds?: string[];
};

export const GARAGE_X_ACTIONS: GarageXAction[] = ["like", "repost", "quote", "follow"];
export const GARAGE_CAMPAIGN_FUNDING_GAME = "buyboostcampaign";
export const GARAGE_CAMPAIGN_FUNDING_GAMES = [GARAGE_CAMPAIGN_FUNDING_GAME, "buyboost", "garage_boost"];

const CIRCLES_RPC_URL = process.env.NEXT_PUBLIC_CIRCLES_RPC_URL || "https://rpc.aboutcircles.com/";

export const GARAGE_X_SCOPES = [
  "tweet.read",
  "users.read",
].join(" ");

export type PublicGarageXCampaign = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  action: GarageXAction;
  tweetId: string | null;
  tweetUrl: string | null;
  targetXUserId: string | null;
  targetUsername: string | null;
  rewardCrc: number;
  budgetCrc: number;
  maxClaims: number;
  status: string;
  createdByAddress: string | null;
  fundingStatus: string;
  fundingRequiredCrc: number;
  platformFeeCrc: number;
  fundingTxHash: string | null;
  fundedAt: string | null;
  createdAt: string;
  stats: {
    claims: number;
    remainingClaims: number;
    spentCrc: number;
  };
  qualityReport: GarageCampaignQualityReport | null;
  ranking: GarageCampaignRanking;
  claimedByMe?: {
    status: string;
    verificationEvidence: string | null;
    verificationChecked: number;
    payoutAvailableAt: string | null;
    payoutStatus: string | null;
    payoutTxHash: string | null;
    createdAt: string;
  } | null;
  fundingPayment?: GarageCampaignFundingPayment | null;
};

export type GarageCampaignQualityReport = {
  totalClaims: number;
  verifiedClaims: number;
  paidClaims: number;
  pendingSettlementClaims: number;
  removedActionClaims: number;
  payoutFailedClaims: number;
  xReads: number;
  crcPaid: number;
  crcPending: number;
  costPerVerifiedClaim: number | null;
  costPerPaidClaim: number | null;
  settlementSuccessRate: number | null;
  averageTrustScore: number | null;
  medianTrustScore: number | null;
  trustCoverage: number;
  trustBands: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  backerSplit: {
    direct: number;
    indirect: number;
    none: number;
    unknown: number;
  };
};

export type GarageCampaignQualityClaimRow = {
  status: string;
  verificationChecked: number;
  trustScore: number | null;
  backerStatus: string | null;
};

export type GarageCampaignRanking = {
  score: number;
  reasons: string[];
  creatorTrustScore: number | null;
  creatorTrustLevel: string | null;
  creatorBackerStatus: string | null;
};

export type GarageCampaignFundingPayment = {
  campaignId: number;
  recipientAddress: string;
  amountCrc: number;
  rewardPoolCrc: number;
  platformFeeCrc: number;
  feeBps: number;
  gameData: string;
  paymentLink: string;
  qrCode: string;
};

export const SEEDED_GARAGE_X_CAMPAIGN: PublicGarageXCampaign = {
  id: 0,
  slug: "circles-garage-cycle-01-repost",
  title: "Repost the Circles Garage announcement",
  description: "Open the Garage announcement on X, repost it, then return here to verify and claim CRC.",
  action: "repost",
  tweetId: "2056399379540644228",
  tweetUrl: "https://x.com/aboutcircles/status/2056399379540644228",
  targetXUserId: null,
  targetUsername: null,
  rewardCrc: 1,
  budgetCrc: 50,
  maxClaims: 50,
  status: "active",
  createdByAddress: null,
  fundingStatus: "funded",
  fundingRequiredCrc: 50,
  platformFeeCrc: 0,
  fundingTxHash: null,
  fundedAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  stats: {
    claims: 0,
    remainingClaims: 50,
    spentCrc: 0,
  },
  qualityReport: null,
  ranking: {
    score: 0,
    reasons: ["Garage seed boost"],
    creatorTrustScore: null,
    creatorTrustLevel: null,
    creatorBackerStatus: null,
  },
};

export function getXBearerToken(): string | null {
  return process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || null;
}

export function isXApiConfigured(): boolean {
  return Boolean(getXBearerToken());
}

export function isXOAuthConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID);
}

export function getGarageXPayoutDelaySeconds(): number {
  const seconds = Number(process.env.GARAGE_X_PAYOUT_DELAY_SECONDS ?? 300);
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
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

function qualityTrustBand(score: number | null): keyof GarageCampaignQualityReport["trustBands"] {
  if (score === null || !Number.isFinite(score)) return "unknown";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function qualityBackerStatus(status: string | null | undefined): keyof GarageCampaignQualityReport["backerSplit"] {
  return status === "direct" || status === "indirect" || status === "none" ? status : "unknown";
}

export const GARAGE_PAID_CLAIM_STATUSES = ["paid", "payout_sending", "payout_pending"];

export function buildGarageCampaignQualityReport(
  campaign: Pick<GarageXCampaign, "rewardCrc">,
  rows: GarageCampaignQualityClaimRow[],
): GarageCampaignQualityReport {
  const rewardCrc = Number(campaign.rewardCrc || 0);
  const paidClaims = rows.filter((row) => GARAGE_PAID_CLAIM_STATUSES.includes(row.status)).length;
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
    trustBands[qualityTrustBand(row.trustScore)] += 1;
    backerSplit[qualityBackerStatus(row.backerStatus)] += 1;
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

function sanitizePaymentDataPart(value: string | null | undefined, fallback: string): string {
  const normalized = (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function profileServiceUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, CIRCLES_RPC_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown> | null, keys: string[]): string | null {
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

async function getCirclesProfileName(address: string | null | undefined): Promise<string | null> {
  if (!address) return null;
  try {
    const res = await fetch(profileServiceUrl("profiles/search", { address: address.toLowerCase() }), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const records = collectProfileRecords(await res.json());
    for (const record of records) {
      const profile = asObject(record.profile) ?? asObject(record.value) ?? record;
      const name = stringField(profile, ["name"]) ?? stringField(record, ["name"]);
      if (name) return name;
    }
  } catch {
    return null;
  }
  return null;
}

export function getGarageCampaignFeeBps(): number {
  const bps = Number(process.env.GARAGE_CAMPAIGN_FEE_BPS ?? 250);
  return Number.isFinite(bps) && bps >= 0 ? Math.floor(bps) : 250;
}

export function getGarageCampaignFundingRecipient(): string {
  return (
    process.env.GARAGE_CAMPAIGN_FUNDING_RECIPIENT_ADDRESS ||
    process.env.SAFE_ADDRESS ||
    process.env.NEXT_PUBLIC_DEFAULT_RECIPIENT_ADDRESS ||
    ""
  ).toLowerCase();
}

export function calculateGarageCampaignFunding(rewardCrc: number, maxClaims: number, feeBps = getGarageCampaignFeeBps()) {
  const rewardPoolCrc = roundCrc(rewardCrc * maxClaims);
  const normalizedFeeBps = Number.isFinite(feeBps) && feeBps >= 0 ? Math.floor(feeBps) : getGarageCampaignFeeBps();
  const platformFeeCrc = roundCrc((rewardPoolCrc * normalizedFeeBps) / 10_000);
  return {
    rewardPoolCrc,
    platformFeeCrc,
    totalCrc: roundCrc(rewardPoolCrc + platformFeeCrc),
    feeBps: normalizedFeeBps,
  };
}

function campaignFeeBpsFromStoredAmounts(campaign: Pick<GarageXCampaign, "budgetCrc" | "platformFeeCrc">) {
  const rewardPoolCrc = Number(campaign.budgetCrc || 0);
  const platformFeeCrc = Number(campaign.platformFeeCrc || 0);
  if (rewardPoolCrc <= 0 || platformFeeCrc < 0) return getGarageCampaignFeeBps();
  return Math.round((platformFeeCrc * 10_000) / rewardPoolCrc);
}

function trustLevelWeight(level: string | null | undefined) {
  const normalized = (level || "").toUpperCase();
  if (normalized === "HIGH") return 35;
  if (normalized === "MEDIUM") return 18;
  if (normalized === "LOW") return 6;
  return 0;
}

function backerWeight(status: string | null | undefined) {
  if (status === "direct") return 90;
  if (status === "indirect") return 50;
  if (status === "none") return 10;
  return 0;
}

function rewardWeight(rewardCrc: number) {
  return Math.min(160, Math.max(0, rewardCrc) * 24);
}

function remainingSlotsWeight(remainingClaims: number, maxClaims: number) {
  if (remainingClaims <= 0) return -500;
  const openRatio = maxClaims > 0 ? remainingClaims / maxClaims : 0;
  return Math.round(Math.min(120, remainingClaims * 4) + openRatio * 40);
}

function freshnessWeight(createdAt: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  if (!Number.isFinite(ageHours)) return 0;
  return Math.round(Math.max(0, 96 - ageHours));
}

function pushUniqueReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function getGarageCampaignRanking(
  campaign: PublicGarageXCampaign,
  creatorTrust: Pick<GarageTrustProfile, "trustScore" | "trustLevel" | "backerStatus"> | null | undefined,
): GarageCampaignRanking {
  const creatorBackerStatus = creatorTrust?.backerStatus ?? null;
  const creatorTrustScore = creatorTrust?.trustScore ?? null;
  const creatorTrustLevel = creatorTrust?.trustLevel ?? null;
  const remaining = Number(campaign.stats.remainingClaims || 0);
  const reasons: string[] = [];

  const score =
    (campaign.status === "active" ? 10_000 : campaign.status === "pending_payment" ? 1_000 : 0) +
    rewardWeight(campaign.rewardCrc) +
    remainingSlotsWeight(remaining, campaign.maxClaims) +
    freshnessWeight(campaign.createdAt) +
    backerWeight(creatorBackerStatus) +
    trustLevelWeight(creatorTrustLevel);

  if (creatorBackerStatus === "direct") pushUniqueReason(reasons, "Direct creator");
  if (creatorBackerStatus === "indirect") pushUniqueReason(reasons, "Indirect creator");
  if (creatorTrustLevel === "HIGH") pushUniqueReason(reasons, "High trust creator");
  if (campaign.rewardCrc >= 5) pushUniqueReason(reasons, "High reward");
  else if (campaign.rewardCrc >= 1) pushUniqueReason(reasons, "Good reward");

  const fillPercent = campaign.maxClaims > 0
    ? Math.round((campaign.stats.claims / campaign.maxClaims) * 100)
    : 0;
  if (fillPercent >= 80 && remaining > 0) pushUniqueReason(reasons, "Almost filled");
  else if (remaining >= 5) pushUniqueReason(reasons, "Open slots");

  if (freshnessWeight(campaign.createdAt) >= 48) pushUniqueReason(reasons, "Fresh boost");
  if (!reasons.length) pushUniqueReason(reasons, "Live boost");

  return {
    score,
    reasons: reasons.slice(0, 3),
    creatorTrustScore,
    creatorTrustLevel,
    creatorBackerStatus,
  };
}

export function rankGarageCampaigns(
  campaigns: PublicGarageXCampaign[],
  creatorTrustByWallet: Map<string, Pick<GarageTrustProfile, "trustScore" | "trustLevel" | "backerStatus">>,
) {
  return campaigns
    .map((campaign) => {
      const creatorWallet = campaign.createdByAddress?.toLowerCase() ?? "";
      return {
        ...campaign,
        ranking: getGarageCampaignRanking(campaign, creatorTrustByWallet.get(creatorWallet)),
      };
    })
    .sort((a, b) => {
      if (b.ranking.score !== a.ranking.score) return b.ranking.score - a.ranking.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getGarageCampaignFundingPayment(campaign: Pick<
  GarageXCampaign,
  "id" | "slug" | "budgetCrc" | "fundingRequiredCrc" | "platformFeeCrc" | "createdByAddress"
>, creatorLabel = ""): GarageCampaignFundingPayment {
  const recipientAddress = getGarageCampaignFundingRecipient();
  const amountCrc = Number(campaign.fundingRequiredCrc || 0);
  const rewardPoolCrc = Number(campaign.budgetCrc || 0);
  const platformFeeCrc = Number(campaign.platformFeeCrc || 0);
  const campaignProofId = sanitizePaymentDataPart(campaign.slug, `campaign-${campaign.id}`);
  const creatorProofLabel = sanitizePaymentDataPart(
    creatorLabel,
    campaign.createdByAddress ? `wallet-${campaign.createdByAddress.slice(2, 8)}` : "creator",
  );
  const gameData = `${GARAGE_CAMPAIGN_FUNDING_GAME}:${campaignProofId}:${creatorProofLabel}`;
  return {
    campaignId: campaign.id,
    recipientAddress,
    amountCrc,
    rewardPoolCrc,
    platformFeeCrc,
    feeBps: campaignFeeBpsFromStoredAmounts(campaign),
    gameData,
    paymentLink: generateGamePaymentLink(
      recipientAddress,
      amountCrc,
      GARAGE_CAMPAIGN_FUNDING_GAME,
      campaignProofId,
      creatorProofLabel,
    ),
    qrCode: "",
  };
}

export async function getGarageCampaignFundingPaymentWithQr(campaign: Pick<
  GarageXCampaign,
  "id" | "slug" | "budgetCrc" | "fundingRequiredCrc" | "platformFeeCrc" | "createdByAddress"
>): Promise<GarageCampaignFundingPayment> {
  const creatorName = await getCirclesProfileName(campaign.createdByAddress);
  const payment = getGarageCampaignFundingPayment(campaign, creatorName ?? "");
  try {
    payment.qrCode = await QRCode.toDataURL(payment.paymentLink, { width: 300, margin: 2 });
  } catch (qrErr) {
    console.error("[garage/x/campaigns] QR generation failed:", qrErr);
  }
  return payment;
}

export function isGarageAdmin(address: string | null | undefined): boolean {
  if (!address) return false;
  const admins = (process.env.GARAGE_ADMIN_WALLETS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(address.toLowerCase());
}

export function normalizeXAction(value: unknown): GarageXAction | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return GARAGE_X_ACTIONS.includes(normalized as GarageXAction)
    ? (normalized as GarageXAction)
    : null;
}

export function parseTweetId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const direct = trimmed.match(/^\d{5,30}$/);
  if (direct) return direct[0];
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d{5,30})/i);
  return match?.[1] ?? null;
}

export function normalizeTweetUrl(value: unknown): string | null {
  const tweetId = parseTweetId(value);
  if (!tweetId) return null;
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return value.trim().replace("twitter.com", "x.com").split("?")[0];
  }
  return `https://x.com/i/web/status/${tweetId}`;
}

export function campaignToPublic(
  campaign: GarageXCampaign,
  stats: { claims: number },
  claimedByMe?: PublicGarageXCampaign["claimedByMe"],
): PublicGarageXCampaign {
  const rewardCrc = Number(campaign.rewardCrc);
  const maxClaimsByBudget = rewardCrc > 0 ? Math.floor(Number(campaign.budgetCrc) / rewardCrc) : 0;
  const hardMaxClaims = Math.max(0, Math.min(Number(campaign.maxClaims), maxClaimsByBudget));
  const claims = Math.max(0, Number(stats.claims || 0));

  return {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    description: campaign.description,
    action: normalizeXAction(campaign.action) ?? "repost",
    tweetId: campaign.tweetId,
    tweetUrl: campaign.tweetUrl,
    targetXUserId: campaign.targetXUserId,
    targetUsername: campaign.targetUsername,
    rewardCrc,
    budgetCrc: Number(campaign.budgetCrc),
    maxClaims: Number(campaign.maxClaims),
    status: campaign.status,
    createdByAddress: campaign.createdByAddress,
    fundingStatus: campaign.fundingStatus,
    fundingRequiredCrc: Number(campaign.fundingRequiredCrc || 0),
    platformFeeCrc: Number(campaign.platformFeeCrc || 0),
    fundingTxHash: campaign.fundingTxHash,
    fundedAt: campaign.fundedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    stats: {
      claims,
      remainingClaims: Math.max(0, hardMaxClaims - claims),
      spentCrc: Math.round(claims * rewardCrc * 100) / 100,
    },
    qualityReport: null,
    ranking: {
      score: 0,
      reasons: ["Live boost"],
      creatorTrustScore: null,
      creatorTrustLevel: null,
      creatorBackerStatus: null,
    },
    claimedByMe: claimedByMe ?? null,
  };
}

async function xApi<T>(url: string): Promise<T> {
  const token = getXBearerToken();
  if (!token) {
    throw new Error("X_BEARER_TOKEN_MISSING");
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : data?.title || res.statusText;
    throw new Error(`X_API_${res.status}:${detail}`);
  }
  return data as T;
}

type XUsersPage = {
  data?: Array<{ id: string; username?: string }>;
  meta?: { next_token?: string };
};

type XQuotesPage = {
  data?: Array<{ id: string; author_id?: string }>;
  meta?: { next_token?: string };
};

type XTimelinePage = {
  data?: Array<{
    id: string;
    created_at?: string;
    referenced_tweets?: Array<{ type: string; id: string }>;
  }>;
  meta?: { result_count?: number };
};

function toXDateTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function timelineMaxResults() {
  return clampInteger(Number(process.env.GARAGE_X_TIMELINE_MAX_RESULTS ?? 100), 5, 100);
}

function retweetedByFallbackPages() {
  return clampInteger(Number(process.env.GARAGE_X_RETWEETED_BY_FALLBACK_PAGES ?? 1), 0, 10);
}

function retweetedByFallbackMaxResults() {
  return clampInteger(Number(process.env.GARAGE_X_RETWEETED_BY_FALLBACK_MAX_RESULTS ?? 50), 1, 100);
}

async function findUserInPagedUsers(
  baseUrl: string,
  xUserId: string,
  maxPages = 10,
  options?: { collectUserIds?: boolean },
) {
  let nextToken: string | undefined;
  let checked = 0;
  const observedUserIds = options?.collectUserIds ? new Set<string>() : null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(baseUrl);
    if (nextToken) url.searchParams.set("pagination_token", nextToken);
    const data = await xApi<XUsersPage>(url.toString());
    const users = data.data ?? [];
    checked += users.length;
    for (const user of users) {
      if (observedUserIds && user.id) observedUserIds.add(user.id);
    }
    if (users.some((user) => user.id === xUserId)) {
      return { ok: true, checked, observedUserIds: observedUserIds ? [...observedUserIds] : undefined };
    }
    nextToken = data.meta?.next_token;
    if (!nextToken) break;
  }

  return { ok: false, checked, observedUserIds: observedUserIds ? [...observedUserIds] : undefined };
}

async function findRepostInUserTimeline(tweetId: string, xUserId: string, startTime?: Date | null) {
  const url = new URL(`https://api.x.com/2/users/${xUserId}/tweets`);
  url.searchParams.set("max_results", String(timelineMaxResults()));
  url.searchParams.set("tweet.fields", "referenced_tweets,created_at");
  if (startTime) {
    url.searchParams.set("start_time", toXDateTime(startTime));
  }

  const data = await xApi<XTimelinePage>(url.toString());
  const posts = data.data ?? [];
  const ok = posts.some((post) =>
    post.referenced_tweets?.some((reference) => reference.type === "retweeted" && reference.id === tweetId),
  );

  return { ok, checked: posts.length };
}

async function findRepostByRetweetedUsers(tweetId: string, xUserId: string) {
  const pages = retweetedByFallbackPages();
  if (pages <= 0) return { ok: false, checked: 0, observedUserIds: undefined };

  const baseUrl = `https://api.x.com/2/tweets/${tweetId}/retweeted_by?max_results=${retweetedByFallbackMaxResults()}`;
  return findUserInPagedUsers(baseUrl, xUserId, pages, { collectUserIds: true });
}

async function findQuoteByAuthor(tweetId: string, xUserId: string, maxPages = 10) {
  let nextToken: string | undefined;
  let checked = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://api.x.com/2/tweets/${tweetId}/quote_tweets`);
    url.searchParams.set("tweet.fields", "author_id,created_at");
    url.searchParams.set("max_results", "100");
    if (nextToken) url.searchParams.set("pagination_token", nextToken);

    const data = await xApi<XQuotesPage>(url.toString());
    const quotes = data.data ?? [];
    checked += quotes.length;
    if (quotes.some((tweet) => tweet.author_id === xUserId)) {
      return { ok: true, checked };
    }
    nextToken = data.meta?.next_token;
    if (!nextToken) break;
  }

  return { ok: false, checked };
}

export async function verifyGarageXAction(params: {
  action: GarageXAction;
  tweetId: string | null;
  targetXUserId: string | null;
  xUserId: string;
  startedAt?: Date | null;
  allowRetweetedByFallback?: boolean;
}): Promise<GarageXVerificationResult> {
  if (params.action !== "follow" && !params.tweetId) {
    return { ok: false, checked: 0, evidence: "missing_tweet_id" };
  }

  if (params.action === "like") {
    const baseUrl = `https://api.x.com/2/tweets/${params.tweetId}/liking_users?max_results=100`;
    const result = await findUserInPagedUsers(baseUrl, params.xUserId);
    return { ...result, evidence: "liking_users" };
  }

  if (params.action === "repost") {
    const timelineResult = await findRepostInUserTimeline(params.tweetId!, params.xUserId, params.startedAt);
    if (timelineResult.ok) {
      return { ...timelineResult, evidence: "user_timeline_repost" };
    }

    if (!params.allowRetweetedByFallback) {
      return { ...timelineResult, evidence: "user_timeline_repost" };
    }

    const retweetedByResult = await findRepostByRetweetedUsers(params.tweetId!, params.xUserId);
    return {
      ok: retweetedByResult.ok,
      checked: timelineResult.checked + retweetedByResult.checked,
      evidence: retweetedByResult.ok ? "retweeted_by_fallback" : "user_timeline_repost+retweeted_by",
      observedUserIds: retweetedByResult.observedUserIds,
    };
  }

  if (params.action === "quote") {
    const result = await findQuoteByAuthor(params.tweetId!, params.xUserId);
    return { ...result, evidence: "quote_tweets" };
  }

  if (params.action === "follow") {
    if (!params.targetXUserId) {
      return { ok: false, checked: 0, evidence: "missing_target_x_user_id" };
    }
    const baseUrl = `https://api.x.com/2/users/${params.targetXUserId}/followers?max_results=1000`;
    const result = await findUserInPagedUsers(baseUrl, params.xUserId, 5);
    return { ...result, evidence: "followers" };
  }

  return { ok: false, checked: 0, evidence: "unsupported_action" };
}
