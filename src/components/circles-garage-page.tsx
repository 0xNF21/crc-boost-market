"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Info,
  LogOut,
  MousePointerClick,
  Loader2,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  Repeat2,
  SearchCheck,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  Wallet,
} from "lucide-react";
import { useAuthSession } from "@/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-provider";
import { useMiniApp } from "@/components/miniapp-provider";
import { clientAuthHeaders } from "@/lib/client-auth-token";
import { GARAGE_CREATOR_FEE_GRID, getGarageClaimSettlementTier, getGarageCreatorFeeTier } from "@/lib/garage-fees";
import { GARAGE_REFERRAL_MIN_REWARD_CRC, GARAGE_REFERRAL_QUALITY_GRID } from "@/lib/garage-referral-quality";

type LinkedXAccount = {
  xUserId: string;
  username: string;
  displayName: string | null;
  updatedAt: string;
};

type CirclesProfile = {
  name?: string;
  imageUrl?: string | null;
};

type GarageTrustSummary = {
  trustScore: number | null;
  trustLevel: string | null;
  mutualCount: number;
  backerStatus: GarageBackerStatus;
  directBacker: boolean;
  indirectBackerTrustCount: number;
  lastFetchedAt: string | null;
};

type GarageLeaderboardEntry = {
  walletAddress: string;
  xUsername: string | null;
  actions: number;
  crcEarned: number;
  crcPending: number;
  xReads: number;
  lastClaimAt: string | null;
  trustProfile: GarageTrustSummary | null;
};

type GarageBackerStatus = "direct" | "indirect" | "none" | "unknown";

type GarageTrustProfile = {
  walletAddress: string;
  trustScore: number | null;
  trustLevel: string | null;
  confidence: number | null;
  computedAt: string | null;
  inDegree: number;
  outDegree: number;
  mutualCount: number;
  ageDays: number;
  backerStatus: GarageBackerStatus;
  directBacker: boolean;
  indirectBackerTrustCount: number;
  indirectBackerAddresses: string[];
  source: string;
  errorMessage: string | null;
  lastFetchedAt: string;
  expiresAt: string;
  stale: boolean;
};

type GarageXStatus = {
  wallet: string | null;
  isAdmin: boolean;
  xOAuthConfigured: boolean;
  xApiConfigured: boolean;
  linkedAccount: LinkedXAccount | null;
  recentClaims: Array<{
    id: number;
    campaignId: number;
    campaignTitle: string;
    campaignRewardCrc: number;
    campaignTweetUrl: string | null;
    action: string;
    status: string;
    verificationEvidence: string | null;
    verificationChecked: number;
    payoutAvailableAt: string | null;
    payoutStatus: string | null;
    payoutTxHash: string | null;
    createdAt: string;
  }>;
  global: {
    claims: number;
    wallets: number;
    xAccounts: number;
    crcPaid: number;
    xReads: number;
    activeCampaigns: number;
  };
  personal: {
    verifiedActions: number;
    crcEarned: number;
    crcPending: number;
    pendingSettlements: number;
    xReads: number;
  };
  leaderboard: GarageLeaderboardEntry[];
  recentPayouts: Array<{
    id: number;
    walletAddress: string;
    xUsername: string | null;
    campaignId: number;
    campaignTitle: string;
    campaignRewardCrc: number;
    action: string;
    status: string;
    payoutStatus: string | null;
    payoutTxHash: string | null;
    paidAt: string;
  }>;
  settings: {
    payoutDelaySeconds: number;
    campaignFeeBps: number;
  };
  unavailable?: boolean;
};

type GarageReferralStatus = {
  cycle: string;
  authenticated: boolean;
  address: string | null;
  statsAddress: string | null;
  readOnly: boolean;
  milestones: Array<{ threshold: number; amountCrc: number }>;
  qualityMultipliers: ReadonlyArray<{
    status: GarageBackerStatus;
    label: string;
    multipliers: {
      high: number;
      medium: number;
      low: number;
    };
  }>;
  minRewardCrc: number;
  global: {
    total: number;
    referrers: number;
    wallets: number;
  };
  mine: {
    total: number;
  };
  rewards: {
    crcEarned: number;
    claimableCrc: number;
    pendingCrc: number;
    activatedWallets: number;
  };
  recent: Array<{
    id: number;
    referrerAddress: string;
    referredAddress: string;
    createdAt: string;
  }>;
  activity: GarageReferralActivity[];
  unavailable?: boolean;
};

type GarageRecentPayout = GarageXStatus["recentPayouts"][number];

type GarageReferralActivity = {
  id: number;
  referredAddress: string;
  createdAt: string;
  missions: number;
  xReads: number;
  lastMissionAt: string | null;
  trustScore: number | null;
  trustLevel: string | null;
  mutualCount: number;
  backerStatus: GarageBackerStatus;
  qualityMultiplier: number;
  claimableCrc: number;
  claimedCrc: number;
  pendingCrc: number;
  totalCrc: number;
  unlockedMilestones: number;
  highestMilestone: number;
  status: "invited" | "missions_detected" | "claimable" | "claiming" | "claimed";
};

type GarageXCampaign = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  action: "like" | "repost" | "quote" | "follow";
  tweetId: string | null;
  tweetUrl: string | null;
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
  ranking?: {
    score: number;
    reasons: string[];
    creatorTrustScore: number | null;
    creatorTrustLevel: string | null;
    creatorBackerStatus: string | null;
  };
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

type GarageCampaignQualityReport = {
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

type GarageCampaignFundingPayment = {
  campaignId: number;
  recipientAddress: string;
  amountCrc: number;
  rewardPoolCrc: number;
  platformFeeCrc: number;
  feeBps: number;
  gameData: string;
  paymentLink: string;
  qrCode?: string | null;
};

const EMPTY_STATUS: GarageXStatus = {
  wallet: null,
  isAdmin: false,
  xOAuthConfigured: false,
  xApiConfigured: false,
  linkedAccount: null,
  recentClaims: [],
  global: { claims: 0, wallets: 0, xAccounts: 0, crcPaid: 0, xReads: 0, activeCampaigns: 0 },
  personal: { verifiedActions: 0, crcEarned: 0, crcPending: 0, pendingSettlements: 0, xReads: 0 },
  leaderboard: [],
  recentPayouts: [],
  settings: { payoutDelaySeconds: 300, campaignFeeBps: 250 },
};

const EMPTY_REFERRALS: GarageReferralStatus = {
  cycle: "cycle-01",
  authenticated: false,
  address: null,
  statsAddress: null,
  readOnly: false,
  milestones: [
    { threshold: 1, amountCrc: 0.2 },
    { threshold: 3, amountCrc: 0.5 },
    { threshold: 5, amountCrc: 1 },
  ],
  qualityMultipliers: GARAGE_REFERRAL_QUALITY_GRID,
  minRewardCrc: GARAGE_REFERRAL_MIN_REWARD_CRC,
  global: { total: 0, referrers: 0, wallets: 0 },
  mine: { total: 0 },
  rewards: { crcEarned: 0, claimableCrc: 0, pendingCrc: 0, activatedWallets: 0 },
  recent: [],
  activity: [],
};

const X_CONNECT_START_URL = "/api/garage/x/connect/start?returnTo=%2Fgarage";

function isAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && /^0x[a-f0-9]{40}$/.test(value.toLowerCase());
}

const ACTION_LABELS: Record<GarageXCampaign["action"], string> = {
  like: "Like",
  repost: "Repost",
  quote: "Quote",
  follow: "Follow",
};

function shortAddress(address: string | null | undefined) {
  if (!address) return "Connect";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercentFromBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0%";
  return `${formatNumber(value / 100)}%`;
}

function formatMultiplier(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "1x";
  return `${formatNumber(value)}x`;
}

function formatPercentValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Pending";
  return `${formatNumber(value)}%`;
}

function formatTrustValue(score: number | null | undefined, level: string | null | undefined) {
  if (score == null || !Number.isFinite(score)) return null;
  return level ? `${score} / ${level}` : String(score);
}

function normalizedBackerStatus(value: string | null | undefined): GarageBackerStatus {
  return value === "direct" || value === "indirect" || value === "none" ? value : "unknown";
}

function referralActivityLabel(status: GarageReferralActivity["status"]) {
  if (status === "claimable") return "Claimable";
  if (status === "claiming") return "Claiming";
  if (status === "claimed") return "Claimed";
  if (status === "missions_detected") return "Tracked";
  return "Waiting";
}

type MetricPillTone = "neutral" | "muted" | "success" | "marine" | "citrus";

function metricPillTone(tone: MetricPillTone) {
  if (tone === "success") return "border-emerald-500/18 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tone === "marine") return "border-marine/16 bg-marine/8 text-marine dark:border-sky-300/16 dark:bg-sky-300/10 dark:text-sky-300";
  if (tone === "citrus") return "border-citrus/18 bg-citrus/10 text-citrus";
  if (tone === "muted") return "border-ink/10 bg-[#f3eee7] text-ink/48 dark:border-white/10 dark:bg-white/8 dark:text-white/52";
  return "border-ink/10 bg-[#f3eee7] text-ink/65 dark:border-white/10 dark:bg-white/8 dark:text-white/68";
}

function referralMetricTone(status: GarageReferralActivity["status"]): MetricPillTone {
  if (status === "claimable") return "success";
  if (status === "claiming") return "marine";
  if (status === "missions_detected") return "citrus";
  return status === "claimed" ? "neutral" : "muted";
}

function MetricPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: MetricPillTone;
}) {
  return (
    <span
      className={`inline-flex h-10 max-w-full shrink-0 items-center justify-center rounded-full border px-3 text-[10px] font-black uppercase leading-none tracking-[0.02em] ${metricPillTone(tone)}`}
    >
      <span className="truncate whitespace-nowrap">{children}</span>
    </span>
  );
}

function roundCrc(value: number) {
  return Math.round(value * 100) / 100;
}

function parseXPostInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^\d{5,30}$/);
  if (direct) {
    return {
      id: direct[0],
      username: null,
      url: `https://x.com/i/web/status/${direct[0]}`,
    };
  }

  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^/?#]+)\/status\/(\d{5,30})/i);
  if (!match) return null;
  return {
    id: match[2],
    username: match[1] === "i" ? null : match[1],
    url: `https://x.com/${match[1]}/status/${match[2]}`,
  };
}

function campaignFundingPreview(params: { rewardCrc: string; maxClaims: string; feeBps: number }) {
  const rewardCrc = Number(params.rewardCrc);
  const maxClaims = Math.floor(Number(params.maxClaims));
  if (!Number.isFinite(rewardCrc) || !Number.isFinite(maxClaims) || rewardCrc <= 0 || maxClaims <= 0) {
    return { rewardPoolCrc: 0, platformFeeCrc: 0, totalCrc: 0 };
  }
  const rewardPoolCrc = roundCrc(rewardCrc * maxClaims);
  const platformFeeCrc = roundCrc((rewardPoolCrc * params.feeBps) / 10_000);
  return {
    rewardPoolCrc,
    platformFeeCrc,
    totalCrc: roundCrc(rewardPoolCrc + platformFeeCrc),
  };
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDurationShort(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "instant";
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
}

function shortHash(hash: string | null | undefined) {
  if (!hash) return null;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function evidenceLabel(value: string | null | undefined): string {
  if (!value) return "Verified";
  if (value.startsWith("cache_")) return `Cached ${evidenceLabel(value.slice("cache_".length)).toLowerCase()}`;
  if (value === "user_timeline_repost") return "User timeline repost";
  if (value === "retweeted_by_fallback") return "Retweeter scan";
  if (value === "user_timeline_repost+retweeted_by") return "Timeline + retweeter scan";
  if (value === "retweeted_by") return "Retweeter scan";
  if (value === "quote_tweets") return "Quote lookup";
  if (value === "liking_users") return "Like lookup";
  if (value === "followers") return "Follower lookup";
  return value.replace(/_/g, " ");
}

function claimTone(status: string | null | undefined) {
  if (!status) return "bg-ink/5 text-ink/55 dark:bg-white/10 dark:text-white/55";
  if (status === "paid" || status === "success" || status === "completed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "verified_pending") return "bg-marine/10 text-marine dark:text-sky-300";
  if (status.includes("failed")) return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-citrus/10 text-citrus";
}

function claimCanTrigger(claim: GarageXCampaign["claimedByMe"]) {
  if (!claim) return true;
  if (claim.status === "verification_expired" || claim.status === "payout_failed") return true;
  if (claim.status !== "verified_pending") return false;
  if (!claim.payoutAvailableAt) return true;
  return new Date(claim.payoutAvailableAt).getTime() <= Date.now();
}

function claimTimeRemaining(claim: GarageXCampaign["claimedByMe"], now: number) {
  if (!claim || claim.status !== "verified_pending" || !claim.payoutAvailableAt) return 0;
  return Math.max(0, new Date(claim.payoutAvailableAt).getTime() - now);
}

function claimStatusLabel(status: string) {
  if (status === "verified_pending") return "settlement pending";
  if (status === "verification_expired") return "re-check failed";
  if (status === "payout_sending") return "sending CRC";
  return status.replace(/_/g, " ");
}

const BACKER_STATUS_LABELS: Record<GarageBackerStatus, string> = {
  direct: "Direct backer",
  indirect: "Indirect backer",
  none: "No backer link",
  unknown: "Unknown",
};

function backerStatusTone(status: GarageBackerStatus) {
  const sharedBackerTone =
    "border border-citrus/18 bg-[#f3eee7] dark:border-citrus/20 dark:bg-white/8";
  if (status === "direct") return `${sharedBackerTone} text-emerald-700 dark:text-emerald-300`;
  if (status === "indirect") return `${sharedBackerTone} text-marine dark:text-sky-300`;
  if (status === "none") return "border border-citrus/16 bg-citrus/10 text-citrus";
  return "border border-ink/10 bg-ink/8 text-ink/55 dark:border-white/10 dark:bg-white/10 dark:text-white/60";
}

function backerStatusIconSrc(status: GarageBackerStatus) {
  if (status === "direct") return "/garage/badges/backer.svg";
  if (status === "indirect") return "/garage/badges/indirect-backer.svg";
  return null;
}

function BackerStatusBadge({
  status,
  size = "prominent",
}: {
  status: GarageBackerStatus;
  size?: "compact" | "prominent";
}) {
  const iconSrc = backerStatusIconSrc(status);
  const imageSize = size === "prominent" ? 40 : 28;
  const imageBoxClass = size === "prominent" ? "h-10 w-10" : "h-7 w-7";
  const imageScaleClass = status === "indirect" ? "scale-[0.74]" : "scale-100";
  const labelSizeClass = size === "prominent" ? "text-xs" : "text-[10px] tracking-[0.02em]";
  const badgeSizeClass =
    size === "prominent"
      ? "min-h-12 min-w-[190px] px-3 py-1.5"
      : "h-10 min-w-[168px] px-2.5 py-0";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-start gap-2 rounded-full font-black uppercase leading-none ${badgeSizeClass} ${backerStatusTone(status)}`}
    >
      {iconSrc ? (
        <span className={`inline-flex shrink-0 items-center justify-center ${imageBoxClass}`}>
          <Image
            src={iconSrc}
            alt=""
            width={imageSize}
            height={imageSize}
            aria-hidden="true"
            className={`h-full w-full object-contain ${imageScaleClass}`}
          />
        </span>
      ) : null}
      <span className={`whitespace-nowrap ${labelSizeClass}`}>{BACKER_STATUS_LABELS[status]}</span>
    </span>
  );
}

function trustScoreValue(profile: GarageTrustProfile | null) {
  if (!profile || profile.trustScore === null) return "Not found";
  return profile.trustLevel ? `${profile.trustScore} / ${profile.trustLevel}` : String(profile.trustScore);
}

function trustSummaryValue(profile: GarageTrustSummary | null | undefined) {
  if (!profile || profile.trustScore === null) return null;
  return profile.trustLevel ? `${profile.trustScore} / ${profile.trustLevel}` : String(profile.trustScore);
}

function campaignButtonLabel(campaign: GarageXCampaign, verifying: boolean, unavailable: boolean) {
  if (verifying) return "Verifying";
  if (unavailable || campaign.id <= 0) return "Apply migration first";
  if (campaign.claimedByMe) {
    if (campaign.claimedByMe.status === "verified_pending") {
      return claimCanTrigger(campaign.claimedByMe) ? "Re-check + send CRC" : "Settlement pending";
    }
    if (campaign.claimedByMe.status === "verification_expired") return "Verify again";
    if (campaign.claimedByMe.status === "payout_failed") return "Retry payout";
    if (campaign.claimedByMe.status === "paid") return "Claimed";
    if (campaign.claimedByMe.status === "payout_sending") return "Sending CRC";
    return "Claim recorded";
  }
  if (campaign.stats.remainingClaims <= 0) return "Budget spent";
  return `Verify + claim ${formatNumber(campaign.rewardCrc)} CRC`;
}

type NoticeTone = "success" | "error";
type GarageSection = "boosts" | "leaderboard" | "profile" | "creator";
type CampaignFeedback = {
  campaignId: number;
  tone: NoticeTone;
  message: string;
  txHash?: string | null;
};
type FundingFeedback = CampaignFeedback;
type FundingSentState = Record<number, string | null>;

function campaignOpenKey(campaignId: number) {
  return `nfs-garage-x-opened-at:${campaignId}`;
}

function campaignVerifyMissKey(campaignId: number) {
  return `nfs-garage-x-verify-misses:${campaignId}`;
}

function fundingSentKey(campaignId: number) {
  return `nfs-garage-funding-sent:${campaignId}`;
}

function hasFundingSent(sent: FundingSentState, campaignId: number) {
  return Object.prototype.hasOwnProperty.call(sent, campaignId);
}

function referralCodeFromProfileName(name: string | null | undefined): string {
  return (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function creatorProfilePath(address: string | null | undefined, profile?: CirclesProfile | null) {
  if (!isAddress(address)) return null;
  const profileCode = referralCodeFromProfileName(profile?.name);
  return `/garage/creator/${encodeURIComponent(profileCode || address.toLowerCase())}`;
}

export default function CirclesGaragePage() {
  const { isAuthenticated, address, loading, refresh, logout, openLogin } = useAuthSession();
  const { isMiniApp, walletAddress: miniAppWalletAddress, sendPayment } = useMiniApp();
  const [status, setStatus] = useState<GarageXStatus>(EMPTY_STATUS);
  const [referrals, setReferrals] = useState<GarageReferralStatus>(EMPTY_REFERRALS);
  const [trustProfile, setTrustProfile] = useState<GarageTrustProfile | null>(null);
  const [campaigns, setCampaigns] = useState<GarageXCampaign[]>([]);
  const [campaignsUnavailable, setCampaignsUnavailable] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [trustRefreshing, setTrustRefreshing] = useState(false);
  const [referralClaiming, setReferralClaiming] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [fundingPayment, setFundingPayment] = useState<GarageCampaignFundingPayment | null>(null);
  const [fundingAction, setFundingAction] = useState<"pay" | "scan" | "cancel" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("error");
  const [noticeTxHash, setNoticeTxHash] = useState<string | null>(null);
  const [campaignFeedback, setCampaignFeedback] = useState<CampaignFeedback | null>(null);
  const [fundingFeedback, setFundingFeedback] = useState<FundingFeedback | null>(null);
  const [fundingSentTxs, setFundingSentTxs] = useState<FundingSentState>({});
  const [copied, setCopied] = useState(false);
  const [visibleXLinkCampaignId, setVisibleXLinkCampaignId] = useState<number | null>(null);
  const [xAuthUrl, setXAuthUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [garageSection, setGarageSection] = useState<GarageSection>("boosts");
  const [marketStatusOpen, setMarketStatusOpen] = useState(false);
  const [profileReferralOpen, setProfileReferralOpen] = useState(false);
  const [creatorFormOpen, setCreatorFormOpen] = useState(true);
  const [campaignCreatorProfiles, setCampaignCreatorProfiles] = useState<Record<string, CirclesProfile>>({});
  const [leaderboardProfiles, setLeaderboardProfiles] = useState<Record<string, CirclesProfile>>({});
  const [recentPayoutProfiles, setRecentPayoutProfiles] = useState<Record<string, CirclesProfile>>({});
  const [referralProfiles, setReferralProfiles] = useState<Record<string, CirclesProfile>>({});
  const [myProfile, setMyProfile] = useState<CirclesProfile | null>(null);
  const [landingReferrer, setLandingReferrer] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [createForm, setCreateForm] = useState({
    title: "",
    tweetUrl: "",
    action: "repost" as GarageXCampaign["action"],
    rewardCrc: "1",
    budgetCrc: "25",
    maxClaims: "25",
    description: "",
  });
  const profileAddress = address ?? (isMiniApp ? miniAppWalletAddress : null);
  const latestPayout = status.recentPayouts[0] ?? null;
  const latestPayoutProfile = latestPayout
    ? recentPayoutProfiles[latestPayout.walletAddress.toLowerCase()]
    : undefined;

  const inviteLink = useMemo(() => {
    if (!origin) return "";
    if (!profileAddress) return `${origin}/garage`;
    const profileCode = referralCodeFromProfileName(myProfile?.name);
    const refCode = profileCode || profileAddress.toLowerCase();
    return `${origin}/garage?ref=${encodeURIComponent(refCode)}`;
  }, [myProfile?.name, origin, profileAddress]);
  const creatorProfileHref = useMemo(() => {
    if (!profileAddress) return null;
    const profileCode = referralCodeFromProfileName(myProfile?.name);
    return `/garage/creator/${encodeURIComponent(profileCode || profileAddress.toLowerCase())}`;
  }, [myProfile?.name, profileAddress]);
  const referralStatsForProfile =
    Boolean(profileAddress) && referrals.statsAddress?.toLowerCase() === profileAddress?.toLowerCase();

  const creatorFeeTier = useMemo(
    () => getGarageCreatorFeeTier(trustProfile, status.settings.campaignFeeBps),
    [status.settings.campaignFeeBps, trustProfile],
  );
  const claimSettlementTier = useMemo(
    () => getGarageClaimSettlementTier(trustProfile, status.settings.payoutDelaySeconds),
    [status.settings.payoutDelaySeconds, trustProfile],
  );

  const createCost = useMemo(
    () =>
      campaignFundingPreview({
        rewardCrc: createForm.rewardCrc,
        maxClaims: createForm.maxClaims,
        feeBps: creatorFeeTier.feeBps,
      }),
    [createForm.maxClaims, createForm.rewardCrc, creatorFeeTier.feeBps],
  );

  const createTweet = useMemo(() => parseXPostInput(createForm.tweetUrl), [createForm.tweetUrl]);
  const createTitle = createForm.title.trim();
  const createDescription = createForm.description.trim();
  const createRewardCrc = Number(createForm.rewardCrc);
  const createMaxClaims = Math.floor(Number(createForm.maxClaims));
  const createBudgetValid =
    Number.isFinite(createRewardCrc) &&
    createRewardCrc >= 0.01 &&
    createRewardCrc <= 100 &&
    Number.isFinite(createMaxClaims) &&
    createMaxClaims > 0 &&
    createMaxClaims <= 10_000;
  const createIssue = !createTitle
    ? "Add a campaign title"
    : !createTweet
      ? "Paste a valid X post URL"
      : !createBudgetValid
        ? "Use 0.01-100 CRC and at least 1 payout"
        : createCost.totalCrc <= 0
          ? "Enter reward and max payouts"
          : null;
  const createReady = !createIssue;

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const referralsUrl = profileAddress
        ? `/api/garage/referrals?address=${encodeURIComponent(profileAddress.toLowerCase())}`
        : "/api/garage/referrals";
      const [statusResult, campaignsResult, referralsResult, trustResult] = await Promise.allSettled([
        fetch("/api/garage/x/status", { cache: "no-store", credentials: "include", headers: clientAuthHeaders() }),
        fetch("/api/garage/x/campaigns", { cache: "no-store", credentials: "include", headers: clientAuthHeaders() }),
        fetch(referralsUrl, { cache: "no-store", credentials: "include", headers: clientAuthHeaders() }),
        fetch("/api/garage/trust/status", { cache: "no-store", credentials: "include", headers: clientAuthHeaders() }),
      ]);

      const statusRes = statusResult.status === "fulfilled" ? statusResult.value : null;
      const campaignsRes = campaignsResult.status === "fulfilled" ? campaignsResult.value : null;
      const referralsRes = referralsResult.status === "fulfilled" ? referralsResult.value : null;
      const trustRes = trustResult.status === "fulfilled" ? trustResult.value : null;

      const statusData = statusRes?.ok ? await statusRes.json().catch(() => null) : null;
      const campaignsData = campaignsRes?.ok ? await campaignsRes.json().catch(() => null) : null;
      const referralsData = referralsRes?.ok ? await referralsRes.json().catch(() => null) : null;
      const trustData = trustRes?.ok ? await trustRes.json().catch(() => ({})) : {};
      const visibleCampaigns = Array.isArray(campaignsData?.campaigns) ? campaignsData.campaigns : [];
      setStatus(statusRes?.ok ? { ...EMPTY_STATUS, ...statusData } : { ...EMPTY_STATUS, unavailable: true });
      setReferrals(
        referralsRes?.ok
          ? { ...EMPTY_REFERRALS, ...referralsData }
          : { ...EMPTY_REFERRALS, unavailable: true },
      );
      setTrustProfile(trustData?.trustProfile ?? null);
      setCampaigns(visibleCampaigns);
      const pendingPayment = visibleCampaigns.find(
        (campaign: GarageXCampaign) => campaign.status === "pending_payment" && campaign.fundingPayment,
      )?.fundingPayment ?? null;
      setFundingPayment((current) =>
        current && visibleCampaigns.some((campaign: GarageXCampaign) =>
          campaign.id === current.campaignId && campaign.status === "pending_payment",
        )
          ? current
          : pendingPayment,
      );
      setCampaignsUnavailable(Boolean(campaignsData?.unavailable));
    } catch {
      setStatus(EMPTY_STATUS);
      setReferrals(EMPTY_REFERRALS);
      setTrustProfile(null);
      setCampaigns([]);
      setFundingPayment(null);
      setCampaignsUnavailable(true);
    } finally {
      setLoadingData(false);
    }
  }, [profileAddress]);

  const syncGarage = useCallback(async () => {
    if (!loading && profileAddress && !isAuthenticated) {
      openLogin();
      return;
    }

    await refresh();
    await loadData();
  }, [isAuthenticated, loadData, loading, openLogin, profileAddress, refresh]);

  const disconnectWallet = useCallback(async () => {
    await logout();
    setNoticeTone("success");
    setNoticeTxHash(null);
    setNotice("Wallet session disconnected.");
    await loadData();
  }, [loadData, logout]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadData();
  }, [loadData, isAuthenticated, address]);

  useEffect(() => {
    let cancelled = false;

    async function loadXAuthUrl() {
      if (!isMiniApp || !isAuthenticated || status.linkedAccount) {
        setXAuthUrl(null);
        return;
      }

      try {
        const res = await fetch(`${X_CONNECT_START_URL}&format=json&returnAfterAuth=playground`, {
          cache: "no-store",
          credentials: "include",
          headers: clientAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setXAuthUrl(typeof data?.authUrl === "string" ? data.authUrl : null);
        }
      } catch {
        if (!cancelled) setXAuthUrl(null);
      }
    }

    void loadXAuthUrl();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isMiniApp, status.linkedAccount]);

  useEffect(() => {
    const next: FundingSentState = {};
    for (const campaign of campaigns) {
      if (campaign.status !== "pending_payment") {
        try {
          window.localStorage.removeItem(fundingSentKey(campaign.id));
        } catch {}
        continue;
      }

      try {
        const stored = window.localStorage.getItem(fundingSentKey(campaign.id));
        if (stored) next[campaign.id] = stored === "sent" ? null : stored;
      } catch {}
    }
    setFundingSentTxs((current) => ({ ...next, ...current }));
  }, [campaigns]);

  useEffect(() => {
    if (!profileAddress) {
      setMyProfile(null);
      return;
    }

    let cancelled = false;
    const normalized = profileAddress.toLowerCase();
    void fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: [normalized] }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setMyProfile(data?.profiles?.[normalized] ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [profileAddress]);

  useEffect(() => {
    const addresses = Array.from(
      new Set(status.leaderboard.map((entry) => entry.walletAddress.toLowerCase()).filter(isAddress)),
    );

    if (!addresses.length) {
      setLeaderboardProfiles({});
      return;
    }

    let cancelled = false;
    void fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setLeaderboardProfiles(data?.profiles ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) setLeaderboardProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [status.leaderboard]);

  useEffect(() => {
    const addresses = Array.from(
      new Set(status.recentPayouts.map((payout) => payout.walletAddress.toLowerCase()).filter(isAddress)),
    );

    if (!addresses.length) {
      setRecentPayoutProfiles({});
      return;
    }

    let cancelled = false;
    void fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setRecentPayoutProfiles(data?.profiles ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) setRecentPayoutProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [status.recentPayouts]);

  useEffect(() => {
    const addresses = Array.from(
      new Set(
        campaigns
          .map((campaign) => campaign.createdByAddress?.toLowerCase())
          .filter(isAddress),
      ),
    );

    if (!addresses.length) {
      setCampaignCreatorProfiles({});
      return;
    }

    let cancelled = false;
    void fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setCampaignCreatorProfiles(data?.profiles ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) setCampaignCreatorProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [campaigns]);

  useEffect(() => {
    const addresses = Array.from(
      new Set(referrals.activity.map((entry) => entry.referredAddress.toLowerCase()).filter(isAddress)),
    );

    if (!addresses.length) {
      setReferralProfiles({});
      return;
    }

    let cancelled = false;
    void fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setReferralProfiles(data?.profiles ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) setReferralProfiles({});
      });

    return () => {
      cancelled = true;
    };
  }, [referrals.activity]);

  useEffect(() => {
    const rawRef = new URLSearchParams(window.location.search).get("ref")?.trim() ?? "";
    const refCode = rawRef.toLowerCase();
    if (!refCode) return;

    if (isAddress(refCode)) {
      window.localStorage.setItem("nfs-garage-referrer", refCode);
      setLandingReferrer(refCode);
      return;
    }

    const normalizedCode = referralCodeFromProfileName(refCode);
    if (normalizedCode.length < 2) return;

    let cancelled = false;
    void fetch(`/api/profiles/search?q=${encodeURIComponent(normalizedCode)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data?.results) ? data.results : [];
        const match = results.find(
          (profile: { name?: string; address?: string }) =>
            referralCodeFromProfileName(profile.name) === normalizedCode && isAddress(profile.address ?? null),
        );
        const referrer = match?.address?.toLowerCase() ?? null;
        if (!isAddress(referrer)) return;
        window.localStorage.setItem("nfs-garage-referrer", referrer);
        setLandingReferrer(referrer);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !address) return;
    const referredAddress = address.toLowerCase();
    const referrer = landingReferrer ?? window.localStorage.getItem("nfs-garage-referrer")?.toLowerCase() ?? null;
    if (!isAddress(referrer) || referrer === referredAddress) return;

    const recordedKey = `nfs-garage-referral-recorded:${referredAddress}:${referrer}`;
    if (window.localStorage.getItem(recordedKey)) return;

    void fetch("/api/garage/referrals", {
      method: "POST",
      credentials: "include",
      headers: clientAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        referrer,
        landingPath: `${window.location.pathname}${window.location.search}`,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "referral_record_failed");
        }
        const status = typeof data?.status === "string" ? data.status : "";
        if (!["recorded", "already_recorded", "self_referral"].includes(status)) {
          throw new Error("referral_record_failed");
        }
        window.localStorage.setItem(recordedKey, "1");
        void loadData();
      })
      .catch(() => {});
  }, [isAuthenticated, address, landingReferrer, loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xStatus = params.get("x");
    if (!xStatus) return;
    const messages: Record<string, string> = {
      linked: "X account linked.",
      "oauth-missing": "X OAuth is not configured yet.",
      "oauth-failed": "X connection failed.",
      "oauth-client-missing": "X OAuth Client ID is missing.",
      "oauth-client-secret-invalid": "X OAuth Client Secret is invalid or incomplete.",
      "oauth-code-expired": "X authorization expired. Try again.",
      "oauth-profile-failed": "X connected, but profile fetch failed.",
      "oauth-redirect-mismatch": "X callback URL does not match the app settings.",
      "oauth-save-failed": "X connected, but saving the account failed.",
      "oauth-token-failed": "X token exchange failed.",
      "wallet-session-lost": "Wallet session was lost during X connection.",
      "x-already-linked": "This X account is already linked to another wallet.",
    };
    setNoticeTone(xStatus === "linked" ? "success" : "error");
    setNoticeTxHash(null);
    setNotice(messages[xStatus] ?? xStatus.replace(/-/g, " "));
  }, []);

  async function copyText(value: string) {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  async function copyInviteLink() {
    const didCopy = await copyText(inviteLink);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopied(false);
    }
  }

  async function claimReferralBalance() {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    setReferralClaiming(true);
    setNotice(null);
    setNoticeTxHash(null);
    try {
      const res = await fetch("/api/garage/referrals/claim", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: clientAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.claimed) {
        setNoticeTone("error");
        setNoticeTxHash(null);
        setNotice(data?.status === "nothing_claimable" ? "No referral CRC claimable yet." : data?.error ?? "Referral claim failed.");
        await loadData();
        return;
      }

      setNoticeTone("success");
      setNoticeTxHash(typeof data?.txHash === "string" ? data.txHash : null);
      setNotice(`Referral CRC claim started for ${formatNumber(Number(data.amountCrc ?? 0))} CRC.`);
      await loadData();
    } catch {
      setNoticeTone("error");
      setNoticeTxHash(null);
      setNotice("Referral claim failed.");
    } finally {
      setReferralClaiming(false);
    }
  }

  async function refreshTrustProfile() {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    setTrustRefreshing(true);
    try {
      const res = await fetch("/api/garage/trust/status?refresh=1", {
        cache: "no-store",
        credentials: "include",
        headers: clientAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      setTrustProfile(data?.trustProfile ?? null);
      setNoticeTone(data?.trustProfile ? "success" : "error");
      setNoticeTxHash(null);
      setNotice(data?.trustProfile ? "Circles trust status refreshed." : "Circles trust status unavailable.");
    } catch {
      setNoticeTone("error");
      setNoticeTxHash(null);
      setNotice("Circles trust status unavailable.");
    } finally {
      setTrustRefreshing(false);
    }
  }

  async function showMiniAppXLoginHint() {
    const xLoginUrl = xAuthUrl || (origin ? `${origin}${X_CONNECT_START_URL}` : X_CONNECT_START_URL);
    const didCopy = await copyText(xLoginUrl);
    setNoticeTone("success");
    setNoticeTxHash(null);
    setNotice(
      xAuthUrl
        ? didCopy
          ? "X login link copied. Playground: desktop Ctrl/Cmd-click Link X, or mobile long-press it and open outside. Link X once, then come back."
          : `Playground: desktop Ctrl/Cmd-click Link X, or mobile long-press it and open outside: ${xLoginUrl}`
        : "Preparing the X login link. If it opens the app instead of X, wait a second and try again.",
    );
  }

  async function startXConnection() {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    if (isMiniApp) {
      await showMiniAppXLoginHint();
      return;
    }

    window.location.assign(X_CONNECT_START_URL);
  }

  async function verifyCampaign(campaign: GarageXCampaign) {
    if (!isAuthenticated) {
      setCampaignFeedback({
        campaignId: campaign.id,
        tone: "error",
        message: "Connect your Circles wallet first.",
      });
      openLogin();
      return;
    }
    if (!status.linkedAccount) {
      setCampaignFeedback({
        campaignId: campaign.id,
        tone: "error",
        message: "Link your X account first.",
      });
      void startXConnection();
      return;
    }

    setCampaignFeedback(null);
    setVerifyingId(campaign.id);
    try {
      const openedAt = window.localStorage.getItem(campaignOpenKey(campaign.id));
      const missKey = campaignVerifyMissKey(campaign.id);
      const verifyMisses = Number(window.localStorage.getItem(missKey) ?? 0);
      const allowRetweetedByFallback = Number.isFinite(verifyMisses) && verifyMisses >= 2;
      const res = await fetch("/api/garage/x/verify", {
        method: "POST",
        credentials: "include",
        headers: clientAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ campaignId: campaign.id, openedAt, allowRetweetedByFallback }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "ACTION_NOT_FOUND") {
          window.localStorage.setItem(missKey, String(verifyMisses + 1));
        }
        const errorCopy: Record<string, string> = {
          ACTION_NOT_FOUND:
            data?.evidence === "user_timeline_repost" && !allowRetweetedByFallback
              ? verifyMisses >= 1
                ? "X still has not indexed the repost. Try once more in a few seconds for a deeper check."
                : "X has not indexed the repost yet. Keep it live and verify again in a few seconds."
              : "Action not found on X. Keep the repost live and try again.",
          X_ACCOUNT_REQUIRED: "Link your X account first.",
          X_API_NOT_CONFIGURED: "X API token is missing.",
          X_API_NO_CREDITS: "X API account has no credits for verification.",
          X_API_ACCESS_DENIED: "X API token cannot access this endpoint.",
          X_API_RATE_LIMITED: "X API rate limit reached. Try again later.",
          X_API_ERROR: "X API verification failed.",
          CAMPAIGN_EXHAUSTED: "Campaign budget is spent.",
        };
        setCampaignFeedback({
          campaignId: campaign.id,
          tone: "error",
          message: errorCopy[data?.error] ?? data?.error ?? "Verification failed.",
        });
        return;
      }
      window.localStorage.removeItem(campaignVerifyMissKey(campaign.id));
      if (data?.status === "verified_pending" || data?.status === "settlement_pending") {
        const when = formatDateTime(data?.availableAt ?? data?.claim?.payoutAvailableAt);
        setCampaignFeedback({
          campaignId: campaign.id,
          tone: "success",
          message: when
            ? `Action verified. CRC unlocks after re-check at ${when}.`
            : "Action verified. CRC is waiting for settlement re-check.",
        });
      } else {
        const txHash = data?.claim?.payoutTxHash ?? data?.payout?.transferTxHash ?? null;
        setCampaignFeedback({
          campaignId: campaign.id,
          tone: "success",
          txHash: typeof txHash === "string" ? txHash : null,
          message:
            data?.status === "paid"
              ? "CRC sent on-chain. Wallet apps can take a few seconds to refresh."
              : "Action verified. Payout is being processed.",
        });
      }
      await loadData();
    } catch {
      setCampaignFeedback({
        campaignId: campaign.id,
        tone: "error",
        message: "Verification failed.",
      });
    } finally {
      setVerifyingId(null);
    }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createReady) {
      setNoticeTone("error");
      setNoticeTxHash(null);
      setNotice(createIssue ?? "Campaign draft is incomplete.");
      return;
    }

    setCreating(true);
    setNotice(null);
    setNoticeTxHash(null);
    try {
      const res = await fetch("/api/garage/x/campaigns", {
        method: "POST",
        credentials: "include",
        headers: clientAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...createForm,
          budgetCrc: createCost.rewardPoolCrc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoticeTone("error");
        setNoticeTxHash(null);
        setNotice(data?.error ?? "Campaign creation failed.");
        return;
      }
      setCreateForm({
        title: "",
        tweetUrl: "",
        action: "repost",
        rewardCrc: "1",
        budgetCrc: "25",
        maxClaims: "25",
        description: "",
      });
      setNoticeTone("success");
      setNoticeTxHash(null);
      setGarageSection("creator");
      const payment = data?.campaign?.fundingPayment ?? null;
      if (payment) {
        setFundingPayment(payment);
        setNotice(`Campaign drafted. Pay ${formatNumber(payment.amountCrc)} CRC to activate it.`);
      } else {
        setNotice("Campaign created.");
      }
      await loadData();
    } catch {
      setNoticeTone("error");
      setNoticeTxHash(null);
      setNotice("Campaign creation failed.");
    } finally {
      setCreating(false);
    }
  }

  function rememberFundingSent(campaignId: number, txHash: string | null) {
    setFundingSentTxs((current) => ({ ...current, [campaignId]: txHash }));
    try {
      window.localStorage.setItem(fundingSentKey(campaignId), txHash || "sent");
    } catch {}
  }

  function clearFundingSent(campaignId: number) {
    setFundingSentTxs((current) => {
      const next = { ...current };
      delete next[campaignId];
      return next;
    });
    try {
      window.localStorage.removeItem(fundingSentKey(campaignId));
    } catch {}
  }

  async function payCampaignFunding(paymentOverride?: GarageCampaignFundingPayment) {
    const payment = paymentOverride ?? fundingPayment;
    if (!payment) return;
    if (hasFundingSent(fundingSentTxs, payment.campaignId)) {
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "success",
        txHash: fundingSentTxs[payment.campaignId],
        message: "Payment already signed. Use Check payment to activate the boost.",
      });
      return;
    }
    setFundingPayment(payment);
    setFundingAction("pay");
    setNotice(null);
    setNoticeTxHash(null);
    setFundingFeedback(null);
    try {
      if (isMiniApp) {
        const hashes = await sendPayment(payment.recipientAddress, payment.amountCrc, payment.gameData);
        const txHash = hashes[hashes.length - 1] ?? null;
        rememberFundingSent(payment.campaignId, txHash);
        setFundingFeedback({
          campaignId: payment.campaignId,
          tone: "success",
          txHash,
          message: "Payment signed with Circles passkey. Check payment to activate the boost.",
        });
        return;
      }

      window.open(payment.paymentLink, "_blank", "noopener,noreferrer");
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "success",
        message: "Payment checkout opened. After confirming, check payment to activate.",
      });
    } catch {
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "error",
        message: isMiniApp
          ? "Passkey payment failed. You can still copy the checkout link below and pay outside the Playground."
          : "Payment checkout could not be opened.",
      });
    } finally {
      setFundingAction(null);
    }
  }

  async function scanCampaignFunding(paymentOverride?: GarageCampaignFundingPayment) {
    const payment = paymentOverride ?? fundingPayment;
    if (!payment) return;
    setFundingPayment(payment);
    setFundingAction("scan");
    setNotice(null);
    setNoticeTxHash(null);
    setFundingFeedback(null);
    try {
      const res = await fetch("/api/garage/x/campaigns/scan", {
        method: "POST",
        credentials: "include",
        headers: clientAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          campaignId: payment.campaignId,
          txHash: fundingSentTxs[payment.campaignId] ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.activated) {
        setFundingFeedback({
          campaignId: payment.campaignId,
          tone: "error",
          message:
            data?.error === "PAYMENT_NOT_FOUND"
              ? hasFundingSent(fundingSentTxs, payment.campaignId)
                ? "Payment not indexed yet. Wait a few seconds, then check again."
                : "Payment not detected yet."
              : data?.error ?? "Activation failed.",
        });
        return;
      }
      const txHash = typeof data?.txHash === "string" ? data.txHash : null;
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "success",
        txHash,
        message: "Campaign funded and live.",
      });
      clearFundingSent(payment.campaignId);
      setFundingPayment(null);
      await loadData();
    } catch {
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "error",
        message: "Activation failed.",
      });
    } finally {
      setFundingAction(null);
    }
  }

  async function cancelCampaignFunding(paymentOverride?: GarageCampaignFundingPayment) {
    const payment = paymentOverride ?? fundingPayment;
    if (!payment) return;
    if (hasFundingSent(fundingSentTxs, payment.campaignId)) {
      setFundingFeedback({
        campaignId: payment.campaignId,
        tone: "error",
        txHash: fundingSentTxs[payment.campaignId],
        message: "Payment already signed. Check payment instead of cancelling to avoid losing the funded boost.",
      });
      return;
    }
    const confirmed = window.confirm("Cancel this unpaid campaign draft?");
    if (!confirmed) return;

    setFundingPayment(payment);
    setFundingAction("cancel");
    setNotice(null);
    setNoticeTxHash(null);
    try {
      const res = await fetch(`/api/garage/x/campaigns/${payment.campaignId}`, {
        method: "DELETE",
        credentials: "include",
        headers: clientAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.cancelled) {
        setNoticeTone("error");
        setNoticeTxHash(typeof data?.txHash === "string" ? data.txHash : null);
        setNotice(
          data?.error === "PAYMENT_ALREADY_DETECTED"
            ? "Payment already detected. Activate the boost instead."
            : data?.error ?? "Campaign cancellation failed.",
        );
        return;
      }
      setNoticeTone("success");
      setNotice("Campaign draft cancelled.");
      setFundingFeedback(null);
      setFundingPayment((current) => (current?.campaignId === payment.campaignId ? null : current));
      await loadData();
    } catch {
      setNoticeTone("error");
      setNotice("Campaign cancellation failed.");
    } finally {
      setFundingAction(null);
    }
  }

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const creatorCampaigns = address
    ? campaigns.filter((campaign) => campaign.createdByAddress?.toLowerCase() === address.toLowerCase())
    : [];
  const primaryCampaign = activeCampaigns[0] ?? null;
  const circlesDisplayName = myProfile?.name?.trim() || (profileAddress ? shortAddress(profileAddress) : "Connect wallet");
  const circlesAvatarUrl = myProfile?.imageUrl || null;
  const primaryFundingSent = fundingPayment ? hasFundingSent(fundingSentTxs, fundingPayment.campaignId) : false;
  const xConnectHref = isAuthenticated
    ? isMiniApp
      ? xAuthUrl || "#twitter-login-preparing"
      : X_CONNECT_START_URL
    : "#connect-wallet";

  function openGarageSection(section: GarageSection) {
    setGarageSection(section);
    window.setTimeout(() => {
      document.getElementById("garage-sections")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function recordCampaignOpen(campaign: GarageXCampaign) {
    window.localStorage.setItem(campaignOpenKey(campaign.id), new Date().toISOString());
  }

  async function openCampaignOnX(campaign: GarageXCampaign) {
    if (!campaign.tweetUrl) return;
    recordCampaignOpen(campaign);

    if (isMiniApp) {
      const didCopy = await copyText(campaign.tweetUrl);
      setVisibleXLinkCampaignId(campaign.id);
      setNoticeTone("success");
      setNoticeTxHash(null);
      setNotice(
        didCopy
          ? "X post link copied and shown inside the card. Playground: desktop Ctrl/Cmd-click Open on X, or mobile long-press the shown link. Then come back to verify."
          : "Playground: desktop Ctrl/Cmd-click Open on X, or mobile long-press the shown link. Then come back to verify.",
      );
    }
  }

  return (
    <main className="garage-theme relative isolate min-h-screen w-full max-w-full overflow-x-hidden pb-16 text-ink dark:text-white">
      <div className="fixed left-2 right-2 top-3 z-[100] flex max-w-[calc(100vw-1rem)] items-center justify-end gap-1.5 sm:left-auto sm:right-5 sm:top-4 sm:gap-2">
        <LanguageSwitcher className="h-11 shrink-0 rounded-2xl border border-ink/10 bg-white/80 px-1.5 shadow-[0_18px_55px_-32px_rgba(20,20,24,0.75)] backdrop-blur-xl dark:border-white/10 dark:bg-[#202024]/90 sm:px-2" />
        <button
          type="button"
          onClick={() => openGarageSection("profile")}
          className="inline-flex h-11 max-w-[126px] shrink-0 items-center gap-2 overflow-hidden rounded-2xl border border-ink/10 bg-white/80 px-2 text-sm font-black text-ink shadow-[0_18px_55px_-32px_rgba(20,20,24,0.75)] backdrop-blur-xl transition hover:border-marine/25 hover:bg-white dark:border-white/10 dark:bg-[#202024]/90 dark:text-white dark:hover:bg-white/15 sm:max-w-[210px] sm:px-2.5"
          title="Profile"
          aria-label="Open profile"
        >
          {circlesAvatarUrl ? (
            <img
              src={circlesAvatarUrl}
              alt={circlesDisplayName}
              className="h-8 w-8 shrink-0 rounded-full border border-ink/10 object-cover dark:border-white/10"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white dark:bg-white dark:text-ink">
              <Wallet className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 truncate text-xs sm:text-sm">{loading ? "loading" : circlesDisplayName}</span>
        </button>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => void disconnectWallet()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink/10 bg-white/80 text-ink/65 shadow-[0_18px_55px_-32px_rgba(20,20,24,0.75)] backdrop-blur-xl transition hover:border-red-500/25 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-[#202024]/90 dark:text-white/70 dark:hover:bg-red-500/15 dark:hover:text-red-200"
            title="Disconnect wallet"
            aria-label="Disconnect wallet"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      <section className="garage-header sticky top-0 z-30 border-b border-ink/10 bg-sand/90 pt-16 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/90 sm:pt-3 min-[1120px]:pt-0">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 min-[1120px]:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] min-[1120px]:items-center">
          <div className="order-2 flex min-w-0 flex-col gap-2 justify-self-start min-[720px]:flex-row min-[720px]:items-center min-[1120px]:order-none">
            <LatestPayoutTicker payout={latestPayout} profile={latestPayoutProfile} />
            <div className="relative min-w-0 rounded-2xl border border-ink/10 bg-[#f0ede5]/95 p-1.5 text-ink shadow-[0_18px_42px_-34px_rgba(37,27,159,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#19171d]/95 dark:text-white dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.72)]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMarketStatusOpen((open) => !open)}
                  aria-expanded={marketStatusOpen}
                  className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-ink/5 dark:hover:bg-white/10"
                >
                  <Activity className="h-4 w-4 shrink-0 text-ink/55 dark:text-white/65" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                      Market
                    </span>
                    <span className="block max-w-[130px] truncate text-[11px] font-black text-ink/72 dark:text-white/72 sm:max-w-[180px]">
                      {formatNumber(status.global.claims)} claims - {formatNumber(status.global.xReads)} reads
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-ink/50 transition dark:text-white/55 ${marketStatusOpen ? "rotate-180" : ""}`} />
                </button>
                <span className="rounded-xl border border-ink/10 bg-[#fbfaf6]/70 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-ink/55 dark:border-white/10 dark:bg-white/10 dark:text-white/60">
                  {isMiniApp ? "Mini" : "Web"}
                </span>
                <button
                  type="button"
                  onClick={() => void syncGarage()}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-[#fbfaf6]/70 px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-ink/65 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              </div>

              {marketStatusOpen && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[120] w-[min(360px,calc(100vw-2rem))] rounded-xl border border-ink/10 bg-[#f6f1e8]/95 p-4 text-ink shadow-[0_24px_70px_-34px_rgba(37,27,159,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#19171d]/95 dark:text-white dark:shadow-[0_24px_70px_-34px_rgba(0,0,0,0.72)]">
                  <div className="grid gap-3">
                    <MarketStatusLine icon={BadgeCheck} label="Verified claims" value={formatNumber(status.global.claims)} />
                    <MarketStatusLine icon={Wallet} label="Wallets paid" value={formatNumber(status.global.wallets)} />
                    <MarketStatusLine icon={ShieldCheck} label="X accounts" value={formatNumber(status.global.xAccounts)} />
                    <MarketStatusLine icon={CircleDollarSign} label="CRC loop" value="funded + paid" />
                  </div>
                  <div className="mt-5 grid gap-2 text-xs font-bold text-ink/55 dark:text-white/58">
                    <p className="flex items-center justify-between gap-3">
                      <span>X OAuth</span>
                      <span className={status.xOAuthConfigured ? "text-emerald-300" : "text-citrus"}>
                        {status.xOAuthConfigured ? "ready" : "missing"}
                      </span>
                    </p>
                    <p className="flex items-center justify-between gap-3">
                      <span>X verification API</span>
                      <span className={status.xApiConfigured ? "text-emerald-300" : "text-citrus"}>
                        {status.xApiConfigured ? "ready" : "missing"}
                      </span>
                    </p>
                    <p className="flex items-center justify-between gap-3">
                      <span>Settlement</span>
                      <span className="text-emerald-300">
                        {formatDurationShort(claimSettlementTier.delaySeconds)} for you
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Link href="/" className="order-1 flex items-center justify-self-start gap-3.5 min-[1120px]:order-none min-[1120px]:justify-self-center">
            <Image
              src="/crc-boost-icon.png"
              alt="CRC Boost"
              width={52}
              height={52}
              className="h-12 w-12 rounded-2xl border border-ink/10 bg-white object-cover p-0.5 dark:border-white/10"
            />
            <div>
              <p className="text-base font-black uppercase tracking-[0.18em]">CRC Boosts</p>
              <p className="text-xs font-bold text-ink/50 dark:text-white/55">by NF-Society</p>
            </div>
          </Link>
          <div aria-hidden="true" className="hidden min-[1120px]:block" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
          <div className="garage-hero relative overflow-hidden rounded-2xl border border-ink/5 bg-white/70 p-6 text-ink shadow-[0_24px_70px_-48px_rgba(37,27,159,0.55)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-marine">
                  <CircleDollarSign className="h-4 w-4" />
                  CRC attention market
                </p>
                <h1 className="mt-4 max-w-3xl font-display text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
                  Boost real X attention with CRC.
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-ink/60 dark:text-white/60">
                  Creators fund a CRC reward pool. Users complete verified X actions and receive on-chain CRC only after the action survives settlement.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ProofPill
                    icon={BadgeCheck}
                    label="X verified"
                    value={status.xApiConfigured ? "live" : "setup"}
                    tone={status.xApiConfigured ? "success" : "warn"}
                  />
                  <ProofPill
                    icon={Clock3}
                    label="Settlement"
                    value={`${formatDurationShort(claimSettlementTier.delaySeconds)} for you`}
                    tone="neutral"
                  />
                  <ProofPill
                    icon={CircleDollarSign}
                    label="CRC payout"
                    value="on-chain"
                    tone="success"
                  />
                </div>
              </div>
              <div className="grid gap-3 lg:w-[280px]">
                <button
                  type="button"
                  onClick={isAuthenticated ? undefined : openLogin}
                    className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-3 text-left text-ink transition hover:border-marine/25 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  {circlesAvatarUrl ? (
                    <img
                      src={circlesAvatarUrl}
                      alt={circlesDisplayName}
                      className="h-10 w-10 shrink-0 rounded-2xl border border-ink/10 object-cover dark:border-white/10"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-marine/10 text-marine">
                      <Wallet className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-ink/45 dark:text-white/45">
                      {myProfile?.name ? "Circles" : "Wallet"}
                    </span>
                    <span className="block truncate text-[13px] font-black leading-tight">
                      {loading ? "loading" : circlesDisplayName}
                    </span>
                    {myProfile?.name && profileAddress && (
                      <span className="mt-0.5 block truncate text-[10px] font-bold text-ink/42 dark:text-white/42">
                        {shortAddress(profileAddress)}
                      </span>
                    )}
                  </span>
                </button>
                <a
                  href={xConnectHref}
                  target={isMiniApp && isAuthenticated && xAuthUrl ? "_blank" : undefined}
                  rel={isMiniApp && isAuthenticated && xAuthUrl ? "noopener noreferrer" : undefined}
                  onClick={(event) => {
                    if (!isAuthenticated || !isMiniApp) {
                      event.preventDefault();
                      void startXConnection();
                      return;
                    }

                    if (!xAuthUrl) {
                      event.preventDefault();
                    }
                    void showMiniAppXLoginHint();
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-3 text-left text-ink transition hover:border-marine/25 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white dark:bg-white dark:text-ink">
                    X
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                      Account
                    </span>
                    <span className="block truncate text-[13px] font-black leading-tight">
                      {status.linkedAccount ? `@${status.linkedAccount.username}` : "Link X"}
                    </span>
                  </span>
                </a>
                {isMiniApp && !status.linkedAccount && (
                  <div className="rounded-xl border border-marine/15 bg-marine/10 p-3 text-[11px] font-bold leading-5 text-ink/62 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-white/65">
                    <p>Playground: open X auth outside, then come back.</p>
                    {xAuthUrl ? (
                      <a
                        href={xAuthUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
                      >
                        Open X login
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-ink/10 px-3 py-2 text-xs font-black text-ink/45 dark:border-white/10 dark:text-white/45">
                        Preparing X login...
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {notice && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold ${
                  noticeTone === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200"
                }`}
              >
                {noticeTone === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span className="min-w-0">
                  {notice}
                  {noticeTxHash && (
                    <a
                      href={`https://gnosisscan.io/tx/${noticeTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-black underline underline-offset-2"
                    >
                      View tx
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              </div>
            )}
            {campaignsUnavailable && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                Run database migration 0020 before live claims.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStat
              icon={Trophy}
              label="Verified claims"
              value={formatNumber(status.global.claims)}
              detail={`${formatNumber(status.global.wallets)} wallets`}
            />
            <DashboardStat
              icon={CircleDollarSign}
              label="CRC paid out"
              value={`${formatNumber(status.global.crcPaid)} CRC`}
              detail="on-chain payouts"
            />
            <DashboardStat
              icon={Target}
              label="Live boosts"
              value={`${formatNumber(status.global.activeCampaigns)} live`}
              detail={primaryCampaign?.title ?? "No boost running"}
            />
            <DashboardStat
              icon={Activity}
              label="X API reads"
              value={formatNumber(status.global.xReads)}
              detail="verification cost signal"
            />
          </div>

          <div id="garage-sections" className="flex scroll-mt-24 flex-wrap items-center gap-y-1 rounded-lg border border-ink/10 bg-[#fbfaf6] p-2 shadow-sm dark:border-white/10 dark:bg-white/5 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setGarageSection("boosts")}
              aria-pressed={garageSection === "boosts"}
              className={`group flex min-w-[136px] flex-1 cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left ring-1 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine/55 ${
                garageSection === "boosts"
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "text-ink/55 hover:-translate-y-0.5 hover:bg-ink/5 hover:text-ink hover:ring-ink/10 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10"
              }`}
            >
              <Target className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-black">Boosts</span>
                <span className="block text-[11px] font-bold opacity-60">earn CRC</span>
              </span>
            </button>
            <span aria-hidden="true" className="hidden h-8 w-px shrink-0 rounded-full bg-ink/15 dark:bg-white/15 sm:block" />
            <button
              type="button"
              onClick={() => setGarageSection("leaderboard")}
              aria-pressed={garageSection === "leaderboard"}
              className={`group flex min-w-[136px] flex-1 cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left ring-1 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine/55 ${
                garageSection === "leaderboard"
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "text-ink/55 hover:-translate-y-0.5 hover:bg-ink/5 hover:text-ink hover:ring-ink/10 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10"
              }`}
            >
              <Trophy className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-black">Leaderboard</span>
                <span className="block text-[11px] font-bold opacity-60">top CRC earners</span>
              </span>
            </button>
            <span aria-hidden="true" className="hidden h-8 w-px shrink-0 rounded-full bg-ink/15 dark:bg-white/15 sm:block" />
            <button
              type="button"
              onClick={() => setGarageSection("profile")}
              aria-pressed={garageSection === "profile"}
              className={`group flex min-w-[136px] flex-1 cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left ring-1 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine/55 ${
                garageSection === "profile"
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "text-ink/55 hover:-translate-y-0.5 hover:bg-ink/5 hover:text-ink hover:ring-ink/10 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10"
              }`}
            >
              <Wallet className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-black">Profile</span>
                <span className="block text-[11px] font-bold opacity-60">referrals + history</span>
              </span>
            </button>
            <span aria-hidden="true" className="hidden h-8 w-px shrink-0 rounded-full bg-ink/15 dark:bg-white/15 sm:block" />
            <button
              type="button"
              onClick={() => setGarageSection("creator")}
              aria-pressed={garageSection === "creator"}
              className={`group flex min-w-[136px] flex-1 cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left ring-1 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine/55 ${
                garageSection === "creator"
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "text-ink/55 hover:-translate-y-0.5 hover:bg-ink/5 hover:text-ink hover:ring-ink/10 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10"
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-black">Creator</span>
                <span className="block text-[11px] font-bold opacity-60">fund attention</span>
              </span>
            </button>
          </div>

          {garageSection === "boosts" && (
            <div className="space-y-6">
              <div className="grid gap-5 rounded-lg border border-ink/10 bg-[#f7f7fa] p-5 shadow-sm dark:border-white/10 dark:bg-white/5 md:grid-cols-3">
                <FlowStep
                  icon={MousePointerClick}
                  step="01"
                  title="Open X"
                  detail="Open the campaign post and complete the requested action."
                />
                <FlowStep
                  icon={SearchCheck}
                  step="02"
                  title="Verify"
                  detail="Return here so the app checks your X account proof."
                />
                <FlowStep
                  icon={CircleDollarSign}
                  step="03"
                  title="Receive CRC"
                  detail={`Your settlement is ${formatDurationShort(claimSettlementTier.delaySeconds)} from your trust/backer status.`}
                />
              </div>

              <div className="grid gap-6">
                {loadingData && activeCampaigns.length === 0 ? (
                  <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-marine" />
                  </div>
                ) : activeCampaigns.length === 0 ? (
                  <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-ink/10 bg-[#f0ede5] text-ink/55 dark:border-white/10 dark:bg-white/10 dark:text-white/60">
                        <Megaphone className="h-6 w-6" />
                      </span>
                      <p className="mt-4 font-display text-2xl font-black">No live boosts yet.</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-ink/55 dark:text-white/58">
                        Launch a creator-funded CRC boost, or check the leaderboard once users start completing verified missions.
                      </p>
                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setGarageSection("creator")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
                        >
                          <Plus className="h-4 w-4" />
                          Create boost
                        </button>
                        <button
                          type="button"
                          onClick={() => setGarageSection("leaderboard")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-[#f0ede5] px-4 text-sm font-black text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
                        >
                          <Trophy className="h-4 w-4" />
                          Open leaderboard
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  activeCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.slug}
                      campaign={campaign}
                      creatorProfile={
                        campaign.createdByAddress
                          ? campaignCreatorProfiles[campaign.createdByAddress.toLowerCase()] ?? null
                          : null
                      }
                      isMiniApp={isMiniApp}
                      showXLink={visibleXLinkCampaignId === campaign.id}
                      verifying={verifyingId === campaign.id}
                      disabled={
                        campaignsUnavailable ||
                        campaign.id <= 0 ||
                        verifyingId === campaign.id ||
                        Boolean(claimTimeRemaining(campaign.claimedByMe ?? null, now)) ||
                        !claimCanTrigger(campaign.claimedByMe ?? null) ||
                        campaign.stats.remainingClaims <= 0
                      }
                      onVerify={() => verifyCampaign(campaign)}
                      onOpen={() => void openCampaignOnX(campaign)}
                      now={now}
                      settlementSeconds={claimSettlementTier.delaySeconds}
                      feedback={campaignFeedback?.campaignId === campaign.id ? campaignFeedback : null}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {garageSection === "leaderboard" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <GarageLeaderboard entries={status.leaderboard} profiles={leaderboardProfiles} />
              <div className="rounded-lg border border-[#39363a] bg-[#242329] p-6 text-white shadow-[0_18px_42px_-34px_rgba(0,0,0,0.72)] dark:border-white/10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                  CRC earners
                </p>
                <h2 className="mt-1 font-display text-xl font-black">Participation rank</h2>
                <p className="mt-3 text-sm font-bold leading-6 text-white/58">
                  Wallets rank by verified missions and CRC earned. Circles profiles show name, image, trust score and backer status when cached.
                </p>
                <div className="mt-5 grid gap-3">
                  <StatusLine icon={Trophy} label="Ranked wallets" value={formatNumber(status.leaderboard.length)} />
                  <StatusLine icon={CircleDollarSign} label="CRC paid" value={`${formatNumber(status.global.crcPaid)} CRC`} />
                  <StatusLine icon={Activity} label="X reads" value={formatNumber(status.global.xReads)} />
                </div>
              </div>
            </div>
          )}

          {garageSection === "profile" && (
            <div className="min-w-0 space-y-6">
          <div className="min-w-0 rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  My activity
                </p>
                <h2 className="mt-1 font-display text-xl font-black">Personal dashboard</h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {status.linkedAccount && (
                  <span className="rounded-md bg-citrus/10 px-3 py-1 text-xs font-black text-citrus">
                    @{status.linkedAccount.username}
                  </span>
                )}
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => void disconnectWallet()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 bg-[#f0ede5] px-3 text-xs font-black text-ink/60 transition hover:border-red-500/25 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-red-500/15 dark:hover:text-red-200"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {isAuthenticated ? (
              <>
                <div className="mt-5 flex items-center gap-3 rounded-lg border border-ink/10 bg-[#f0ede5] p-3 dark:border-white/10 dark:bg-white/5">
                  {circlesAvatarUrl ? (
                    <img
                      src={circlesAvatarUrl}
                      alt={circlesDisplayName}
                      className="h-12 w-12 shrink-0 rounded-full border border-ink/10 object-cover dark:border-white/10"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-[#fbfaf6] text-sm font-black text-ink/45 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
                      {circlesDisplayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
                      Circles profile
                    </p>
                    <p className="truncate font-display text-lg font-black leading-tight">{circlesDisplayName}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-ink/45 dark:text-white/45">
                      {shortAddress(profileAddress)}
                    </p>
                    {trustProfile ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black">
                        <BackerStatusBadge status={trustProfile.backerStatus} size="compact" />
                        {trustProfile.trustScore !== null ? (
                          <MetricPill tone="muted">Trust {trustProfile.trustScore}</MetricPill>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat label="Actions" value={formatNumber(status.personal.verifiedActions)} />
                  <MiniStat label="Earned" value={`${formatNumber(status.personal.crcEarned)} CRC`} />
                  <MiniStat label="Pending" value={`${formatNumber(status.personal.crcPending)} CRC`} />
                  <MiniStat label="X reads" value={formatNumber(status.personal.xReads)} />
                </div>

                <div className="mt-5 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                        Circles trust
                      </p>
                      <h3 className="font-display text-lg font-black">Trust graph status</h3>
                      <p className="mt-1 text-xs font-bold leading-5 text-ink/52 dark:text-white/55">
                        Cached from Circles RPC. Refresh when your score or backer status changes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={refreshTrustProfile}
                      disabled={trustRefreshing}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-white transition hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-ink"
                    >
                      {trustRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refresh
                    </button>
                  </div>

                  {trustProfile ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MiniStat label="Trust score" value={trustScoreValue(trustProfile)} />
                        <MiniStat label="Mutual trust" value={formatNumber(trustProfile.mutualCount)} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
                        <BackerStatusBadge status={trustProfile.backerStatus} />
                        <MetricPill>
                          {trustProfile.directBacker
                            ? "Direct backing completed"
                            : `${formatNumber(trustProfile.indirectBackerTrustCount)} direct backer trusts`}
                        </MetricPill>
                        <MetricPill>
                          {formatNumber(trustProfile.inDegree)} in / {formatNumber(trustProfile.outDegree)} out
                        </MetricPill>
                      </div>
                      <p className="mt-3 text-[11px] font-bold text-ink/45 dark:text-white/45">
                        Last checked {formatDateTime(trustProfile.lastFetchedAt)}
                        {trustProfile.errorMessage ? ` - ${trustProfile.errorMessage}` : ""}
                      </p>
                    </>
                  ) : (
                    <div className="mt-4 rounded-md border border-ink/10 bg-[#fbfaf6] p-3 text-sm font-bold text-ink/55 dark:border-white/10 dark:bg-black/20 dark:text-white/58">
                      Connect and refresh to load your Circles trust score and direct/indirect backer status.
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {status.recentClaims.length ? (
                    status.recentClaims.map((claim) => (
                      <div key={claim.id} className="rounded-md border border-ink/10 bg-[#f0ede5] p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black">{claim.campaignTitle}</p>
                            <p className="text-xs font-bold text-ink/45 dark:text-white/45">
                              {ACTION_LABELS[claim.action as GarageXCampaign["action"]] ?? claim.action} - {formatNumber(claim.campaignRewardCrc)} CRC - {formatDate(claim.createdAt)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${claimTone(claim.status)}`}>
                            {claimStatusLabel(claim.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-ink/45 dark:text-white/45">
                          <span>{evidenceLabel(claim.verificationEvidence)}</span>
                          <span>{formatNumber(claim.verificationChecked)} reads</span>
                          {claim.payoutAvailableAt && claim.status === "verified_pending" && (
                            <span>re-check {formatDateTime(claim.payoutAvailableAt)}</span>
                          )}
                          {claim.campaignTweetUrl && (
                            <a
                              href={claim.campaignTweetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-black text-marine hover:underline"
                            >
                              X post
                            </a>
                          )}
                          {claim.payoutTxHash && (
                            <a
                              href={`https://gnosisscan.io/tx/${claim.payoutTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-black text-marine hover:underline"
                            >
                              {shortHash(claim.payoutTxHash)}
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="font-display text-lg font-black">No missions completed yet.</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-ink/52 dark:text-white/55">
                        Complete a live boost to build your activity history and appear on the leaderboard.
                      </p>
                      <button
                        type="button"
                        onClick={() => setGarageSection("boosts")}
                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
                      >
                        <Target className="h-4 w-4" />
                        Open boosts
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={openLogin}
                className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
              >
                Connect wallet to track activity
              </button>
            )}
          </div>

          <div className="min-w-0 rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
            <button
              type="button"
              onClick={() => setProfileReferralOpen((open) => !open)}
              aria-expanded={profileReferralOpen}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  Invite
                </p>
                <h2 className="font-display text-xl font-black">Referral link</h2>
                <p className="mt-1 text-sm font-bold text-ink/45 dark:text-white/45">
                  {formatNumber(referrals.mine.total)} invited - {formatNumber(referrals.rewards.activatedWallets)} activated - {formatNumber(referrals.rewards.claimableCrc)} CRC claimable
                </p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
                <ChevronDown className={`h-5 w-5 transition ${profileReferralOpen ? "rotate-180" : ""}`} />
              </span>
            </button>

            {profileReferralOpen && (
              <div className="mt-5 border-t border-ink/10 pt-5 dark:border-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <code className="block min-w-0 max-w-full truncate rounded-md bg-[#f0ede5] px-3 py-2.5 text-xs font-bold text-ink/65 dark:bg-black/20 dark:text-white/70 sm:flex-1">
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-white dark:bg-white dark:text-ink"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-ink/55 dark:text-white/58">
                  Share this Circles-name link. When a new wallet connects from it and completes verified boost missions, you unlock referral CRC for that invited user.
                </p>
                {profileAddress && !referrals.authenticated && !referralStatsForProfile && (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
                    <span>Referral stats need an authenticated wallet session.</span>
                    <button
                      type="button"
                      onClick={openLogin}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-700 px-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Reconnect
                    </button>
                  </div>
                )}
                {referrals.unavailable && (referrals.authenticated || !profileAddress) && (
                  <div className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-800 dark:text-rose-100">
                    Referral stats are temporarily unavailable. Sync again in a moment.
                  </div>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat label="Invited" value={formatNumber(referrals.mine.total)} />
                  <MiniStat label="Activated" value={formatNumber(referrals.rewards.activatedWallets)} />
                  <MiniStat label="Claimable" value={`${formatNumber(referrals.rewards.claimableCrc)} CRC`} />
                  <MiniStat label="Claimed" value={`${formatNumber(referrals.rewards.crcEarned)} CRC`} />
                </div>
                <div className="mt-4 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                        Referral balance
                      </p>
                      <p className="mt-1 font-display text-xl font-black">
                        {formatNumber(referrals.rewards.claimableCrc)} CRC claimable
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-ink/50 dark:text-white/50">
                        Referral rewards accumulate here. Claim when you want one grouped payout.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void claimReferralBalance()}
                      disabled={referralClaiming || referrals.rewards.claimableCrc <= 0}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white dark:text-ink"
                    >
                      {referralClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                      Claim referral CRC
                    </button>
                  </div>
                  {referrals.rewards.pendingCrc > 0 && (
                    <p className="mt-3 text-xs font-bold text-ink/50 dark:text-white/50">
                      {formatNumber(referrals.rewards.pendingCrc)} CRC referral claim in progress.
                    </p>
                  )}
                </div>
                <ReferralActivityList activity={referrals.activity} profiles={referralProfiles} />
                <div className="mt-5 min-w-0 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                        Referral rewards
                      </p>
                      <h3 className="font-display text-lg font-black">Per invited wallet</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="w-fit rounded-md bg-citrus/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-citrus">
                        rewards stack
                      </span>
                      <details className="group relative">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-ink/10 bg-[#fbfaf6] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink/58 transition hover:bg-white dark:border-white/10 dark:bg-black/20 dark:text-white/62 dark:hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                          <Info className="h-3.5 w-3.5" />
                          Quality multiplier
                        </summary>
                        <div className="mt-2 w-full rounded-lg border border-ink/10 bg-[#fbfaf6] p-3 text-ink shadow-[0_18px_52px_-34px_rgba(20,20,24,0.45)] dark:border-white/10 dark:bg-[#19171d] dark:text-white sm:absolute sm:right-0 sm:z-20 sm:w-[420px]">
                          <p className="text-xs font-bold leading-5 text-ink/55 dark:text-white/58">
                            Applied to the invited wallet when it reaches a mission milestone.
                          </p>
                          <div className="mt-3 overflow-hidden rounded-md border border-ink/10 text-[10px] font-black uppercase tracking-[0.1em] text-ink/58 dark:border-white/10 dark:text-white/62">
                            <div className="grid grid-cols-4 bg-ink/5 dark:bg-white/10">
                              <span className="px-2.5 py-2">Profile</span>
                              <span className="px-2.5 py-2 text-right">70+</span>
                              <span className="px-2.5 py-2 text-right">40-69</span>
                              <span className="px-2.5 py-2 text-right">&lt;40</span>
                            </div>
                            {referrals.qualityMultipliers.map((row) => (
                              <div key={row.status} className="grid grid-cols-4 border-t border-ink/10 dark:border-white/10">
                                <span className="px-2.5 py-2">{row.label}</span>
                                <span className="px-2.5 py-2 text-right">{formatMultiplier(row.multipliers.high)}</span>
                                <span className="px-2.5 py-2 text-right">{formatMultiplier(row.multipliers.medium)}</span>
                                <span className="px-2.5 py-2 text-right">{formatMultiplier(row.multipliers.low)}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] font-bold leading-5 text-ink/48 dark:text-white/50">
                            Minimum referral payout: {formatNumber(referrals.minRewardCrc)} CRC.
                          </p>
                        </div>
                      </details>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {referrals.milestones.map((milestone) => (
                      <div
                        key={milestone.threshold}
                        className="grid min-w-0 gap-3 rounded-md border border-ink/10 bg-[#fbfaf6] p-3 dark:border-white/10 dark:bg-black/20"
                      >
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
                            Invited wallet completes
                          </p>
                          <p className="mt-1 font-display text-lg font-black">
                            {formatNumber(milestone.threshold)} verified{" "}
                            {milestone.threshold === 1 ? "mission" : "missions"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
                            You receive
                          </p>
                          <p className="mt-1 font-display text-lg font-black text-citrus">
                            +{formatNumber(milestone.amountCrc)} CRC
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-bold leading-5 text-ink/50 dark:text-white/50">
                    If the same invited wallet reaches 5 verified missions, the 1, 3, and 5 mission bonuses all unlock.
                  </p>
                </div>
              </div>
            )}
          </div>
            </div>
          )}

          {garageSection === "creator" && (
            <div className="space-y-6">
          <CreatorDashboard
            campaigns={creatorCampaigns}
            isAuthenticated={isAuthenticated}
            isMiniApp={isMiniApp}
            creatorProfileHref={creatorProfileHref}
            onConnect={openLogin}
            onPay={(payment) => void payCampaignFunding(payment)}
            onScan={(payment) => void scanCampaignFunding(payment)}
            onCancel={(payment) => void cancelCampaignFunding(payment)}
            onCreateFocus={() => {
              setCreatorFormOpen(true);
              requestAnimationFrame(() => document.getElementById("garage-boost-title")?.focus());
            }}
            fundingAction={fundingAction}
            fundingFeedback={fundingFeedback}
            fundingSentTxs={fundingSentTxs}
          />
          <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setCreatorFormOpen((open) => !open)}
              aria-expanded={creatorFormOpen}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  Creator market
                </p>
                <h2 className="mt-1 font-display text-xl font-black">Launch boost</h2>
                <p className="mt-1 text-sm font-bold text-ink/45 dark:text-white/45">
                  Fund a CRC reward pool and preview the campaign before payment.
                </p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
                <ChevronDown className={`h-5 w-5 transition ${creatorFormOpen ? "rotate-180" : ""}`} />
              </span>
            </button>

            {creatorFormOpen && (
              <form onSubmit={createCampaign} className="mt-5 border-t border-ink/10 pt-5 dark:border-white/10">
            <div className="rounded-lg border border-citrus/20 bg-citrus/10 p-4 dark:border-citrus/25 dark:bg-citrus/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-citrus text-white">
                  <CircleDollarSign className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-citrus">
                    Creator-funded CRC rewards
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6 text-ink/62 dark:text-white/68">
                    You fund the user reward pool plus a{" "}
                    {formatPercentFromBps(creatorFeeTier.feeBps)} NF Society fee. The boost goes live only after the CRC payment is detected.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
                    {creatorFeeTier.backerStatus !== "unknown" ? (
                      <BackerStatusBadge status={creatorFeeTier.backerStatus} size="compact" />
                    ) : null}
                    <span className="rounded-full bg-white/70 px-3 py-1 uppercase text-citrus dark:bg-black/20">
                      {creatorFeeTier.label}
                    </span>
                    <span className="rounded-full bg-white/70 px-3 py-1 uppercase text-citrus dark:bg-black/20">
                      {formatPercentFromBps(creatorFeeTier.feeBps)} fee
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-ink/50 dark:text-white/50">
                    {creatorFeeTier.reason}
                  </p>
                  <div className="mt-4 overflow-hidden rounded-md border border-citrus/20 bg-white/55 text-[10px] font-black uppercase tracking-[0.1em] text-ink/58 dark:border-citrus/25 dark:bg-black/20 dark:text-white/62">
                    <div className="grid grid-cols-4 border-b border-citrus/15 bg-citrus/10">
                      <span className="px-3 py-2">Status</span>
                      <span className="px-3 py-2 text-right">70+</span>
                      <span className="px-3 py-2 text-right">40-69</span>
                      <span className="px-3 py-2 text-right">&lt;40</span>
                    </div>
                    {GARAGE_CREATOR_FEE_GRID.map((row) => (
                      <div key={row.status} className="grid grid-cols-4 border-b border-citrus/10 last:border-b-0">
                        <span className="px-3 py-2">{row.label}</span>
                        <span className="px-3 py-2 text-right">{formatPercentFromBps(row.fees.high)}</span>
                        <span className="px-3 py-2 text-right">{formatPercentFromBps(row.fees.medium)}</span>
                        <span className="px-3 py-2 text-right">{formatPercentFromBps(row.fees.low)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
                <button
                  type="button"
                  onClick={refreshTrustProfile}
                  disabled={trustRefreshing}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-xs font-black text-white transition hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-ink"
                >
                  {trustRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh trust
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)] lg:items-start">
              <div className="grid gap-4">
              <input
                id="garage-boost-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Title"
                className="h-14 rounded-lg border border-ink/10 bg-sand/50 px-4 text-sm font-bold leading-none outline-none placeholder:text-ink/42 focus:border-marine dark:border-white/10 dark:bg-black/20 dark:placeholder:text-white/42"
              />
              <label className="block rounded-lg border border-ink/10 bg-sand/50 p-4 transition focus-within:border-marine dark:border-white/10 dark:bg-black/20">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/45 dark:text-white/45">
                  Description
                </span>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  maxLength={500}
                  rows={4}
                  placeholder="Tell users what to do and why this boost matters."
                  className="mt-3 min-h-[104px] w-full resize-y bg-transparent text-sm font-bold leading-6 text-ink outline-none placeholder:text-ink/42 dark:text-white dark:placeholder:text-white/42"
                />
                <span className="mt-2 block text-right text-[10px] font-black uppercase tracking-[0.12em] text-ink/40 dark:text-white/40">
                  {createForm.description.length}/500
                </span>
              </label>
              <input
                value={createForm.tweetUrl}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, tweetUrl: event.target.value }))}
                placeholder="X post URL"
                className="h-14 rounded-lg border border-ink/10 bg-sand/50 px-4 text-sm font-bold leading-none outline-none placeholder:text-ink/42 focus:border-marine dark:border-white/10 dark:bg-black/20 dark:placeholder:text-white/42"
              />
              {createForm.tweetUrl && (
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
                    createTweet
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200"
                  }`}
                >
                  {createTweet ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  <span>
                    {createTweet
                      ? `X post detected${createTweet.username ? ` from @${createTweet.username}` : ""}.`
                      : "Use an X post URL like https://x.com/name/status/123."}
                  </span>
                </div>
              )}
              <select
                value={createForm.action}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    action: event.target.value as GarageXCampaign["action"],
                  }))
                }
                className="h-14 rounded-lg border border-ink/10 bg-sand/50 px-4 text-sm font-bold leading-none outline-none focus:border-marine dark:border-white/10 dark:bg-black/20"
              >
                <option value="repost">Repost</option>
                <option value="like">Like</option>
                <option value="quote">Quote</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-[118px] flex-col justify-between rounded-lg border border-ink/10 bg-sand/50 p-4 transition focus-within:border-marine dark:border-white/10 dark:bg-black/20">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/45 dark:text-white/45">
                    CRC / action
                  </span>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={createForm.rewardCrc}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, rewardCrc: event.target.value }))}
                      aria-label="CRC reward per verified action"
                      className="h-9 min-w-0 bg-transparent font-display text-3xl font-black leading-none text-ink outline-none dark:text-white"
                    />
                    <span className="pb-1 text-xs font-black uppercase tracking-[0.12em] text-citrus">CRC</span>
                  </div>
                  <span className="text-[11px] font-bold leading-4 text-ink/45 dark:text-white/45">
                    Paid to each verified user.
                  </span>
                </label>
                <label className="flex min-h-[118px] flex-col justify-between rounded-lg border border-ink/10 bg-sand/50 p-4 transition focus-within:border-marine dark:border-white/10 dark:bg-black/20">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/45 dark:text-white/45">
                    Max payouts
                  </span>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={createForm.maxClaims}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, maxClaims: event.target.value }))}
                      aria-label="Maximum number of campaign payouts"
                      className="h-9 min-w-0 bg-transparent font-display text-3xl font-black leading-none text-ink outline-none dark:text-white"
                    />
                    <span className="pb-1 text-xs font-black uppercase tracking-[0.12em] text-ink/45 dark:text-white/45">
                      users
                    </span>
                  </div>
                  <span className="text-[11px] font-bold leading-4 text-ink/45 dark:text-white/45">
                    Campaign stops after this many claims.
                  </span>
                </label>
              </div>
              <div className="grid gap-3 rounded-lg border border-ink/10 bg-[#f0ede5] p-3 dark:border-white/10 dark:bg-white/5 sm:grid-cols-3">
                <MiniStat label="Reward pool" value={`${formatNumber(createCost.rewardPoolCrc)} CRC`} />
                <MiniStat
                  label="NF Society fee"
                  value={`${formatNumber(createCost.platformFeeCrc)} CRC (${formatPercentFromBps(creatorFeeTier.feeBps)})`}
                />
                <MiniStat label="Total" value={`${formatNumber(createCost.totalCrc)} CRC`} />
              </div>
              {isAuthenticated ? (
                <button
                  type="submit"
                  disabled={creating || !createReady}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-marine px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? "Creating draft" : createIssue ?? "Create payment draft"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openLogin}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
                >
                  <Wallet className="h-4 w-4" />
                  Connect to launch
                </button>
              )}
              </div>
              <CreatorCampaignPreview
                title={createTitle}
                description={createDescription}
                action={createForm.action}
                tweet={createTweet}
                rewardCrc={createRewardCrc}
                maxClaims={createMaxClaims}
                totalCrc={createCost.totalCrc}
                ready={createReady}
              />
            </div>
          </form>
            )}
          </div>

          {fundingPayment && (
            <div className="rounded-lg border border-marine/20 bg-marine/10 p-6 shadow-sm dark:border-sky-300/20 dark:bg-sky-300/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-marine dark:text-sky-300">
                    Payment required
                  </p>
                  <h2 className="mt-1 font-display text-xl font-black">
                    Pay {formatNumber(fundingPayment.amountCrc)} CRC to activate
                  </h2>
                </div>
                <span className="w-fit rounded-md bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-marine dark:bg-sky-300/10 dark:text-sky-300">
                  Pending payment
                </span>
              </div>
              <FundingBreakdown payment={fundingPayment} className="mt-4" />
              <PaymentQrCode
                paymentLink={fundingPayment.paymentLink}
                paymentData={fundingPayment.gameData}
                qrCode={fundingPayment.qrCode}
                isMiniApp={isMiniApp}
                className="mt-4"
              />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(120px,0.8fr)]">
                <button
                  type="button"
                  onClick={() => void payCampaignFunding()}
                  disabled={fundingAction === "pay" || primaryFundingSent}
                  aria-label={`Open payment for ${formatNumber(fundingPayment.amountCrc)} CRC`}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-marine px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {fundingAction === "pay" ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : primaryFundingSent ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{primaryFundingSent ? "Payment sent" : isMiniApp ? "Pay with passkey" : "Open payment"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void scanCampaignFunding()}
                  disabled={fundingAction === "scan"}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-[#fbfaf6] px-4 text-sm font-black text-ink transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white"
                >
                  {fundingAction === "scan" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <RefreshCw className="h-4 w-4 shrink-0" />}
                  <span className="truncate">Check payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => void cancelCampaignFunding()}
                  disabled={fundingAction === "cancel" || primaryFundingSent}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 text-sm font-black text-red-700 transition hover:bg-red-500/15 disabled:opacity-60 sm:col-span-2 2xl:col-span-1 dark:text-red-200"
                >
                  {fundingAction === "cancel" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                  <span className="truncate">Cancel draft</span>
                </button>
              </div>
              <FundingFeedbackNotice
                feedback={fundingFeedback?.campaignId === fundingPayment.campaignId ? fundingFeedback : null}
              />
            </div>
          )}
            </div>
          )}
      </section>
    </main>
  );
}

function FundingBreakdown({
  payment,
  className = "",
}: {
  payment: GarageCampaignFundingPayment;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 sm:grid-cols-3 ${className}`}>
      <MiniStat label="Reward pool" value={`${formatNumber(payment.rewardPoolCrc)} CRC`} />
      <MiniStat
        label="NF Society fee"
        value={`${formatNumber(payment.platformFeeCrc)} CRC (${formatPercentFromBps(payment.feeBps)})`}
      />
      <MiniStat label="Total due" value={`${formatNumber(payment.amountCrc)} CRC`} />
    </div>
  );
}

function FundingFeedbackNotice({ feedback }: { feedback: FundingFeedback | null }) {
  if (!feedback) return null;

  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold ${
        feedback.tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200"
      }`}
    >
      {feedback.tone === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span className="min-w-0">
        {feedback.message}
        {feedback.txHash && (
          <a
            href={`https://gnosisscan.io/tx/${feedback.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 font-black underline underline-offset-2"
          >
            View tx
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </span>
    </div>
  );
}

function PaymentQrCode({
  paymentLink,
  paymentData,
  qrCode,
  isMiniApp = false,
  compact = false,
  className = "",
}: {
  paymentLink: string;
  paymentData?: string;
  qrCode?: string | null;
  isMiniApp?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPaymentLink() {
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`grid gap-4 rounded-lg border border-ink/10 bg-[#fbfaf6] p-4 dark:border-white/10 dark:bg-white/10 ${
        compact ? "sm:grid-cols-[112px_minmax(0,1fr)]" : "sm:grid-cols-[144px_minmax(0,1fr)]"
      } ${className}`}
    >
      <div
        className={`flex items-center justify-center rounded-lg border border-ink/10 bg-white p-2 shadow-sm dark:border-white/10 ${
          compact ? "h-28 w-28" : "h-36 w-36"
        }`}
      >
        {isMiniApp ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md bg-[#f0ede5] text-center text-marine dark:bg-white/10 dark:text-sky-300">
            <ExternalLink className={compact ? "h-8 w-8" : "h-10 w-10"} />
            <span className="text-[10px] font-black uppercase tracking-[0.12em]">
              Fallback link
            </span>
          </div>
        ) : qrCode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCode} alt="CRC payment QR code" className="h-full w-full rounded-md" />
        ) : (
          <span className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-red-500">
            QR unavailable
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-marine dark:text-sky-300">
            {isMiniApp ? <ExternalLink className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
            {isMiniApp ? "Fallback link" : "Payment QR"}
          </p>
          <p className="mt-1 text-sm font-bold text-ink/60 dark:text-white/60">
            {isMiniApp
              ? "Pay directly with the Circles passkey. The checkout link stays here as a fallback."
              : "Scan with Circles on mobile, or copy the payment link."}
          </p>
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
            Payment data
          </span>
          <code className="block truncate rounded-md border border-ink/10 bg-[#f0ede5] px-3 py-2 text-[11px] font-bold text-ink/55 dark:border-white/10 dark:bg-white/10 dark:text-white/55">
            {paymentData || paymentLink}
          </code>
        </div>
        <button
          type="button"
          onClick={copyPaymentLink}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-xs font-black text-ink transition hover:bg-[#f0ede5] dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : isMiniApp ? "Copy fallback link" : "Copy payment link"}
        </button>
      </div>
    </div>
  );
}

function CreatorCampaignPreview({
  title,
  description,
  action,
  tweet,
  rewardCrc,
  maxClaims,
  totalCrc,
  ready,
}: {
  title: string;
  description: string;
  action: GarageXCampaign["action"];
  tweet: ReturnType<typeof parseXPostInput>;
  rewardCrc: number;
  maxClaims: number;
  totalCrc: number;
  ready: boolean;
}) {
  const safeReward = Number.isFinite(rewardCrc) && rewardCrc > 0 ? rewardCrc : 0;
  const safeClaims = Number.isFinite(maxClaims) && maxClaims > 0 ? maxClaims : 0;

  return (
    <div className="rounded-lg border border-ink/10 bg-[#fffdf8] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
          Campaign preview
        </p>
        <span
          className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            ready
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-citrus/10 text-citrus"
          }`}
        >
          {ready ? "Ready draft" : "Needs details"}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/8 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/75 dark:bg-white/10 dark:text-white/80">
            <Repeat2 className="h-3.5 w-3.5" />
            {ACTION_LABELS[action]}
          </span>
          <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
            {formatNumber(safeReward)} CRC
          </span>
          <span className="rounded-md bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-marine dark:text-sky-300">
            user-based settlement
          </span>
          <span className="rounded-md bg-ink/5 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/50 dark:bg-white/10 dark:text-white/55">
            {formatNumber(safeClaims)} slots
          </span>
        </div>
        <h3 className="mt-4 font-display text-2xl font-black tracking-tight">
          {title || "Campaign title"}
        </h3>
        {description ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/58 dark:text-white/62">
            {description}
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/58 dark:text-white/62">
            Add a short description so users understand the mission.
          </p>
        )}
        <p className="mt-2 text-xs font-bold leading-5 text-ink/45 dark:text-white/45">
          {tweet
            ? `Target post ${tweet.username ? `@${tweet.username}` : tweet.id}`
            : "Waiting for a valid X post."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Reward" value={`${formatNumber(safeReward)} CRC`} />
          <MiniStat label="Payouts" value={formatNumber(safeClaims)} />
          <MiniStat label="Fund total" value={`${formatNumber(totalCrc)} CRC`} />
        </div>
        {tweet && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs font-black text-marine hover:underline"
          >
            Open detected X post
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function campaignFillPercent(campaign: GarageXCampaign) {
  if (campaign.maxClaims <= 0) return 0;
  return Math.min(100, Math.round((campaign.stats.claims / campaign.maxClaims) * 100));
}

function campaignRemainingCrc(campaign: GarageXCampaign) {
  return Math.max(0, roundCrc(campaign.budgetCrc - campaign.stats.spentCrc));
}

function creatorCampaignStatus(campaign: GarageXCampaign) {
  if (campaign.status === "pending_payment") return "Pending payment";
  if (campaign.status === "active" && campaign.stats.remainingClaims <= 0) return "Spent";
  if (campaign.status === "active") return "Live";
  if (campaign.status === "cancelled") return "Cancelled";
  return campaign.status.replace(/_/g, " ");
}

function creatorCampaignTone(campaign: GarageXCampaign) {
  if (campaign.status === "pending_payment") return "bg-marine/10 text-marine dark:text-sky-300";
  if (campaign.status === "active" && campaign.stats.remainingClaims <= 0) return "bg-ink/8 text-ink/55 dark:bg-white/10 dark:text-white/60";
  if (campaign.status === "active") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (campaign.status === "cancelled") return "bg-red-500/10 text-red-700 dark:text-red-200";
  return "bg-citrus/10 text-citrus";
}

function qualityReportSummary(report: GarageCampaignQualityReport | null | undefined) {
  if (!report || report.totalClaims <= 0) return "No claims yet";
  const success = report.settlementSuccessRate === null ? "settlement pending" : `${formatNumber(report.settlementSuccessRate)}% settled`;
  return `${formatNumber(report.verifiedClaims)} verified - ${success} - ${formatNumber(report.xReads)} X reads`;
}

function QualitySplitRow({
  label,
  value,
  total,
  tone = "bg-marine",
}: {
  label: string;
  value: number;
  total: number;
  tone?: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.1em] text-ink/48 dark:text-white/50">
        <span>{label}</span>
        <span>{formatNumber(value)} / {formatNumber(percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CampaignQualityReportPanel({ report }: { report: GarageCampaignQualityReport | null | undefined }) {
  if (!report) return null;
  const hasClaims = report.totalClaims > 0;
  const trustValue =
    report.averageTrustScore === null
      ? "No score"
      : `${formatNumber(report.averageTrustScore)} avg / ${formatNumber(report.medianTrustScore)} med`;
  const paidOrPendingCrc = report.crcPending > 0
    ? `${formatNumber(report.crcPaid)} CRC paid + ${formatNumber(report.crcPending)} pending`
    : `${formatNumber(report.crcPaid)} CRC`;

  return (
    <details
      open={hasClaims}
      className="group mt-4 rounded-lg border border-ink/10 bg-[#fbfaf6] p-4 dark:border-white/10 dark:bg-black/20"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Campaign quality report
          </p>
          <p className="mt-1 text-sm font-black text-ink dark:text-white">
            {qualityReportSummary(report)}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>

      {hasClaims ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Verified claims" value={formatNumber(report.verifiedClaims)} />
            <MiniStat label="Settlement success" value={formatPercentValue(report.settlementSuccessRate)} />
            <MiniStat label="CRC paid" value={paidOrPendingCrc} />
            <MiniStat label="X reads" value={formatNumber(report.xReads)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Trust score" value={trustValue} />
            <MiniStat label="Trust coverage" value={formatPercentValue(report.trustCoverage)} />
            <MiniStat label="Cost / verified" value={report.costPerVerifiedClaim === null ? "-" : `${formatNumber(report.costPerVerifiedClaim)} CRC`} />
            <MiniStat label="Removed actions" value={formatNumber(report.removedActionClaims)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                Backer split
              </p>
              <div className="mt-3 grid gap-3">
                <QualitySplitRow label="Direct" value={report.backerSplit.direct} total={report.totalClaims} tone="bg-emerald-500" />
                <QualitySplitRow label="Indirect" value={report.backerSplit.indirect} total={report.totalClaims} tone="bg-marine" />
                <QualitySplitRow label="No link" value={report.backerSplit.none} total={report.totalClaims} tone="bg-citrus" />
                <QualitySplitRow label="Unknown" value={report.backerSplit.unknown} total={report.totalClaims} tone="bg-ink/40 dark:bg-white/40" />
              </div>
            </div>

            <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                Trust bands
              </p>
              <div className="mt-3 grid gap-3">
                <QualitySplitRow label="High 70+" value={report.trustBands.high} total={report.totalClaims} tone="bg-emerald-500" />
                <QualitySplitRow label="Medium 40-69" value={report.trustBands.medium} total={report.totalClaims} tone="bg-marine" />
                <QualitySplitRow label="Low <40" value={report.trustBands.low} total={report.totalClaims} tone="bg-citrus" />
                <QualitySplitRow label="No score" value={report.trustBands.unknown} total={report.totalClaims} tone="bg-ink/40 dark:bg-white/40" />
              </div>
            </div>
          </div>

          {(report.pendingSettlementClaims > 0 || report.payoutFailedClaims > 0) && (
            <p className="text-xs font-bold leading-5 text-ink/50 dark:text-white/52">
              {formatNumber(report.pendingSettlementClaims)} claim(s) still in settlement and {formatNumber(report.payoutFailedClaims)} payout failure(s) are separated from removed actions.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-ink/10 bg-[#f0ede5] p-3 text-sm font-bold text-ink/52 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
          Quality data appears after users start verifying this boost.
        </p>
      )}
    </details>
  );
}

function CreatorDashboard({
  campaigns,
  isAuthenticated,
  isMiniApp,
  creatorProfileHref,
  onConnect,
  onPay,
  onScan,
  onCancel,
  onCreateFocus,
  fundingAction,
  fundingFeedback,
  fundingSentTxs,
}: {
  campaigns: GarageXCampaign[];
  isAuthenticated: boolean;
  isMiniApp: boolean;
  creatorProfileHref: string | null;
  onConnect: () => void;
  onPay: (payment: GarageCampaignFundingPayment) => void;
  onScan: (payment: GarageCampaignFundingPayment) => void;
  onCancel: (payment: GarageCampaignFundingPayment) => void;
  onCreateFocus: () => void;
  fundingAction: "pay" | "scan" | "cancel" | null;
  fundingFeedback: FundingFeedback | null;
  fundingSentTxs: FundingSentState;
}) {
  const stats = campaigns.reduce(
    (acc, campaign) => {
      if (campaign.status === "active") {
        acc.rewardPool += campaign.budgetCrc;
        acc.fees += campaign.platformFeeCrc;
        acc.paid += campaign.stats.spentCrc;
        acc.remaining += campaignRemainingCrc(campaign);
        if (campaign.stats.remainingClaims > 0) acc.live += 1;
        else acc.spent += 1;
      }
      if (campaign.status === "pending_payment") acc.pending += 1;
      if (campaign.status === "cancelled") acc.cancelled += 1;
      return acc;
    },
    { rewardPool: 0, fees: 0, paid: 0, remaining: 0, live: 0, pending: 0, spent: 0, cancelled: 0 },
  );
  const campaignGroups = [
    {
      key: "pending",
      title: "Pending payment",
      description: "Drafts waiting for CRC funding.",
      items: campaigns.filter((campaign) => campaign.status === "pending_payment"),
    },
    {
      key: "live",
      title: "Live",
      description: "Funded boosts users can claim now.",
      items: campaigns.filter((campaign) => campaign.status === "active" && campaign.stats.remainingClaims > 0),
    },
    {
      key: "spent",
      title: "Spent",
      description: "Funded boosts with no payouts left.",
      items: campaigns.filter((campaign) => campaign.status === "active" && campaign.stats.remainingClaims <= 0),
    },
    {
      key: "cancelled",
      title: "Cancelled",
      description: "Drafts cancelled before payment.",
      items: campaigns.filter((campaign) => campaign.status === "cancelled"),
    },
  ].filter((group) => group.items.length > 0);
  const [openCampaignGroups, setOpenCampaignGroups] = useState<Record<string, boolean>>({});

  return (
    <section className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Creator dashboard
          </p>
          <h2 className="mt-1 font-display text-xl font-black">My boosts</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {creatorProfileHref && (
            <Link
              href={creatorProfileHref}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-ink/10 bg-[#f0ede5] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-ink/65 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white/70"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View creator profile
            </Link>
          )}
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-citrus/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-citrus">
            <CircleDollarSign className="h-3.5 w-3.5" />
            NF Society fee
          </span>
        </div>
      </div>

      {!isAuthenticated ? (
        <button
          type="button"
          onClick={onConnect}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
        >
          <Wallet className="h-4 w-4" />
          Connect wallet to view boosts
        </button>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Live" value={formatNumber(stats.live)} />
            <MiniStat label="Pending" value={formatNumber(stats.pending)} />
            <MiniStat label="Spent" value={formatNumber(stats.spent)} />
            <MiniStat label="Cancelled" value={formatNumber(stats.cancelled)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Pool funded" value={`${formatNumber(stats.rewardPool)} CRC`} />
            <MiniStat label="NF fees" value={`${formatNumber(stats.fees)} CRC`} />
            <MiniStat label="Paid to users" value={`${formatNumber(stats.paid)} CRC`} />
            <MiniStat label="Unspent rewards" value={`${formatNumber(stats.remaining)} CRC`} />
          </div>

          <div className="mt-6 space-y-6">
            {campaignGroups.length ? (
              campaignGroups.map((group) => {
                const defaultOpen = group.key === "live" || group.key === "pending";
                const isOpen = openCampaignGroups[group.key] ?? defaultOpen;

                return (
                <div
                  key={group.key}
                  className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0 dark:border-white/10"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCampaignGroups((openGroups) => ({
                        ...openGroups,
                        [group.key]: !(openGroups[group.key] ?? defaultOpen),
                      }))
                    }
                    aria-expanded={isOpen}
                    className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                        {group.title}
                      </p>
                      <p className="text-xs font-bold text-ink/45 dark:text-white/45">
                        {group.description}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-md bg-ink/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink/50 dark:bg-white/10 dark:text-white/55">
                      {formatNumber(group.items.length)}
                      <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {isOpen && (
                  <div className="mt-3 space-y-3">
                    {group.items.map((campaign) => {
                const fill = campaignFillPercent(campaign);
                const funding = campaign.fundingPayment ?? null;
                const paymentSent = funding ? hasFundingSent(fundingSentTxs, funding.campaignId) : false;
                return (
                  <div
                    key={campaign.id}
                    className="rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${creatorCampaignTone(campaign)}`}>
                            {creatorCampaignStatus(campaign)}
                          </span>
                          <span className="rounded-md bg-ink/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink/50 dark:bg-white/10 dark:text-white/55">
                            {ACTION_LABELS[campaign.action]}
                          </span>
                        </div>
                        <h3 className="mt-3 truncate font-display text-xl font-black">{campaign.title}</h3>
                        <p className="mt-1 text-xs font-bold text-ink/45 dark:text-white/45">
                          {formatNumber(campaign.rewardCrc)} CRC/action - {formatNumber(campaign.stats.claims)} of{" "}
                          {formatNumber(campaign.maxClaims)} claims
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {campaign.tweetUrl && (
                          <a
                            href={campaign.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 bg-[#fbfaf6] px-3 text-xs font-black text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
                          >
                            X post
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {campaign.fundingTxHash && (
                          <a
                            href={`https://gnosisscan.io/tx/${campaign.fundingTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 bg-[#fbfaf6] px-3 text-xs font-black text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
                          >
                            Funding tx
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <MiniStat label="Reward pool" value={`${formatNumber(campaign.budgetCrc)} CRC`} />
                      <MiniStat label="NF fee" value={`${formatNumber(campaign.platformFeeCrc)} CRC`} />
                      <MiniStat label="Paid" value={`${formatNumber(campaign.stats.spentCrc)} CRC`} />
                      <MiniStat label="Remaining" value={`${formatNumber(campaignRemainingCrc(campaign))} CRC`} />
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
                        <span>Fill</span>
                        <span>{fill}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                        <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${fill}%` }} />
                      </div>
                    </div>

                    <CampaignQualityReportPanel report={campaign.qualityReport} />

                    {funding && (
                      <div className="mt-4 rounded-lg border border-marine/20 bg-marine/10 p-4 dark:border-sky-300/20 dark:bg-sky-300/10">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-marine dark:text-sky-300">
                              Payment required
                            </p>
                            <h4 className="mt-1 font-display text-lg font-black">
                              Pay {formatNumber(funding.amountCrc)} CRC to activate
                            </h4>
                          </div>
                          <span className="w-fit rounded-md bg-marine/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-marine dark:bg-sky-300/10 dark:text-sky-300">
                            Pending
                          </span>
                        </div>
                        <FundingBreakdown payment={funding} className="mt-3" />
                        <PaymentQrCode
                          paymentLink={funding.paymentLink}
                          paymentData={funding.gameData}
                          qrCode={funding.qrCode}
                          isMiniApp={isMiniApp}
                          compact
                          className="mt-3"
                        />
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(120px,0.8fr)]">
                          <button
                            type="button"
                            onClick={() => onPay(funding)}
                            disabled={fundingAction === "pay" || paymentSent}
                            aria-label={`Open payment for ${formatNumber(funding.amountCrc)} CRC`}
                            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md bg-marine px-3 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-60"
                          >
                            {fundingAction === "pay" ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : paymentSent ? (
                              <Check className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{paymentSent ? "Payment sent" : isMiniApp ? "Pay with passkey" : "Open payment"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onScan(funding)}
                            disabled={fundingAction === "scan"}
                            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-ink/10 bg-[#fbfaf6] px-3 text-xs font-black text-ink transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white"
                          >
                            {fundingAction === "scan" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">Check payment</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancel(funding)}
                            disabled={fundingAction === "cancel" || paymentSent}
                            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 text-xs font-black text-red-700 transition hover:bg-red-500/15 disabled:opacity-60 sm:col-span-2 2xl:col-span-1 dark:text-red-200"
                          >
                            {fundingAction === "cancel" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">Cancel draft</span>
                          </button>
                        </div>
                        <FundingFeedbackNotice
                          feedback={fundingFeedback?.campaignId === funding.campaignId ? fundingFeedback : null}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
                  </div>
                  )}
                </div>
                );
              })
            ) : (
              <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-5 dark:border-white/10 dark:bg-white/5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#fbfaf6] text-ink/45 dark:bg-white/10 dark:text-white/45">
                  <Plus className="h-5 w-5" />
                </span>
                <p className="mt-3 font-display text-lg font-black">No boosts created yet.</p>
                <p className="mt-1 text-sm font-bold leading-6 text-ink/52 dark:text-white/55">
                  Create a draft, fund the reward pool, then activate it once the CRC payment is detected.
                </p>
                <button
                  type="button"
                  onClick={onCreateFocus}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-ink/90 dark:bg-white dark:text-ink"
                >
                  <Plus className="h-4 w-4" />
                  Create first boost
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ReferralActivityList({
  activity,
  profiles,
}: {
  activity: GarageReferralActivity[];
  profiles: Record<string, CirclesProfile>;
}) {
  const activeWallets = activity.filter((entry) => entry.missions > 0).length;

  return (
    <details className="group mt-4 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Referral tracking
          </p>
          <h3 className="font-display text-lg font-black">Invited wallets</h3>
          <p className="mt-1 text-xs font-bold text-ink/50 dark:text-white/50">
            {formatNumber(activity.length)} invited - {formatNumber(activeWallets)} with missions
          </p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#fbfaf6] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
          <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {activity.length ? (
          activity.map((entry) => {
            const profile = profiles[entry.referredAddress.toLowerCase()];
            const displayName = profile?.name || shortAddress(entry.referredAddress);
            const trustValue = formatTrustValue(entry.trustScore, entry.trustLevel);
            const missionLabel = entry.missions === 1 ? "mission" : "missions";
            const crcLabel =
              entry.claimableCrc > 0
                ? `${formatNumber(entry.claimableCrc)} CRC claimable`
                : entry.pendingCrc > 0
                  ? `${formatNumber(entry.pendingCrc)} CRC claiming`
                  : entry.claimedCrc > 0
                    ? `${formatNumber(entry.claimedCrc)} CRC claimed`
                    : "0 CRC unlocked";

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-md border border-ink/10 bg-[#fbfaf6] px-3 py-3 dark:border-white/10 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {profile?.imageUrl ? (
                    <img
                      src={profile.imageUrl}
                      alt={displayName}
                      className="h-10 w-10 shrink-0 rounded-full border border-ink/10 object-cover dark:border-white/10"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-[#f0ede5] text-sm font-black text-ink/45 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
                      {displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-black leading-tight sm:max-w-[230px]">
                      {displayName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-ink/45 dark:text-white/45">
                      <span>{shortAddress(entry.referredAddress)}</span>
                      <span>invited {formatDateTime(entry.createdAt)}</span>
                      {entry.lastMissionAt ? <span>last mission {formatDateTime(entry.lastMissionAt)}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase sm:justify-end">
                  <MetricPill tone={referralMetricTone(entry.status)}>{referralActivityLabel(entry.status)}</MetricPill>
                  <MetricPill>{formatNumber(entry.missions)} {missionLabel}</MetricPill>
                  <MetricPill>{crcLabel}</MetricPill>
                  <MetricPill tone="muted">{formatMultiplier(entry.qualityMultiplier)}</MetricPill>
                  <BackerStatusBadge status={entry.backerStatus} size="compact" />
                  {trustValue ? (
                    <MetricPill tone="muted">Trust {trustValue}</MetricPill>
                  ) : (
                    <MetricPill tone="muted">Trust pending</MetricPill>
                  )}
                  {entry.mutualCount > 0 ? (
                    <MetricPill tone="muted">{formatNumber(entry.mutualCount)} mutual</MetricPill>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-ink/10 bg-[#fbfaf6] p-4 text-sm font-bold text-ink/52 dark:border-white/10 dark:bg-black/20 dark:text-white/55">
            No invited wallets yet. Share your link, then each invited wallet will appear here.
          </div>
        )}
      </div>
    </details>
  );
}

function GarageLeaderboard({
  entries,
  profiles,
}: {
  entries: GarageLeaderboardEntry[];
  profiles: Record<string, CirclesProfile>;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Leaderboard
          </p>
          <h2 className="mt-1 font-display text-xl font-black">Top Circles profiles</h2>
          <p className="mt-1 text-sm font-bold leading-6 text-ink/52 dark:text-white/55">
            Ranked by CRC earned, then verified missions.
          </p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
          <Trophy className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {entries.length ? (
          entries.map((entry, index) => {
            const profile = profiles[entry.walletAddress.toLowerCase()];
            const displayName = profile?.name || (entry.xUsername ? `@${entry.xUsername}` : shortAddress(entry.walletAddress));
            const profileHref = creatorProfilePath(entry.walletAddress, profile);
            const trustValue = trustSummaryValue(entry.trustProfile);
            const pendingText = entry.crcPending > 0 ? ` + ${formatNumber(entry.crcPending)} pending` : "";
            const missionLabel = entry.actions === 1 ? "mission" : "missions";

            return (
              <div
                key={entry.walletAddress}
                className="flex flex-col gap-3 rounded-md border border-ink/10 bg-[#f0ede5] px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-black text-white dark:bg-white dark:text-ink">
                    {index + 1}
                  </span>
                  {profileHref && profile?.imageUrl ? (
                    <Link href={profileHref} className="shrink-0 rounded-full">
                      <img
                        src={profile.imageUrl}
                        alt={displayName}
                        className="h-10 w-10 rounded-full border border-ink/10 object-cover transition hover:border-marine/40 dark:border-white/10"
                      />
                    </Link>
                  ) : profile?.imageUrl ? (
                    <img
                      src={profile.imageUrl}
                      alt={displayName}
                      className="h-10 w-10 shrink-0 rounded-full border border-ink/10 object-cover dark:border-white/10"
                    />
                  ) : (
                    profileHref ? (
                      <Link
                        href={profileHref}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-[#fbfaf6] text-sm font-black text-ink/45 transition hover:border-marine/40 dark:border-white/10 dark:bg-white/10 dark:text-white/45"
                      >
                        {displayName.slice(0, 1).toUpperCase()}
                      </Link>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-[#fbfaf6] text-sm font-black text-ink/45 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
                        {displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )
                  )}
                  <div className="min-w-0">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="inline-flex max-w-full items-center gap-1.5 truncate font-display text-base font-black leading-tight text-ink transition hover:text-marine dark:text-white dark:hover:text-sky-300 sm:max-w-[220px]"
                      >
                        <span className="truncate">{displayName}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                    ) : (
                      <p className="truncate font-display text-base font-black leading-tight sm:max-w-[220px]">
                        {displayName}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-ink/45 dark:text-white/45">
                      {entry.xUsername && (
                        <a
                          href={`https://x.com/${entry.xUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-black text-marine hover:underline"
                        >
                          @{entry.xUsername}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span>{shortAddress(entry.walletAddress)}</span>
                      {entry.lastClaimAt && <span>{formatDateTime(entry.lastClaimAt)}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase sm:justify-end">
                  <MetricPill>{formatNumber(entry.crcEarned)} CRC earned{pendingText}</MetricPill>
                  <MetricPill>{formatNumber(entry.actions)} {missionLabel}</MetricPill>
                  {entry.trustProfile ? (
                    <BackerStatusBadge status={entry.trustProfile.backerStatus} size="compact" />
                  ) : (
                    <MetricPill tone="muted">Status pending</MetricPill>
                  )}
                  {trustValue ? (
                    <MetricPill tone="muted">Trust {trustValue}</MetricPill>
                  ) : null}
                  {entry.trustProfile?.mutualCount ? (
                    <MetricPill tone="muted">{formatNumber(entry.trustProfile.mutualCount)} mutual</MetricPill>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-5 text-center dark:border-white/10 dark:bg-white/5">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#fbfaf6] text-ink/45 dark:bg-white/10 dark:text-white/45">
              <Trophy className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-lg font-black">No ranked wallets yet.</p>
            <p className="mt-1 text-sm font-bold leading-6 text-ink/52 dark:text-white/55">
              The leaderboard fills automatically after verified missions pay CRC on-chain.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LatestPayoutTicker({
  payout,
  profile,
}: {
  payout: GarageRecentPayout | null | undefined;
  profile?: CirclesProfile;
}) {
  if (!payout) {
    return (
      <div className="inline-flex h-[52px] max-w-full items-center gap-2 rounded-2xl border border-ink/10 bg-[#f0ede5]/95 px-3 text-ink shadow-[0_18px_42px_-34px_rgba(37,27,159,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#19171d]/95 dark:text-white dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.72)]">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-[#fbfaf6]/80 text-ink/60 dark:border-white/10 dark:bg-white/10 dark:text-white/65">
          <CircleDollarSign className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Latest payout
          </span>
          <span className="block truncate text-[11px] font-black text-ink/68 dark:text-white/68">
            Waiting for CRC
          </span>
        </span>
      </div>
    );
  }

  const displayName = profile?.name || (payout.xUsername ? `@${payout.xUsername}` : shortAddress(payout.walletAddress));
  const action = ACTION_LABELS[payout.action as GarageXCampaign["action"]] ?? payout.action;
  const txHref = payout.payoutTxHash ? `https://gnosisscan.io/tx/${payout.payoutTxHash}` : null;
  const content = (
    <>
      {profile?.imageUrl ? (
        <img
          src={profile.imageUrl}
          alt={displayName}
          className="h-8 w-8 shrink-0 rounded-xl border border-ink/10 object-cover dark:border-white/10"
        />
      ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-emerald-500/10 text-emerald-700 dark:border-white/10 dark:text-emerald-300">
          <CircleDollarSign className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            Latest payout
          </span>
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
            +{formatNumber(payout.campaignRewardCrc)}
          </span>
        </span>
        <span className="mt-0.5 block max-w-[190px] truncate text-[11px] font-black text-ink/72 dark:text-white/72">
          {displayName} - {action}
        </span>
      </span>
      {txHref ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink/45 dark:text-white/45" /> : null}
    </>
  );
  const className =
    "inline-flex h-[52px] max-w-full items-center gap-2 rounded-2xl border border-emerald-600/18 bg-emerald-50/80 px-3 text-ink shadow-[0_18px_42px_-34px_rgba(16,185,129,0.5)] backdrop-blur-xl transition hover:border-emerald-600/30 hover:bg-emerald-50 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-white dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.72)] dark:hover:bg-emerald-300/15";

  if (!txHref) {
    return <div className={className}>{content}</div>;
  }

  return (
    <a href={txHref} target="_blank" rel="noopener noreferrer" className={className} title={`Tx ${shortHash(payout.payoutTxHash)}`}>
      {content}
    </a>
  );
}

function CampaignCreatorLink({
  campaign,
  profile,
}: {
  campaign: GarageXCampaign;
  profile: CirclesProfile | null;
}) {
  const href = creatorProfilePath(campaign.createdByAddress, profile);
  if (!href || !campaign.createdByAddress) return null;

  const displayName = profile?.name?.trim() || shortAddress(campaign.createdByAddress);
  const backerStatus = normalizedBackerStatus(campaign.ranking?.creatorBackerStatus);
  const trustValue = formatTrustValue(campaign.ranking?.creatorTrustScore, campaign.ranking?.creatorTrustLevel);

  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-lg border border-ink/10 bg-[#f0ede5] p-2.5 text-left transition hover:border-marine/30 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      {profile?.imageUrl ? (
        <img
          src={profile.imageUrl}
          alt={displayName}
          className="h-10 w-10 shrink-0 rounded-full border border-ink/10 object-cover dark:border-white/10"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-[#fbfaf6] text-sm font-black text-ink/45 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
          Created by
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="truncate font-display text-sm font-black text-ink group-hover:text-marine dark:text-white dark:group-hover:text-sky-300">
            {displayName}
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink/35 group-hover:text-marine dark:text-white/35 dark:group-hover:text-sky-300" />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${backerStatusTone(backerStatus)}`}>
            {BACKER_STATUS_LABELS[backerStatus]}
          </span>
          {trustValue ? (
            <span className="rounded-full bg-ink/6 px-2 py-0.5 text-[9px] font-black uppercase text-ink/55 dark:bg-white/10 dark:text-white/60">
              Trust {trustValue}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function CampaignCard({
  campaign,
  creatorProfile,
  isMiniApp,
  showXLink,
  verifying,
  disabled,
  onVerify,
  onOpen,
  now,
  settlementSeconds,
  feedback,
}: {
  campaign: GarageXCampaign;
  creatorProfile: CirclesProfile | null;
  isMiniApp: boolean;
  showXLink: boolean;
  verifying: boolean;
  disabled: boolean;
  onVerify: () => void;
  onOpen: () => void;
  now: number;
  settlementSeconds: number;
  feedback: CampaignFeedback | null;
}) {
  const timeRemaining = claimTimeRemaining(campaign.claimedByMe ?? null, now);
  const claimProgress = campaign.maxClaims > 0
    ? Math.min(100, Math.round((campaign.stats.claims / campaign.maxClaims) * 100))
    : 0;
  const rankingReasons = campaign.ranking?.reasons ?? [];

  return (
    <article className="overflow-hidden rounded-lg border border-ink/10 bg-[#fbfaf6] shadow-[0_18px_48px_-38px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-white/5">
      <div className="border-b border-ink/10 bg-[#fffdf8] p-6 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/8 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/75 dark:bg-white/10 dark:text-white/80">
              <Repeat2 className="h-3.5 w-3.5" />
              {ACTION_LABELS[campaign.action]}
            </span>
            <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              {formatNumber(campaign.rewardCrc)} CRC
            </span>
            <span className="rounded-md bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-marine dark:text-sky-300">
              {formatDurationShort(settlementSeconds)} for you
            </span>
            <span className="rounded-md bg-ink/5 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/50 dark:bg-white/10 dark:text-white/55">
              {formatNumber(campaign.stats.remainingClaims)} left
            </span>
            {rankingReasons.map((reason) => (
              <span
                key={reason}
                className="rounded-md bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-marine dark:bg-sky-300/10 dark:text-sky-300"
              >
                {reason}
              </span>
            ))}
          </div>
          <h2 className="mt-4 font-display text-3xl font-black tracking-tight">{campaign.title}</h2>
          {campaign.description && (
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-ink/58 dark:text-white/62">
              {campaign.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:w-[280px] lg:items-stretch">
          {campaign.claimedByMe ? (
            <span className={`w-fit rounded-md px-3 py-1.5 text-xs font-black uppercase lg:ml-auto ${claimTone(campaign.claimedByMe.status)}`}>
              {claimStatusLabel(campaign.claimedByMe.status)}
            </span>
          ) : (
            <span className="w-fit rounded-md bg-citrus/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-citrus lg:ml-auto">
              Live boost
            </span>
          )}
          <CampaignCreatorLink campaign={campaign} profile={creatorProfile} />
        </div>
      </div>
      </div>

      <div className="p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Budget" value={`${formatNumber(campaign.budgetCrc)} CRC`} />
        <Metric label="Claims" value={`${formatNumber(campaign.stats.claims)} / ${formatNumber(campaign.maxClaims)}`} />
        <Metric label="Spent" value={`${formatNumber(campaign.stats.spentCrc)} CRC`} />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
          <span>Campaign fill</span>
          <span>{claimProgress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${claimProgress}%` }} />
        </div>
      </div>

      {campaign.claimedByMe && (
        <div className="mt-5 grid gap-4 rounded-lg border border-ink/10 bg-[#f0ede5] p-4 text-xs font-bold text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/65 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 dark:text-white/40">Proof</p>
            <p className="mt-1 font-black text-ink dark:text-white">
              {evidenceLabel(campaign.claimedByMe.verificationEvidence)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 dark:text-white/40">X reads</p>
            <p className="mt-1 font-black text-ink dark:text-white">
              {formatNumber(campaign.claimedByMe.verificationChecked)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 dark:text-white/40">
              {campaign.claimedByMe.payoutTxHash ? "Tx" : timeRemaining > 0 ? "Countdown" : "Settlement"}
            </p>
            {campaign.claimedByMe.payoutTxHash ? (
              <a
                href={`https://gnosisscan.io/tx/${campaign.claimedByMe.payoutTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-black text-marine hover:underline"
              >
                {shortHash(campaign.claimedByMe.payoutTxHash)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : timeRemaining > 0 ? (
              <p className="mt-1 font-display text-lg font-black text-marine">
                {formatDuration(timeRemaining)}
              </p>
            ) : (
              <p className="mt-1 font-black text-ink dark:text-white">
                {formatDateTime(campaign.claimedByMe.payoutAvailableAt) ?? "Pending"}
              </p>
            )}
          </div>
        </div>
      )}

      {campaign.claimedByMe?.payoutTxHash && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-200">
          <Check className="h-4 w-4" />
          CRC sent on-chain. Wallet apps can take a few seconds to refresh.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {campaign.tweetUrl && (
          <a
            href={campaign.tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink/15 bg-[#fffdf8] px-4 py-3 text-sm font-black text-ink transition hover:bg-ink/5 dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            Open on X
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onVerify}
          disabled={disabled}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white dark:text-ink"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          {timeRemaining > 0 ? `Re-check in ${formatDuration(timeRemaining)}` : campaignButtonLabel(campaign, verifying, disabled && campaign.id <= 0)}
          {!verifying && !campaign.claimedByMe && <ArrowUpRight className="h-4 w-4" />}
        </button>
      </div>
      {isMiniApp && campaign.tweetUrl && (
        <p className="mt-2 text-xs font-bold leading-5 text-ink/52 dark:text-white/55">
          Playground: desktop Ctrl/Cmd-click Open on X. Mobile: tap once to show the link, then long-press it and open outside.
        </p>
      )}
      {feedback && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-bold ${
            feedback.tone === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.tone === "success" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0">
            {feedback.message}
            {feedback.txHash && (
              <a
                href={`https://gnosisscan.io/tx/${feedback.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 font-black underline underline-offset-2"
              >
                View tx
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </span>
        </div>
      )}
      {isMiniApp && showXLink && campaign.tweetUrl && (
        <div className="mt-3 rounded-lg border border-marine/20 bg-marine/10 p-3 dark:border-sky-300/20 dark:bg-sky-300/10">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-marine dark:text-sky-300">
            X link
          </p>
          <input
            readOnly
            value={campaign.tweetUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-10 w-full rounded-md border border-ink/10 bg-[#fffdf8] px-3 text-xs font-bold text-ink outline-none dark:border-white/10 dark:bg-black/20 dark:text-white"
            aria-label="X post link"
          />
          <p className="mt-2 text-xs font-bold leading-5 text-ink/52 dark:text-white/55">
            Desktop: Ctrl/Cmd-click Open on X. Mobile: long-press this link, open it outside the Playground, then return here to verify.
          </p>
        </div>
      )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-[#f0ede5] p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">{label}</p>
      <p className="mt-1 truncate font-display text-xl font-black">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-[#f0ede5] px-3.5 py-3.5 dark:border-white/15 dark:bg-white/5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">{label}</p>
      <p className="mt-1 break-words font-display text-lg font-black leading-tight">{value}</p>
    </div>
  );
}

function DashboardStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-ink/42 dark:text-white/42">
            {label}
          </p>
          <p className="mt-0.5 truncate font-display text-2xl font-black tracking-tight">{value}</p>
        </div>
      </div>
      <p className="mt-4 truncate text-xs font-bold text-ink/50 dark:text-white/55">{detail}</p>
    </div>
  );
}

function FlowStep({
  icon: Icon,
  step,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/70 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-citrus">{step}</p>
        <h3 className="mt-0.5 font-display text-lg font-black leading-tight">{title}</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-ink/52 dark:text-white/55">{detail}</p>
      </div>
    </div>
  );
}

function StatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/8">
          <Icon className="h-4 w-4 text-white/70" />
        </span>
        <span className="text-sm font-bold text-white/68">{label}</span>
      </div>
      <span className="font-display text-xl font-black">{value}</span>
    </div>
  );
}

function MarketStatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-[#fbfaf6]/75 p-3 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-[#f0ede5] text-ink/62 dark:border-white/10 dark:bg-white/10 dark:text-white/70">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-bold text-ink/68 dark:text-white/68">{label}</span>
      </div>
      <span className="shrink-0 text-right font-display text-xl font-black">{value}</span>
    </div>
  );
}

function ProofPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "success" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100"
      : tone === "warn"
        ? "border-citrus/35 bg-citrus/15 text-orange-800 dark:text-orange-100"
        : "border-ink/12 bg-ink/6 text-ink/72 dark:border-white/10 dark:bg-white/10 dark:text-white/75";

  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="text-current/80">{value}</span>
    </span>
  );
}
