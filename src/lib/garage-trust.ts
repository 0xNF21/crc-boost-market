import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { garageTrustProfiles, type GarageTrustProfile } from "@/lib/db/schema";

export type GarageBackerStatus = "direct" | "indirect" | "none" | "unknown";

export type PublicGarageTrustProfile = {
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

type CirclesQuery = {
  Namespace: string;
  Table: string;
  Columns: string[];
  Filter?: unknown[];
  Limit?: number;
};

type CirclesQueryResult = {
  columns?: string[];
  rows?: unknown[][];
};

type TrustScoreRow = {
  avatar?: string;
  trust_score?: number | string | null;
  trust_level?: string | null;
  confidence?: number | string | null;
  computed_at?: number | string | null;
  in_degree?: number | string | null;
  out_degree?: number | string | null;
  mutual_count?: number | string | null;
  age_days?: number | string | null;
};

type RelativeTrustScoreResult = {
  address?: string;
  relative_score?: number | string | null;
  targets_reached?: number | string | null;
  total_targets?: number | string | null;
  penetration_rate?: number | string | null;
};

const CIRCLES_RPC_URL = process.env.CIRCLES_RPC_URL || process.env.NEXT_PUBLIC_CIRCLES_RPC_URL || "https://rpc.aboutcircles.com/";
const TRUST_SCORE_API_URL = process.env.GARAGE_TRUST_SCORE_API_URL || "https://squid-app-3gxnl.ondigitalocean.app/aboutcircles-advanced-analytics2";
const CACHE_SECONDS = Math.max(60, Number(process.env.GARAGE_TRUST_CACHE_SECONDS ?? 6 * 60 * 60));
const ERROR_CACHE_SECONDS = Math.max(30, Number(process.env.GARAGE_TRUST_ERROR_CACHE_SECONDS ?? 5 * 60));
const INDIRECT_BACKER_THRESHOLD = Math.max(1, Number(process.env.GARAGE_INDIRECT_BACKER_THRESHOLD ?? 3));
const INCOMING_TRUSTERS_LIMIT = Math.min(1000, Math.max(50, Number(process.env.GARAGE_INCOMING_TRUSTERS_LIMIT ?? 1000)));

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(normalized) ? normalized : null;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function epochSecondsToDate(value: unknown): Date | null {
  const seconds = numberOrNull(value);
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

function bigintOrNull(value: unknown): bigint | null {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return null;
  }
}

function filterEquals(column: string, value: string) {
  return {
    Type: "FilterPredicate",
    FilterType: "Equals",
    Column: column,
    Value: value,
  };
}

function filterIn(column: string, values: string[]) {
  return {
    Type: "FilterPredicate",
    FilterType: "In",
    Column: column,
    Value: values,
  };
}

async function circlesQuery(query: CirclesQuery): Promise<Record<string, unknown>[]> {
  const response = await fetch(CIRCLES_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circles_query",
      params: [query],
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    next: { revalidate: 0 } as any,
  });

  if (!response.ok) {
    throw new Error(`circles_query_http_${response.status}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    const message = typeof payload.error?.message === "string" ? payload.error.message : "circles_query_error";
    throw new Error(message);
  }

  const result = payload?.result as CirclesQueryResult | undefined;
  const columns = Array.isArray(result?.columns) ? result!.columns! : [];
  const rows = Array.isArray(result?.rows) ? result!.rows! : [];
  return rows.map((row) =>
    columns.reduce<Record<string, unknown>>((record, column, index) => {
      record[column] = row[index];
      return record;
    }, {}),
  );
}

async function fetchTrustScore(address: string): Promise<TrustScoreRow | null> {
  const rows = await circlesQuery({
    Namespace: "V_TrustScores",
    Table: "Current",
    Columns: [
      "avatar",
      "trust_score",
      "trust_level",
      "confidence",
      "computed_at",
      "in_degree",
      "out_degree",
      "mutual_count",
      "age_days",
    ],
    Filter: [filterEquals("avatar", address)],
    Limit: 1,
  });
  return (rows[0] as TrustScoreRow | undefined) ?? null;
}

async function fetchRelativeTrustScore(address: string): Promise<RelativeTrustScoreResult | null> {
  const response = await fetch(`${TRUST_SCORE_API_URL}/scoring/relative_trustscore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      avatars: [address],
      target_set_name: "all_backers",
      include_details: false,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    next: { revalidate: 0 } as any,
  });

  if (!response.ok) {
    throw new Error(`relative_trustscore_http_${response.status}`);
  }

  const payload = await response.json();
  if (payload?.status && payload.status !== "success") {
    throw new Error("relative_trustscore_failed");
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  return (results[0] as RelativeTrustScoreResult | undefined) ?? null;
}

async function fetchDirectBacker(address: string): Promise<boolean> {
  const rows = await circlesQuery({
    Namespace: "CrcV2",
    Table: "CirclesBackingCompleted",
    Columns: ["backer"],
    Filter: [filterEquals("backer", address)],
    Limit: 1,
  });
  return rows.length > 0;
}

async function fetchIncomingTrusters(address: string): Promise<string[]> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rows = await circlesQuery({
    Namespace: "V_CrcV2",
    Table: "TrustRelations",
    Columns: ["truster", "trustee", "expiryTime"],
    Filter: [filterEquals("trustee", address)],
    Limit: INCOMING_TRUSTERS_LIMIT,
  });

  const trusters = new Set<string>();
  for (const row of rows) {
    const truster = normalizeAddress(String(row.truster ?? ""));
    if (!truster || truster === address) continue;

    const expiry = bigintOrNull(row.expiryTime);
    if (expiry && expiry > 0n && expiry < BigInt(nowSeconds)) continue;
    trusters.add(truster);
  }
  return [...trusters];
}

async function fetchDirectBackersIn(addresses: string[]): Promise<string[]> {
  const direct = new Set<string>();
  const batchSize = 75;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    if (!batch.length) continue;
    const rows = await circlesQuery({
      Namespace: "CrcV2",
      Table: "CirclesBackingCompleted",
      Columns: ["backer"],
      Filter: [filterIn("backer", batch)],
      Limit: batch.length,
    });
    for (const row of rows) {
      const backer = normalizeAddress(String(row.backer ?? ""));
      if (backer) direct.add(backer);
    }
    if (direct.size >= INDIRECT_BACKER_THRESHOLD) break;
  }
  return [...direct];
}

async function resolveBackerStatus(address: string) {
  const directBacker = await fetchDirectBacker(address);
  if (directBacker) {
    return {
      backerStatus: "direct" as GarageBackerStatus,
      directBacker: true,
      indirectBackerTrustCount: 0,
      indirectBackerAddresses: [],
    };
  }

  const incomingTrusters = await fetchIncomingTrusters(address);
  const directIncomingBackers = await fetchDirectBackersIn(incomingTrusters);
  return {
    backerStatus: directIncomingBackers.length >= INDIRECT_BACKER_THRESHOLD
      ? "indirect" as GarageBackerStatus
      : "none" as GarageBackerStatus,
    directBacker: false,
    indirectBackerTrustCount: directIncomingBackers.length,
    indirectBackerAddresses: directIncomingBackers.slice(0, 8),
  };
}

function publicTrustProfile(row: GarageTrustProfile): PublicGarageTrustProfile {
  return {
    walletAddress: row.walletAddress,
    trustScore: row.trustScore,
    trustLevel: row.trustLevel,
    confidence: row.confidence,
    computedAt: row.computedAt?.toISOString() ?? null,
    inDegree: row.inDegree,
    outDegree: row.outDegree,
    mutualCount: row.mutualCount,
    ageDays: row.ageDays,
    backerStatus: row.backerStatus as GarageBackerStatus,
    directBacker: row.directBacker,
    indirectBackerTrustCount: row.indirectBackerTrustCount,
    indirectBackerAddresses: row.indirectBackerAddresses,
    source: row.source,
    errorMessage: row.errorMessage,
    lastFetchedAt: row.lastFetchedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    stale: row.expiresAt.getTime() <= Date.now(),
  };
}

async function getCachedTrustProfile(address: string): Promise<GarageTrustProfile | null> {
  return (
    (await db
      .select()
      .from(garageTrustProfiles)
      .where(eq(garageTrustProfiles.walletAddress, address))
      .limit(1))[0] ?? null
  );
}

async function writeTrustProfile(address: string, values: Omit<typeof garageTrustProfiles.$inferInsert, "id" | "walletAddress" | "createdAt">) {
  const [row] = await db
    .insert(garageTrustProfiles)
    .values({
      walletAddress: address,
      ...values,
    })
    .onConflictDoUpdate({
      target: garageTrustProfiles.walletAddress,
      set: {
        trustScore: values.trustScore,
        trustLevel: values.trustLevel,
        confidence: values.confidence,
        computedAt: values.computedAt,
        inDegree: values.inDegree,
        outDegree: values.outDegree,
        mutualCount: values.mutualCount,
        ageDays: values.ageDays,
        backerStatus: values.backerStatus,
        directBacker: values.directBacker,
        indirectBackerTrustCount: values.indirectBackerTrustCount,
        indirectBackerAddresses: values.indirectBackerAddresses,
        source: values.source,
        errorMessage: values.errorMessage,
        lastFetchedAt: values.lastFetchedAt,
        expiresAt: values.expiresAt,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  return row;
}

export async function getGarageTrustProfile(addressValue: string, opts: { force?: boolean } = {}) {
  const address = normalizeAddress(addressValue);
  if (!address) {
    throw new Error("invalid_wallet_address");
  }

  const cached = await getCachedTrustProfile(address);
  if (!opts.force && cached && cached.expiresAt.getTime() > Date.now()) {
    return publicTrustProfile(cached);
  }

  const now = new Date();
  try {
    const [trustScore, relativeTrustScore, backer] = await Promise.all([
      fetchTrustScore(address),
      fetchRelativeTrustScore(address),
      resolveBackerStatus(address),
    ]);
    const relativeScore = numberOrNull(relativeTrustScore?.relative_score);

    const row = await writeTrustProfile(address, {
      trustScore: relativeScore === null
        ? numberOrNull(trustScore?.trust_score)
        : Math.floor(relativeScore),
      trustLevel: typeof trustScore?.trust_level === "string" ? trustScore.trust_level : null,
      confidence: numberOrNull(trustScore?.confidence),
      computedAt: epochSecondsToDate(trustScore?.computed_at),
      inDegree: numberOrNull(trustScore?.in_degree) ?? 0,
      outDegree: numberOrNull(trustScore?.out_degree) ?? 0,
      mutualCount: numberOrNull(trustScore?.mutual_count) ?? 0,
      ageDays: numberOrNull(trustScore?.age_days) ?? 0,
      backerStatus: backer.backerStatus,
      directBacker: backer.directBacker,
      indirectBackerTrustCount: backer.indirectBackerTrustCount,
      indirectBackerAddresses: backer.indirectBackerAddresses,
      source: relativeScore === null ? "circles-rpc" : "relative-trustscore",
      errorMessage: null,
      lastFetchedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_SECONDS * 1000),
      updatedAt: now,
    });

    return publicTrustProfile(row);
  } catch (error: any) {
    const message = String(error?.message ?? "circles_trust_fetch_failed").slice(0, 240);
    const row = await writeTrustProfile(address, {
      trustScore: cached?.trustScore ?? null,
      trustLevel: cached?.trustLevel ?? null,
      confidence: cached?.confidence ?? null,
      computedAt: cached?.computedAt ?? null,
      inDegree: cached?.inDegree ?? 0,
      outDegree: cached?.outDegree ?? 0,
      mutualCount: cached?.mutualCount ?? 0,
      ageDays: cached?.ageDays ?? 0,
      backerStatus: (cached?.backerStatus as GarageBackerStatus | undefined) ?? "unknown",
      directBacker: cached?.directBacker ?? false,
      indirectBackerTrustCount: cached?.indirectBackerTrustCount ?? 0,
      indirectBackerAddresses: cached?.indirectBackerAddresses ?? [],
      source: "circles-rpc",
      errorMessage: message,
      lastFetchedAt: now,
      expiresAt: new Date(now.getTime() + ERROR_CACHE_SECONDS * 1000),
      updatedAt: now,
    });
    return publicTrustProfile(row);
  }
}
