"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Megaphone,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";

type BackerStatus = "direct" | "indirect" | "none" | "unknown";

type QualityReport = {
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
  trustBands: { high: number; medium: number; low: number; unknown: number };
  backerSplit: { direct: number; indirect: number; none: number; unknown: number };
};

type CreatorCampaign = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  action: string;
  tweetUrl: string | null;
  rewardCrc: number;
  budgetCrc: number;
  maxClaims: number;
  status: string;
  platformFeeCrc: number;
  createdAt: string;
  stats: {
    claims: number;
    remainingClaims: number;
    spentCrc: number;
  };
  qualityReport: QualityReport | null;
};

type CreatorReputationData = {
  creator: {
    address: string;
    slug: string;
    profile: {
      name: string;
      imageUrl: string | null;
    };
    xAccount: {
      username: string;
      displayName: string | null;
    } | null;
    trustProfile: {
      trustScore: number | null;
      trustLevel: string | null;
      mutualCount: number;
      backerStatus: BackerStatus;
      directBacker: boolean;
      indirectBackerTrustCount: number;
      lastFetchedAt: string;
    } | null;
  };
  stats: {
    campaignsFunded: number;
    liveCampaigns: number;
    spentCampaigns: number;
    pendingCampaigns: number;
    cancelledCampaigns: number;
    rewardPoolCrc: number;
    platformFeeCrc: number;
    crcPaid: number;
    crcPending: number;
    verifiedClaims: number;
    paidClaims: number;
    removedActionClaims: number;
    touchedWallets: number;
    xReads: number;
    settlementSuccessRate: number | null;
    averageClaimantTrust: number | null;
  };
  campaigns: CreatorCampaign[];
};

function shortAddress(address: string | null | undefined) {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Pending";
  return `${formatNumber(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

function trustLabel(profile: CreatorReputationData["creator"]["trustProfile"]) {
  if (!profile || profile.trustScore === null) return "Trust pending";
  return profile.trustLevel ? `${profile.trustScore} / ${profile.trustLevel}` : String(profile.trustScore);
}

function backerLabel(status: BackerStatus | null | undefined) {
  if (status === "direct") return "Direct backer";
  if (status === "indirect") return "Indirect backer";
  if (status === "none") return "No backer link";
  return "Backer pending";
}

function backerTone(status: BackerStatus | null | undefined) {
  if (status === "direct") return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (status === "indirect") return "bg-marine/10 text-marine dark:text-sky-300";
  if (status === "none") return "bg-citrus/10 text-citrus";
  return "bg-ink/8 text-ink/55 dark:bg-white/10 dark:text-white/60";
}

function campaignStatusLabel(campaign: CreatorCampaign) {
  if (campaign.status === "pending_payment") return "Pending payment";
  if (campaign.status === "active" && campaign.stats.remainingClaims <= 0) return "Spent";
  if (campaign.status === "active") return "Live";
  if (campaign.status === "cancelled") return "Cancelled";
  return campaign.status.replace(/_/g, " ");
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
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

function SplitRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.1em] text-ink/48 dark:text-white/50">
        <span>{label}</span>
        <span>
          {formatNumber(value)} / {formatNumber(percent)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-marine" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CreatorCampaign }) {
  const report = campaign.qualityReport;
  const fill = campaign.maxClaims > 0 ? Math.min(100, Math.round((campaign.stats.claims / campaign.maxClaims) * 100)) : 0;

  return (
    <article className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              {campaignStatusLabel(campaign)}
            </span>
            <span className="rounded-md bg-ink/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink/50 dark:bg-white/10 dark:text-white/55">
              {campaign.action}
            </span>
          </div>
          <h3 className="mt-3 truncate font-display text-xl font-black">{campaign.title}</h3>
          {campaign.description && (
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-ink/55 dark:text-white/55">
              {campaign.description}
            </p>
          )}
          <p className="mt-2 text-xs font-bold text-ink/45 dark:text-white/45">
            {formatNumber(campaign.rewardCrc)} CRC/action - created {formatDate(campaign.createdAt)}
          </p>
        </div>
        {campaign.tweetUrl && (
          <a
            href={campaign.tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-ink/10 bg-[#f0ede5] px-3 text-xs font-black text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            X post
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Pool" value={`${formatNumber(campaign.budgetCrc)} CRC`} detail="funded" icon={CircleDollarSign} />
        <StatCard label="Claims" value={`${formatNumber(campaign.stats.claims)} / ${formatNumber(campaign.maxClaims)}`} detail={`${formatNumber(fill)}% fill`} icon={Trophy} />
        <StatCard label="Paid" value={`${formatNumber(report?.crcPaid ?? 0)} CRC`} detail="settled payout" icon={Wallet} />
        <StatCard label="Quality" value={formatPercent(report?.settlementSuccessRate)} detail="settlement success" icon={ShieldCheck} />
      </div>
    </article>
  );
}

export default function CreatorReputationPage({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<CreatorReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/garage/creators/${encodeURIComponent(creatorId)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Creator not found");
        return payload as CreatorReputationData;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const aggregateSplit = useMemo(() => {
    const base = {
      backer: { direct: 0, indirect: 0, none: 0, unknown: 0 },
      trust: { high: 0, medium: 0, low: 0, unknown: 0 },
      total: 0,
    };
    if (!data) return base;
    return data.campaigns.reduce((acc, campaign) => {
      const report = campaign.qualityReport;
      if (!report) return acc;
      acc.total += report.totalClaims;
      acc.backer.direct += report.backerSplit.direct;
      acc.backer.indirect += report.backerSplit.indirect;
      acc.backer.none += report.backerSplit.none;
      acc.backer.unknown += report.backerSplit.unknown;
      acc.trust.high += report.trustBands.high;
      acc.trust.medium += report.trustBands.medium;
      acc.trust.low += report.trustBands.low;
      acc.trust.unknown += report.trustBands.unknown;
      return acc;
    }, base);
  }, [data]);

  const creatorName = data?.creator.profile.name || (data ? shortAddress(data.creator.address) : "Creator");

  return (
    <main className="garage-theme min-h-screen px-4 py-6 text-ink dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-[#fbfaf6] p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/garage"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-ink/10 bg-[#f0ede5] px-3 py-2 text-sm font-black text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to market
          </Link>
          <div className="flex items-center gap-3">
            <img src="/crc-boost-icon.png" alt="" className="h-11 w-11 rounded-xl border border-ink/10 bg-white object-cover p-0.5 dark:border-white/10" />
            <div>
              <p className="font-display text-lg font-black uppercase tracking-[0.14em]">CRC Boosts</p>
              <p className="text-xs font-black text-ink/52 dark:text-white/55">creator reputation</p>
            </div>
          </div>
        </header>

        {loading && (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-[#fbfaf6] p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-3 font-bold text-ink/55 dark:text-white/55">Loading creator reputation...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-800 dark:text-red-200">
            <p className="font-display text-2xl font-black">Creator not found</p>
            <p className="mt-2 text-sm font-bold">{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            <section className="garage-hero relative mt-6 overflow-hidden rounded-2xl border border-ink/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 rounded-full bg-marine/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-marine">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Creator reputation
                  </p>
                  <h1 className="mt-5 font-display text-4xl font-black tracking-tight sm:text-5xl">
                    {creatorName}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.1em]">
                    <span className={`rounded-full px-3 py-1.5 ${backerTone(data.creator.trustProfile?.backerStatus)}`}>
                      {backerLabel(data.creator.trustProfile?.backerStatus)}
                    </span>
                    <span className="rounded-full bg-ink/6 px-3 py-1.5 text-ink/60 dark:bg-white/10 dark:text-white/65">
                      Trust {trustLabel(data.creator.trustProfile)}
                    </span>
                    {data.creator.xAccount && (
                      <a
                        href={`https://x.com/${data.creator.xAccount.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-ink/6 px-3 py-1.5 text-marine hover:underline dark:bg-white/10 dark:text-sky-300"
                      >
                        @{data.creator.xAccount.username}
                      </a>
                    )}
                  </div>
                  <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-ink/62 dark:text-white/62">
                    Public proof of funded boosts, CRC paid to users, and the Circles trust quality of the attention this creator attracts.
                  </p>
                </div>

                <div className="rounded-2xl border border-ink/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
                  <div className="flex items-center gap-3">
                    {data.creator.profile.imageUrl ? (
                      <img
                        src={data.creator.profile.imageUrl}
                        alt={creatorName}
                        className="h-16 w-16 rounded-full border border-ink/10 object-cover dark:border-white/10"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-xl font-black text-white dark:bg-white dark:text-ink">
                        {creatorName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-black">{creatorName}</p>
                      <p className="mt-1 text-xs font-black text-ink/52 dark:text-white/55">{shortAddress(data.creator.address)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Boosts funded" value={formatNumber(data.stats.campaignsFunded)} detail={`${formatNumber(data.stats.liveCampaigns)} live`} icon={Megaphone} />
              <StatCard label="CRC paid" value={`${formatNumber(data.stats.crcPaid)} CRC`} detail={`${formatNumber(data.stats.crcPending)} pending`} icon={CircleDollarSign} />
              <StatCard label="Wallets reached" value={formatNumber(data.stats.touchedWallets)} detail={`${formatNumber(data.stats.verifiedClaims)} verified claims`} icon={Wallet} />
              <StatCard label="Settlement" value={formatPercent(data.stats.settlementSuccessRate)} detail={`${formatNumber(data.stats.removedActionClaims)} removed actions`} icon={ShieldCheck} />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  Market quality
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatCard label="Avg claimant trust" value={data.stats.averageClaimantTrust === null ? "-" : formatNumber(data.stats.averageClaimantTrust)} detail="across claimants with score" icon={BarChart3} />
                  <StatCard label="X reads" value={formatNumber(data.stats.xReads)} detail="verification cost signal" icon={BadgeCheck} />
                </div>
              </div>

              <div className="rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  Claimant mix
                </p>
                <div className="mt-4 grid gap-4">
                  <SplitRow label="Direct backer" value={aggregateSplit.backer.direct} total={aggregateSplit.total} />
                  <SplitRow label="Indirect backer" value={aggregateSplit.backer.indirect} total={aggregateSplit.total} />
                  <SplitRow label="No backer link" value={aggregateSplit.backer.none} total={aggregateSplit.total} />
                  <SplitRow label="No score" value={aggregateSplit.trust.unknown} total={aggregateSplit.total} />
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-ink/10 bg-[#fbfaf6] p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                    Campaign history
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-black">Funded boosts</h2>
                </div>
                <span className="w-fit rounded-md bg-citrus/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-citrus">
                  {formatNumber(data.campaigns.length)} boosts
                </span>
              </div>

              <div className="mt-5 grid gap-4">
                {data.campaigns.length ? (
                  data.campaigns.map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} />)
                ) : (
                  <div className="rounded-md border border-ink/10 bg-[#f0ede5] p-5 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="font-display text-lg font-black">No campaigns yet.</p>
                    <p className="mt-1 text-sm font-bold text-ink/52 dark:text-white/55">
                      Reputation starts building once this creator funds a boost.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
